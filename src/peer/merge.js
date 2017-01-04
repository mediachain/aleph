// @flow

const pull = require('pull-stream')
const pullThroughPromise = require('pull-promise/through')
const pushable = require('pull-pushable')
const window = require('pull-window')
const pb = require('../protobuf')
const { statementsFromQueryResult, objectIdsFromStatement, protoStreamEncode, protoStreamDecode } = require('./util')
const { flatMap, promiseHash } = require('../common/util')
const { verifyStatementWithKeyCache } = require('../metadata/signatures')

import type { MediachainNode } from './node'
import type { Datastore } from './datastore'
import type { PublicSigningKey } from './identity'
import type { PullStreamSource, PullStreamThrough } from './util'
import type { QueryResultMsg, QueryResultValueMsg, StreamErrorMsg, StatementMsg, DataRequestMsg, DataObjectMsg } from '../protobuf/types'
import type { Connection } from 'interface-connection'

const BATCH_SIZE = 1024

export type MergeResult = {
  statementCount: number,
  objectCount: number,
  error?: Error
}

function mergeFromStreams (
  localNode: MediachainNode,
  queryResultStream: PullStreamSource<QueryResultMsg>,
  dataConn: Connection)
: Promise<MergeResult> {
  const publisherKeyCache: Map<string, PublicSigningKey> = new Map()
  const objectIdStream = pushable()

  // A stream that accepts QueryResult messages, extracts statements from them,
  // verifies the statement signatures and sends the statements downstream,
  // and pushes their object references onto the objectIdStream
  const queryResultThrough: PullStreamThrough<QueryResultMsg, Array<StatementMsg>> = read => (end, callback) => {
    const endQueryStream = exitValue => {
      objectIdStream.end()
      callback(exitValue)
    }

    if (end) return callback(end)
    read(end, (end: ?mixed, queryResult: ?QueryResultMsg) => {
      if (end) return endQueryStream(end)
      if (queryResult == null) return endQueryStream(new Error(`Got null queryResult`))

      if (queryResult.end !== undefined) {
        return endQueryStream(true)
      }
      if (queryResult.error !== undefined) {
        const err: StreamErrorMsg = (queryResult.error : any)
        return endQueryStream(new Error(err.error))
      }
      if (queryResult.value == null) {
        return endQueryStream(new Error(`Unexpected query result message: ${JSON.stringify(queryResult)}`))
      }
      const queryValue: QueryResultValueMsg = (queryResult.value : any)
      const statements = statementsFromQueryResult(queryValue)
      if (statements.length < 1) {
        return endQueryStream(new Error(`Query result value contained no statements: ${JSON.stringify(queryValue)}`))
      }

      // verify all statements
      Promise.all(statements.map(stmt => verifyStatementWithKeyCache(stmt, publisherKeyCache)))
        .catch(err => endQueryStream(err))
        .then(results => {
          results.forEach((valid, idx) => {
            if (!valid) {
              const stmt = statements[idx]
              return endQueryStream(new Error(`Statement failed signature verification: ${JSON.stringify(stmt)}`))
            }
          })

          // if all statements verified successfully, push their object refs onto the objectIdStream
          // and pass the statements array onto the stream
          const ids = flatMap(statements, objectIdsFromStatement)
          for (const id of ids) {
            objectIdStream.push(id)
          }
          callback(null, statements)
        })
    })
  }

  const statementIngestionPromise = new Promise((resolve, reject) => {
    pull(
      queryResultStream,
      queryResultThrough,
      pull.flatten(),
      pullThroughPromise(stmt => localNode.db.put(stmt)),
      pull.collect((err, statementIds) => {
        if (err) return reject(err)
        resolve(statementIds.length)
      })
    )
  })

  const objectIngestionPromise = new Promise((resolve, reject) => {
    pull(
      objectIdStream,

      // gather object ids into batches (filtering out those we have in the local store)
      batchDataRequestStream(BATCH_SIZE, localNode.datastore),

      // send request, read response
      protoStreamEncode(pb.node.DataRequest),
      dataConn,
      protoStreamDecode(pb.node.DataResult),

      // end stream on error, send objects down the line
      pull.asyncMap((result, callback) => {
        if (result.error !== undefined) {
          const err: StreamErrorMsg = (result.error : any)
          return callback(new Error(err.error))
        }
        if (result.data !== undefined) {
          return callback(null, result.data)
        }
        // we return null for "end" messages, since we want to read multiple
        // responses from the same connection.  The query stream will end the
        // objectIdStream when it's done
        return callback(null, null)
      }),
      // TODO: verify that key is a valid hash of data

      // add the data to the local node's store
      pullThroughPromise((obj: ?DataObjectMsg) => {
        if (obj == null) return Promise.resolve([])

        return localNode.putData(obj.data)
      }),

      // MediachainNode.putData() returns an array of keys, flatten to a stream
      pull.flatten(),

      // drain the stream and return the object count
      // TODO: if error occurs after partially successful merge,
      // we should be returning the object count + error message
      pull.collect((err, objectIds) => {
        if (err) return reject(err)
        resolve(objectIds.length)
      })
    )
  })

  return promiseHash({
    statementCount: statementIngestionPromise,
    objectCount: objectIngestionPromise
  })
}

function batchDataRequestStream (batchSize: number, localDatastore: Datastore): PullStreamThrough<string, DataRequestMsg> {
  let batch = []

  return window(
    (_firstId, callback) => {
      if (batch.length !== 0) return

      const sendBatch = () => {
        const keys = batch
        batch = []
        callback(null, keys)
      }

      return (end, objectId) => {
        if (end) {
          return sendBatch()
        }

        localDatastore.has(objectId).then(existsLocally => {
          if (existsLocally) {
            // console.log(`local store already has ${objectId}, skipping`)
            return
          }

          batch.push(objectId)
          if (batch.length >= batchSize) {
            sendBatch()
          }
        })
      }
    },

    // map batches onto DataRequests
    (start, keys) => ({keys})
  )
}

module.exports = {
  mergeFromStreams
}
