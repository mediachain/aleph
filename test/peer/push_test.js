// @flow

const chai = require('chai')
chai.use(require('chai-as-promised'))

const { expect } = chai
const { before, describe, it } = require('mocha')

const uuid = require('uuid')

const { makeNode, mockPushHandler } = require('../util')
const { PROTOCOLS } = require('../../src/peer/constants')
const { b58MultihashForBuffer } = require('../../src/common/util')
const { Statement, SignedStatement } = require('../../src/model/statement')
const serialize = require('../../src/metadata/serialize')
const { PublisherId } = require('../../src/peer/identity')

const TEST_NAMESPACE = 'scratch.push-test'
const SEED_OBJECT_BUFFERS = [
  {id: uuid.v4(), foo: 'bar'},
  {id: uuid.v4(), test: 'yep'}
].map(obj => serialize.encode(obj))

function makeSeedStatements (publisherId: PublisherId, seedObjectBuffers: Array<Buffer>): Promise<Array<Statement>> {
  return Promise.all(
    seedObjectBuffers.map((buf, idx) => {
      const object = b58MultihashForBuffer(buf)
      return SignedStatement.createSimple(publisherId, TEST_NAMESPACE, {object, refs: [`merge-test:${idx.toString()}`]}, idx)
    })
  )
}

describe('Push', () => {
  let alephNode
  let mockDestination
  let publisherId
  let seedStatements

  before(() =>
    makeNode()
      .then(node => { alephNode = node })
      .then(() => makeNode())
      .then(dest => { mockDestination = dest })
      .then(() => PublisherId.generate())
      .then(pubId => { publisherId = pubId })
      .then(() => makeSeedStatements(publisherId, SEED_OBJECT_BUFFERS))
      .then(statements => { seedStatements = statements })
  )

  it('handles rejection', () =>
    alephNode.start()
      .then(() => {
        mockDestination.p2p.handle(PROTOCOLS.node.push, mockPushHandler({reject: {error: 'not authorized'}}, 0))
        return mockDestination.start()
      })
      .then(() =>
        expect(alephNode.pushStatements(mockDestination.peerInfo, seedStatements))
          .to.eventually.be.rejectedWith('not authorized')
      )
  )

  it('sends statements if authorized', () => {
    const result = {
      objects: seedStatements.length,
      statements: seedStatements.length,
      error: ''
    }

    return alephNode.start()
      .then(() => Promise.all(seedStatements.map(s => alephNode.db.put(s))))
      .then(() => {
        mockDestination.p2p.handle(PROTOCOLS.node.push, mockPushHandler({accept: {}}, seedStatements.length, result))
        return mockDestination.start()
      })
      .then(() =>
        expect(alephNode.pushStatementsById(mockDestination.peerInfo, seedStatements.map(s => s.id)))
          .to.eventually.be.deep.eql(result)
      )
  })
})
