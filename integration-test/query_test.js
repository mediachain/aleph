// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, after } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const AlephNode = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const seedStatements = [
  {object: 'QmF00123', tags: [], refs: []},
  {object: 'QmF00456', tags: ['foo'], refs: []},
  {object: 'QmFoo789', refs: ['bar'], tags: ['foo']}
]

describe('Query', () => {
  let nodeIds = []

  before(() => {
    const nodeIdsP = loadTestNodeIds().then(res => nodeIds = res)
    const concatClientP = concatNodeClient().then(client => client.publish({namespace: 'foo.bar'}, ...seedStatements))
    return Promise.all([nodeIdsP, concatClientP])
  })

  after(() => {
    return concatNodeClient().then(client => client.delete('DELETE FROM foo.bar'))
  })

  it('queries a remote concat node from aleph node', () => {
    const alephNode = new AlephNode({peerId: nodeIds.pop()})
    return alephNode.start()
      .then(() => concatNodePeerInfo())
      .then(concatInfo => alephNode.remoteQuery(concatInfo, 'SELECT * FROM foo.bar ORDER BY counter'))
      .then(results => {
        assert(results != null && results.length > 0, 'query returned no results')

        // unpack query results and compare to seed statements
        const resultStatements = results.map(r => r.value.simple.stmt.body.simple)
        assert.deepEqual(seedStatements, resultStatements, 'query returned unexpected results')
      })
  })
})
