// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')

const seedObjects = [
  {id: 1, foo: 'bar'},
  {id: 2, foo: 'baz'}
]


const seedStatements = [
  {
    id: 'QmF001234:foo:5678',
    publisher: '',
    namespace: 'scratch.test',
    body: {
      simple: {
        object: 'QmF00123456789',
        refs: ['foo:bar123'],
        tags: ['test'],
        deps: []
      }
    },
    timestamp: Date.now(),
    signature: Buffer.from('')
  },
  {
    id: 'QmF001234:foo:6789',
    publisher: '',
    namespace: 'scratch.blah',
    body: {
      simple: {
        object: 'QmF00123456789',
        refs: ['foo:bar123'],
        tags: ['test'],
        deps: []
      }
    },
    timestamp: Date.now(),
    signature: Buffer.from('')
  }
]

describe('Query', () => {
  let alephNode
  let alephPeerIdB58

  before(() => loadTestNodeIds()
    .then(nodeIds => {
      const peerId = nodeIds.pop()
      alephPeerIdB58 = peerId.toB58String()
      alephNode = new AlephNode({peerId})
    })
    .then(() => alephNode.putData(...seedObjects))
    .then(() => concatNodeClient())
    .then(concat => concat.authorize(alephPeerIdB58, ['scratch.*']))
  )


  it('pushes data to a concat node', () => {
    assert(false, 'test in progress... still need to sort out some signature issues')
  })
})
