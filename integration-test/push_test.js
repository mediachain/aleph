// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')
const { generatePublisherId } = require('../src/peer/identity')

const seedObjects = [
  {id: 'foo:1', foo: 'bar'},
  {id: 'foo:2', foo: 'baz'}
]

function seedStatementsToAleph (alephNode: AlephNode): Promise<Array<string>> {
  return Promise.all(
    seedObjects.map(obj =>
      alephNode.ingestSimpleStatement('scratch.test', obj, { refs: [obj.id] })
    )
  )
}

function seedUnauthorizedStatement (alephNode: AlephNode): Promise<string> {
  const obj = {letMeIn: 'please'}
  return alephNode.ingestSimpleStatement('members.only', obj, { refs: ['foo'] })
}

describe('Push', () => {
  let alephNode
  let alephPeerIdB58
  let publisherId
  let statementIds
  let unauthorizedStatementId

  before(() => generatePublisherId()
    .then(_publisherId => { publisherId = _publisherId })
    .then(() => getTestNodeId())
    .then(nodeId => {
      const peerId = nodeId
      alephPeerIdB58 = peerId.toB58String()
      alephNode = new AlephNode({peerId, publisherId})
    })
    .then(() => seedStatementsToAleph(alephNode))
    .then(_statementIds => { statementIds = _statementIds })
    .then(() => seedUnauthorizedStatement(alephNode))
    .then(_stmtId => { unauthorizedStatementId = _stmtId })
    .then(() => concatNodeClient())
    .then(concat => concat.authorize(alephPeerIdB58, ['scratch.*']))
    .catch(err => {
      console.error('error during push setup:', err)
    })
  )

  it('pushes data to a concat node', () => {
    return alephNode.start()
      .then(() => concatNodePeerInfo())
      .then(pInfo => alephNode.pushStatementsById(pInfo, statementIds))
      .then(result => {
        assert(result != null)
        assert.equal(result.statements, seedObjects.length, 'peer did not accept all statements')
        assert.equal(result.objects, seedObjects.length, 'peer did not accept all objects')
        assert.equal(result.error, '', 'peer returned an error')
      })
  })

  it('errors if not authorized for a given namespace', () => {
    return alephNode.start()
      .then(() => concatNodePeerInfo())
      .then(pInfo => alephNode.pushStatementsById(pInfo, [unauthorizedStatementId]))
      .catch(err => {
        assert(err != null)
        assert(err.message.toLowerCase().includes('auth'))
      })
  })
})
