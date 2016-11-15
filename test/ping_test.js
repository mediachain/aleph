/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { loadTestNodeIds, makeNode } = require('./util')

describe('Ping', () => {
  let p1, p2
  before(() => loadTestNodeIds().then(nodeIds => {
    p1 = makeNode({peerId: nodeIds.pop()})
    p2 = makeNode({peerId: nodeIds.pop()})
  }))

  it('pings another node directly by PeerInfo', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.ping(p2.peerInfo))
      .then(result => assert(result))
  })
})
