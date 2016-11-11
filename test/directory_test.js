/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, afterEach } = require('mocha')
const eventually = require('mocha-eventually')

const { loadTestNodeIds, makeNode, makeDirectory } = require('./util')

describe('Directory Node', function () {
  let dir, node, nodeIdB58

  before(() => {
    return loadTestNodeIds().then(nodeIds => {
      const dirId = nodeIds.pop()
      const nodeId = nodeIds.pop()
      nodeIdB58 = nodeId.toB58String()
      dir = makeDirectory({peerId: dirId})
      node = makeNode({peerId: nodeId, dirInfo: dir.peerInfo})
      return Promise.all([dir.start(), node.start()])
    })
  })

  afterEach(() => {
    dir.registeredPeers.removeByB58String(nodeIdB58)
  })

  it('adds a node to its registry in response to a register message', function () {
    // verify that the peer is not registered before the call
    assert.throws(() => {
      dir.registeredPeers.getByB58String(nodeIdB58)
    })

    return node.register()
      .then(eventually(() => {
        const entry = dir.registeredPeers.getByB58String(nodeIdB58)
        assert(entry, 'registered successfully')
      }))
  })

  it('responds to lookup requests for known peers', function () {
    // just stuff the node's id into the directory manually
    dir.registeredPeers.put(node.peerInfo)

    return node.lookup(nodeIdB58)
      .then(peerInfo => {
        assert(peerInfo != null)
        assert.equal(peerInfo.id.toB58String(), nodeIdB58)
      })
  })
})
