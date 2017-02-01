// @flow

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { PROTOCOLS } = require('../../src/peer/constants')
const pull = require('pull-stream')
const { PublisherId } = require('../../src/peer/identity')
const { makeNode, mockQueryHandler } = require('../util')
const { unpackQueryResultProtobuf } = require('../../src/model/query_result')

import type Node from '../../src/peer/node'

function startNodes (...nodes: Array<Node>): Promise<*> {
  return Promise.all(nodes.map(n => n.start()))
}

describe('Remote Query', () => {
  let local

  before(() => makeNode().then(peer => { local = peer }))

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
      .map(raw => unpackQueryResultProtobuf(raw))

    let remote

    return makeNode()
      .then(node => {
        remote = node
        remote.p2p.handle(PROTOCOLS.node.query, mockQueryHandler(responses))
      })
      .then(() => startNodes(local, remote)) // start both peers
      .then(() => local.remoteQuery(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
      .then(results => {
        assert.deepEqual(results, expected, 'query should return all expected results')
      })
  })

  it('ends the stream with an error when it gets an error response', function () {
    this.timeout(3000)

    const errorMessage = 'server on fire'
    const responses = [
      {value: {simple: {stringValue: 'hello world'}}},
      {value: {simple: {intValue: 123}}},
      {error: {error: errorMessage}}
    ]

    const expected = responses.slice(0, responses.length - 1)
      .map(raw => unpackQueryResultProtobuf(raw))

    let remote
    return makeNode()
      .then(node => {
        remote = node
        remote.p2p.handle(PROTOCOLS.node.query, mockQueryHandler(responses))
      })
      .then(() => startNodes(local, remote))
      .then(() => local.remoteQueryStream(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
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

describe('Remote Query with inline data', () => {
  let local, remote

  const seedObject = {foo: 'bar'}

  before(() =>
    makeNode().then(peer => { local = peer })
      .then(() => PublisherId.generate())
      .then(publisherId => makeNode({publisherId}))
      .then(peer => {
        remote = peer
      })
      .then(() =>
        remote.ingestSimpleStatement('scratch.test.queryWithData', seedObject, {refs: ['test-1']})
      )
      .then(stmtId => remote.db.get(stmtId))
      .then(stmt => {
        remote.p2p.handle(PROTOCOLS.node.query, mockQueryHandler([{value: {simple: {stmt}}}]))
      })
  )

  it('returns query results with data objects inline', () =>
    Promise.all([local.start(), remote.start()])
      .then(() => local.remoteQueryWithData(remote.peerInfo, 'SELECT * FROM scratch.test.queryWithData'))
      .then(result => {
        assert(result != null)
        assert(Array.isArray(result))
        assert.deepEqual(result[0].simple.stmt.body.simple.object.data, seedObject)
      })
  )
})
