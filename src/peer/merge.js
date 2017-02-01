// @flow

const pull = require('pull-stream')
const pullThroughPromise = require('pull-promise/through')
const pushable = require('pull-pushable')
const window = require('pull-window')
const pb = require('../protobuf')
const { statementsFromQueryResult, objectIdsFromStatement, protoStreamEncode, protoStreamDecode } = require('./util')
const { flatMap, promiseHash, b58MultihashForBuffer } = require('../common/util')
const { verifyStatementWithKeyCache } = require('../metadata/signatures')

const { Statement } = require('../model/statement')
const { CompoundQueryResultValue } = require('../model/query_result')

import type { MediachainNode } from './node'
import type { Datastore } from './datastore'
import type { P2PSigningPublicKey } from './identity'
import type { PullStreamSource, PullStreamThrough } from './util'
import type { QueryResultMsg, QueryResultValueMsg, StreamErrorMsg, StatementMsg, DataRequestMsg, DataObjectMsg } from '../protobuf/types'
import type { Connection } from 'interface-connection'
import type { QueryResult } from '../model/query_result'

const BATCH_SIZE = 1024

export type MergeResult = {
  statementCount: number,
  objectCount: number,
  error?: string
}

function mergeFromStreams (
  localNode: MediachainNode,
  queryResultStream: PullStreamSource<QueryResult>,
  dataConn: Connection)
: Promise<MergeResult> {
  const publisherKeyCache: Map<string, P2PSigningPublicKey> = new Map()
  const objectIdStream = pushable()
  const objectIngestionErrors: Array<string> = []
  const statementIngestionErrors: Array<string> = []

  // A stream that accepts QueryResult objects, extracts statements from them,
  // verifies the statement signatures and sends the statements downstream,
  // and pushes their object references onto the objectIdStream
  const queryResultThrough: PullStreamThrough<QueryResult, Array<Statement>> = read => (end, callback) => {
    const endQueryStream = exitValue => {
      objectIdStream.end()
      if (exitValue instanceof Error) {
        return callback(exitValue)
      }

      if (typeof exitValue === 'string') {
        statementIngestionErrors.push(exitValue)
      }
      callback(true)
    }

    if (end) return callback(end)
    read(end, (end: ?mixed, queryResult: ?QueryResult) => {
      if (end) return endQueryStream(end)
      if (queryResult == null) return endQueryStream('Got null queryResult')

      if (queryResult instanceof Error) {
        return endQueryStream(queryResult)
      }

      let statements = []
      if (queryResult instanceof CompoundQueryResultValue) {
        statements = queryResult.statements()
      } else if (queryResult instanceof Statement) {
        statements = [queryResult]
      }

      if (statements.length < 1) {
        return endQueryStream(`Query result value contained no statements: ${JSON.stringify(queryResult)}`)
      }

      // verify all statements. verification failure causes the whole statement ingestion to fail
      // by passing an Error into endQueryStream (as opposed to a string, which will cause a partially
      // successful result
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
          const ids = flatMap(statements, stmt => stmt.objectIds)
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

  const objectIngestionPromise: Promise<number> = new Promise((resolve, reject) => {
    const keysRequested: Set<string> = new Set()

    pull(
      objectIdStream,

      // filter out keys we already have
      filterExistingKeys(localNode.datastore),

      // keep track of keys we requested
      pull.through(key => { key && keysRequested.add(key) }),

      // gather object ids into batches
      batchDataRequestStream(BATCH_SIZE),

      // send request, read response
      protoStreamEncode(pb.node.DataRequest),
      dataConn,
      protoStreamDecode(pb.node.DataResult),

      // end stream on error, send objects down the line
      pull.asyncMap((result, callback) => {
        if (result.error !== undefined) {
          const err: StreamErrorMsg = (result.error : any)
          objectIngestionErrors.push(err.error)
          return callback(true)
        }
        if (result.data !== undefined) {
          const dataObject: DataObjectMsg = (result.data : any)
          if (!keysRequested.has(dataObject.key)) {
            objectIngestionErrors.push(`Peer sent unrequested object ${dataObject.key}`)
            return callback(true)
          }
          const objHash = b58MultihashForBuffer(dataObject.data)
          if (objHash !== dataObject.key) {
            objectIngestionErrors.push(`Object has invalid key ${dataObject.key} - actual hash: ${objHash}`)
            return callback(true)
          }
          return callback(null, result.data)
        }
        // we return null for "end" messages, since we want to read multiple
        // responses from the same connection.  The query stream will end the
        // objectIdStream when it's done
        return callback(null, null)
      }),

      // add the data to the local node's store
      pullThroughPromise((obj: ?DataObjectMsg) => {
        if (obj == null) return Promise.resolve([])

        return localNode.putData(obj.data)
      }),

      // MediachainNode.putData() returns an array of keys, flatten to a stream
      pull.flatten(),

      // drain the stream and return the object count
      pull.collect((err, objectIds) => {
        if (err) return reject(err)

        if (objectIds.length !== keysRequested.size) {
          for (const received of objectIds) {
            keysRequested.delete(received)
          }
          const msg = 'Missing statement metadata. Missing keys: ' +
              Array.from(keysRequested).join(', ')
          objectIngestionErrors.push(msg)
        }

        resolve(objectIds.length)
      })
    )
  })

  return promiseHash({
    statementCount: statementIngestionPromise,
    objectCount: objectIngestionPromise
  }).then(({statementCount, objectCount}) => {
    const result: MergeResult = {
      statementCount,
      objectCount
    }
    const errorMessages = []
    if (objectIngestionErrors.length > 0) {
      const msg = objectIngestionErrors.join('\n')
      errorMessages.push(`Error ingesting objects: ${msg}`)
    }
    if (statementIngestionErrors.length > 0) {
      const msg = statementIngestionErrors.join('\n')
      errorMessages.push(`Error ingesting statements: ${msg}`)
    }
    if (errorMessages.length > 0) {
      result.error = errorMessages.join('\n\n')
    }
    return result
  })
}

function filterExistingKeys (localDatastore: Datastore): PullStreamThrough<string, ?string> {
  return pull.asyncMap((key, callback) => {
    localDatastore.has(key)
      .catch(err => {
        callback(err)
        return false
      })
      .then(existsLocally => {
        if (existsLocally) return callback(null, null)
        return callback(null, key)
      })
  })
}

function batchDataRequestStream (batchSize: number): PullStreamThrough<string, DataRequestMsg> {
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

        if (objectId != null) {
          batch.push(objectId)
          if (batch.length >= batchSize) {
            sendBatch()
          }
        }
      }
    },

    // map batches onto DataRequests
    (start, keys) => ({keys})
  )
}

module.exports = {
  mergeFromStreams
}
