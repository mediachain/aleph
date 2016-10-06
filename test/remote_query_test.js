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

describe('Remote Query', () => {
  const local = new Node(generateIdentity())
  const remote = new Node(generateIdentity())

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

    const expected = responses.slice(0, responses.length - 1)

    remote.p2p.handle(PROTOCOLS.node.query, queryHandler(responses))

    return Promise.all([local.start(), remote.start()])  // start both peers
      .then(() => local.remoteQuery(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
      .then(resultStream =>
        new Promise(resolve => {
          pull(
            resultStream,
            pull.through(val => console.dir(val, {depth: 100})),
            pull.collect((err, results) => {
              assert(err == null, 'query should not return an error')
              assert.deepEqual(results, expected, 'query should return all expected results')
              resolve()
            }))
        })
      )
  })
})
