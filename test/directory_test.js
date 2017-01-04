/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before, afterEach } = require('mocha')
const eventually = require('mocha-eventually')

const { makeNode, makeDirectory } = require('./util')

describe('Directory Node', function () {
  let dir, node, nodeIdB58

  before(() => makeDirectory().then(_dir => { dir = _dir })
    .then(() => makeNode({dirInfo: dir.peerInfo}))
    .then(_node => {
      node = _node
      nodeIdB58 = node.peerInfo.id.toB58String()
    })
    .then(() => Promise.all([node.start(), dir.start()]))
  )

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
