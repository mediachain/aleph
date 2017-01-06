// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, after } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const TEST_NAMESPACE = 'scratch.merge-test'

const seedObjects = [
  {hello: 'world'},
  {foo: 'bar'},
  {etc: 'and so on'}
]

describe('Merge (concat -> aleph)', () => {
  let objectIds
  let seedStatements
  let concatClient

  before(() => {
    return concatNodeClient()
      .then(_client => { concatClient = _client })
      .then(() => concatClient.setStatus('online'))
      .then(() => concatClient.putData(...seedObjects))
      .then(_objectIds => { objectIds = _objectIds })
      .then(() => {
        seedStatements = objectIds.map((object, idx) => ({
          object,
          refs: [`test:obj:${idx.toString()}`],
          tags: ['test'],
          deps: []
        }))
        return concatClient.publish({namespace: TEST_NAMESPACE}, ...seedStatements)
      })
  })

  after(() =>
    concatClient.delete(`DELETE FROM ${TEST_NAMESPACE}`)
      .then(() => concatClient.setStatus('offline'))
      .then(() => concatClient.garbageCollectDatastore())
      .then(() => concatClient.setStatus('online'))
  )

  it('merges statements from a concat node', () => {
    let alephNode
    return getTestNodeId().then(peerId => { alephNode = new AlephNode({ peerId }) })
      .then(() => alephNode.start())
      .then(() => concatNodePeerInfo())
      .then(concatInfo => alephNode.merge(concatInfo, `SELECT * FROM ${TEST_NAMESPACE}`))
      .then(results => {
        assert(results != null, 'merge did not return a result')
        assert.equal(results.statementCount, seedStatements.length, 'aleph node merged an unexpected number of statements')
        assert.equal(results.objectCount, objectIds.length, 'aleph node merged an unexpected number of objects')
      })
  })
})
