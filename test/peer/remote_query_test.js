// @flow

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { PROTOCOLS } = require('../../src/peer/constants')
const pull = require('pull-stream')
const { makeNode, mockQueryHandler } = require('../util')

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

    let remote

    return makeNode()
      .then(node => {
        remote = node
        remote.p2p.handle(PROTOCOLS.node.query, mockQueryHandler(responses))
      })
      .then(() => startNodes(local, remote)) // start both peers
      .then(() => local.remoteQueryStream(remote.p2p.peerInfo, 'SELECT * FROM foo.bar'))
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

    const expected = responses.slice(0, responses.length - 1)

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
