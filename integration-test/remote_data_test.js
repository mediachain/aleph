// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const AlephNode = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const seedObjects = [
  {foo: 'bar'},
  {hello: 'world'}
]

describe('Remote Data Fetching', () => {
  let nodeIds = [], dataIds = []

  before(() => {
    const nodeIdsP = loadTestNodeIds().then(res => nodeIds = res)
    const concatClientP = concatNodeClient()
      .then(client => client.putData(...seedObjects))
      .then(ids => { dataIds = ids })
    return Promise.all([nodeIdsP, concatClientP])
  })

  it('can fetch data from a remote concat node', () => {
    const alephNode = new AlephNode({peerId: nodeIds.pop()})
    return alephNode.start()
      .then(() => concatNodePeerInfo())
      .then(concatInfo => alephNode.remoteData(concatInfo, dataIds))
      .then(results => {
        assert(results != null && results.length > 0, 'remote data fetch returned no results')

        for (let i = 0; i < results.length; i++) {
          const key = results[i].key
          assert.equal(key, dataIds[i], 'remote data fetch should return objects with same keys as query')
        }
      })
  })
})
