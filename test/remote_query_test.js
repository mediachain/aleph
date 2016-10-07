// @flow

const assert = require('assert')
const { describe, it } = require('mocha')

const { PROTOCOLS } = require('../src/peer/constants')
const { generateIdentity } = require('../src/peer/identity')
const Node = require('../src/peer/node')
const pull = require('pull-stream')
const pb = require('../src/protobuf')
const {
  protoStreamDecode,
  protoStreamEncode
} = require('../src/peer/util')

import type { QueryResultMsg } from '../src/protobuf/types'
import type { Connection } from 'interface-connection'

// accept any query and return a stream of the given results
const queryHandler = (results: Array<QueryResultMsg>) => (conn: Connection) => pull(
  conn,
  protoStreamDecode(pb.node.QueryRequest),
  pull.map(() => results),
  pull.flatten(),
  protoStreamEncode(pb.node.QueryResult),
  conn
)

function mockRemote (results: Array<QueryResultMsg>): Node {
  const node = new Node(generateIdentity())
  node.p2p.handle(PROTOCOLS.node.query, queryHandler(results))
  return node
}

function startNodes (...nodes: Array<Node>): Promise<*> {
  return Promise.all(nodes.map(n => n.start()))
}

describe('Remote Query', () => {
  const local = new Node(generateIdentity())

  it('decodes all query result types correctly', function () {
    this.timeout(3000)

    const responses = [
      {value: {simple: {stringValue: 'hello world'}}},
      {value: {simple: {intValue: 123}}},
      {value: {
        compound: {
          body: [
            {key: 'foo', value: {stringValue: 'bar'}},
            {key: 'bar', value: {intValue: 1}}]}}},
      {end: {}}
    ]

    // the stream doesn't deliver the "end" response, it just ends the stream
    const expected = responses.slice(0, responses.length - 1)
    const remote = mockRemote(responses)

    return startNodes(local, remote) // start both peers
      .then(() => local.remoteQuery(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
      .then(resultStream =>
        new Promise(resolve => {
          pull(
            resultStream,
            pull.collect((err, results) => {
              assert(err == null, 'query should not return an error')
              assert.deepEqual(results, expected, 'query should return all expected results')
              resolve()
            }))
        })
      )
  })

  it('ends the stream with an error when it gets an error response', function () {
    this.timeout(3000)

    const errorMessage = 'server on fire'
    const responses = [
      {value: {simple: {stringValue: 'hello world'}}},
      {value: {simple: {intValue: 123}}},
      {error: {error: errorMessage}}
    ]

    const remote = mockRemote(responses)
    const expected = responses.slice(0, responses.length - 1)

    return startNodes(local, remote)
      .then(() => local.remoteQuery(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
      .then(resultStream => new Promise(resolve => {
        pull(
          resultStream,
          pull.collect((err, results) => {
            assert(err instanceof Error, 'query should return an error object')
            assert.equal(err.message, errorMessage, 'error object should have error message from remote node')
            assert.deepEqual(results, expected, 'we should still get all results before the error')
            resolve()
          })
        )
      }))
  })
})