// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, after } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const seedStatements = [
  {object: 'QmF00123', tags: [], refs: [], deps: []},
  {object: 'QmF00456', tags: ['foo'], refs: [], deps: []},
  {object: 'QmFoo789', refs: ['bar'], tags: ['foo'], deps: []}
]

describe('Query', () => {
  before(() =>
    concatNodeClient()
      .then(client => client.publish({namespace: 'foo.bar'}, ...seedStatements))
  )

  after(() => {
    return concatNodeClient().then(client => client.delete('DELETE FROM foo.bar'))
  })

  it('queries a remote concat node from aleph node', () => {
    let alephNode
    return getTestNodeId().then(peerId => { alephNode = new AlephNode({ peerId }) })
      .then(() => alephNode.start())
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
