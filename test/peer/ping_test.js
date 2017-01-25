/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { getTestNodeId, makeNode } = require('../util')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Ping = require('libp2p-ping')

describe('Ping', function () {
  let p1, p2, p3, invalidPeer

  before(() => Promise.all([
    makeNode().then(_p1 => { p1 = _p1 }),
    makeNode().then(_p2 => { p2 = _p2 }),
    makeNode().then(_p3 => { p3 = _p3 }),
    getTestNodeId().then(id => {
      invalidPeer = PeerInfo(id)
      invalidPeer.multiaddr.add(Multiaddr('/ip4/1.2.3.4/tcp/4321'))
    })
  ]))

  it('pings another node directly by PeerInfo', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.ping(p2.peerInfo))
      .then(result => assert(result != null))
  })

  it('uses the libp2p-ping protocol (if possible)', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.p2p.ping(p2.peerInfo))
      .then(result => assert.equal(typeof result, 'number', 'libp2p-ping should return latency in ms'))
  })

  it('falls back to mediachain ping if libp2p-ping fails', () => {
    Ping.unmount(p3.p2p.swarm)
    return Promise.all([p1.start(), p3.start()])
      .then(() => p2.ping(p3.peerInfo))
      .then(result => {
        assert(result != null)
      })
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
