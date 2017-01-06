// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, after } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const TEST_NAMESPACE = 'scratch.merge-test'
const INVALID_STATEMENT_NAMESPACE = 'scratch.merge-test.invalid-stmt'

const seedObjects = [
  {hello: 'world'},
  {foo: 'bar'},
  {etc: 'and so on'}
]

describe('Merge (concat -> aleph)', () => {
  let objectIds
  let seedStatements
  let concatClient
  let concatPeerInfo

  before(() => {
    return concatNodeClient()
      .then(_client => { concatClient = _client })
      .then(() => concatNodePeerInfo())
      .then(_pInfo => { concatPeerInfo = _pInfo })
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
      .then(() =>
        // add a statement with a reference to a non-existent object
        concatClient.publish({namespace: INVALID_STATEMENT_NAMESPACE}, {
          object: 'QmNLftPEMzsadpbTsGaVP3haETYJb4GfnCgQiaFj5Red9G',
          refs: ['test:invalid:ref'],
          tags: [],
          deps: []
        }))
  })

  after(() =>
    concatClient.delete(`DELETE FROM ${TEST_NAMESPACE}`)
      .then(() => concatClient.delete(`DELETE FROM ${INVALID_STATEMENT_NAMESPACE}`))
      .then(() => concatClient.setStatus('offline'))
      .then(() => concatClient.garbageCollectDatastore())
      .then(() => concatClient.setStatus('online'))
  )

  it('merges statements from a concat node', () => {
    let alephNode
    return getTestNodeId().then(peerId => { alephNode = new AlephNode({ peerId }) })
      .then(() => alephNode.start())
      .then(() => alephNode.merge(concatPeerInfo, `SELECT * FROM ${TEST_NAMESPACE}`))
      .then(results => {
        assert.notEqual(results, null, 'merge did not return a result')
        assert.equal(results.statementCount, seedStatements.length, 'aleph node merged an unexpected number of statements')
        assert.equal(results.objectCount, objectIds.length, 'aleph node merged an unexpected number of objects')
      })
  })

  it ('returns counts + error message for partially successful merge', () => {
    let alephNode
    return getTestNodeId()
      .then(peerId => { alephNode = new AlephNode({ peerId })})
      .then(() => alephNode.start())
      .then(() => alephNode.merge(concatPeerInfo, `SELECT * FROM ${TEST_NAMESPACE}.* ORDER BY counter`))
      .catch(err => {
        assert.fail(err, 'no error', '', '!==')
      })
      .then(result => {
        console.log('partially successful result: ', result)
        assert.notEqual(result, null, 'partially-successful merge should return a result')
        assert(typeof result.error === 'string' && result.error.length > 0,
          'partially successful merge should return an error message')
      })
  })
})
