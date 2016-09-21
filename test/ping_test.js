/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { generateIdentity } = require('../src/peer/identity')
const Node = require('../src/peer/node')
const Multiaddr = require('multiaddr')

describe('Ping', () => {
  const p1 = new Node(generateIdentity(), null, [Multiaddr('/ip4/127.0.0.1/tcp/9876')])
  const p2 = new Node(generateIdentity(), null, [Multiaddr('/ip4/127.0.0.1/tcp/9875')])

  it('pings another node directly by PeerInfo', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.ping(p2.peerInfo))
      .then(result => assert(result))
  })
})
