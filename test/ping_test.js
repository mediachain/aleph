/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { loadTestNodeIds, makeNode } = require('./util')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')

describe('Ping', function () {
  let p1, p2, invalidPeer
  before(() => loadTestNodeIds().then(nodeIds => {
    p1 = makeNode({peerId: nodeIds.pop()})
    p2 = makeNode({peerId: nodeIds.pop()})
    invalidPeer = PeerInfo(nodeIds.pop())
    invalidPeer.multiaddr.add(Multiaddr('/ip4/1.2.3.4/tcp/4321'))
  }))

  it('pings another node directly by PeerInfo', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.ping(p2.peerInfo))
      .then(result => assert(result))
  })

  it('fails to ping a non-existent node', () => {
    p1.p2p.dialTimeout = 20
    return p1.start()
      .then(() => p1.ping(invalidPeer))
      .catch(err => {
        assert(err != null)
      })
  })
})
