/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { generateIdentity } = require('../src/peer/identity')
const Directory = require('../src/peer/directory')
const Node = require('../src/peer/node')

describe('Directory Node', () => {
  it('adds a node to its registry in response to a register message', () => {
    const dirId = generateIdentity()
    const dir = new Directory(dirId)
    const dirInfo = dir.peerInfo
    const nodeId = generateIdentity()
    const nodeIdB58 = nodeId.toB58String()
    const node = new Node(nodeId, dirInfo)

    // verify that the peer is not registered before the call
    assert.throws(() => {
      dir.registeredPeers.getByB58String(nodeIdB58)
    })

    return Promise.all([dir.start(), node.start()])  // start node and directory
      .then(conn => node.register())  // register the node
      .then(() => {  // verify that the peer's id is in the registry
        const entry = dir.registeredPeers.getByB58String(nodeIdB58)
        assert(entry, 'registered successfully')
      })
  })
})
