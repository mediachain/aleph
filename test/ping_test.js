/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const Node = require('../src/peer/node')
const { loadTestNodeIds } = require('./util')
const nodeIds = loadTestNodeIds()

describe('Ping', () => {
  const p1 = new Node(nodeIds.pop())
  const p2 = new Node(nodeIds.pop())

  it('pings another node directly by PeerInfo', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.ping(p2.peerInfo))
      .then(result => assert(result))
  })
})
