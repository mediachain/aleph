// @flow

const assert = require('assert')
const { before, describe, it } = require('mocha')

const uuid = require('uuid')

const { makeNode, mockQueryHandler } = require('../util')
const { PROTOCOLS } = require('../../src/peer/constants')
const { b58MultihashForBuffer } = require('../../src/common/util')
const { Statement } = require('../../src/model/statement')
const serialize = require('../../src/metadata/serialize')
const { PublisherId } = require('../../src/peer/identity')

import type { QueryResultMsg, StatementMsg } from '../../src/protobuf/types'

const TEST_NAMESPACE = 'scratch.merge-test'

const SEED_OBJECT_BUFFERS = [
  {id: uuid.v4(), foo: 'bar'},
  {id: uuid.v4(), test: 'yep'}
].map(obj => serialize.encode(obj))

function makeSeedStatements (publisherId: PublisherId, seedObjectBuffers: Array<Buffer>): Promise<Array<Statement>> {
  return Promise.all(
    seedObjectBuffers.map((buf, idx) => {
      const object = b58MultihashForBuffer(buf)
      return Statement.createSimple(publisherId, TEST_NAMESPACE, {object, refs: [`merge-test:${idx.toString()}`]}, idx)
    })
  )
}

function mockQueryResults (statements: Array<Statement>): Array<QueryResultMsg> {
  const results: Array<QueryResultMsg> = statements.map(stmt => {
    return { value: { simple: { stmt: stmt.toProtobuf() } } }
  })

  return [...results, {end: {}}]
}

describe('Merge', () => {
  let alephNode
  let mockSource
  let publisherId
  let seedStatements

  before(() =>
    makeNode()
      .then(node => { alephNode = node })
      .then(() => PublisherId.generate())
      .then(pubId => { publisherId = pubId })
      .then(() => makeSeedStatements(publisherId, SEED_OBJECT_BUFFERS))
      .then(statements => { seedStatements = statements })
      .then(() => makeNode())
      .then(mockNode => {
        mockSource = mockNode
        mockSource.p2p.unhandle(PROTOCOLS.node.query)
        mockSource.p2p.handle(PROTOCOLS.node.query, mockQueryHandler(mockQueryResults(seedStatements)))
        return mockNode.putData(...SEED_OBJECT_BUFFERS)
      })
  )

  it('adds statements and objects from a remote source', () =>
    alephNode.start()
      .then(() => mockSource.start())
      .then(() => alephNode.merge(mockSource.peerInfo, `SELECT * FROM ${TEST_NAMESPACE}`))
      .then(result => {
        assert.notEqual(result, null, 'merge did not return a result')
        assert.equal(result.statementCount, seedStatements.length, 'merged an unexpected number of statements')
        assert.equal(result.objectCount, SEED_OBJECT_BUFFERS.length, 'merged an unexpected number of objects')
      })
      .catch(err => {
        console.error('error during merge test: ', err)
        throw err
      })
  )
})
