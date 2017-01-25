// @flow

const { expect } = require('chai')
const { before, describe, it } = require('mocha')
const { getTestNodeId } = require('../util')
const pull = require('pull-stream')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const P2PNode = require('../../src/peer/libp2p_node')

describe('LibP2P Node base class', () => {
  let id1, id2

  before(() => Promise.all([
    getTestNodeId().then(_id1 => { id1 = _id1 }),
    getTestNodeId().then(_id2 => { id2 = _id2 })
    ]
  ))

  it('works with websockets', () => {
    const info1 = new PeerInfo(id1)
    const info2 = new PeerInfo(id2)
    info1.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9090/ws'))
    info2.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9091/ws'))

    const node1 = new P2PNode({peerInfo: info1})
    const node2 = new P2PNode({peerInfo: info2})
    return Promise.all([node1.start(), node2.start()])
      .then(() => node1.ping(node2.peerInfo))
      .then(result => {
        expect(result).to.exist
      })
      .then(() => node1.hangUpByPeerInfo(node2.peerInfo))
      .then(() => Promise.all([node1.stop(), node2.stop()]))
  })

  it('throws if you try to dial when not online', () => {
    const info1 = new PeerInfo(id1)
    const info2 = new PeerInfo(id2)
    info1.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9090'))
    info2.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9091'))

    const node1 = new P2PNode({peerInfo: info1})
    return node1.dialByPeerInfo(info2, 'foo-protocol')
      .catch(err => {
        expect(err.message).to.be.eql('The libp2p node is not started yet')
      })
  })

  it('start/stop are idempotent', () => {
    const info = new PeerInfo(id1)
    info.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9094'))

    const node = new P2PNode({peerInfo: info})
    expect(node.isOnline).to.eql(false)
    return node.start()
      .then(() => {
        expect(node.isOnline).to.eql(true)
        return node.start()
      })
      .then(() => node.stop())
      .then(() => {
        expect(node.isOnline).to.eql(false)
        node.stop()
      })
  })

  it('aborts long-lived listeners on stop', () => {
    const info = new PeerInfo(id1)
    info.multiaddr.add(Multiaddr('/ip4/127.0.0.1/tcp/9095'))

    const node = new P2PNode({peerInfo: info})
    const abortable = node.newAbortable()
    let aborted = false
    abortable((end, cb) => {
      aborted = end
      cb(end)
    })
    expect(node.abortables.size).to.be.eql(1)

    return node.start()
      .then(() => node.stop())
      .then(() => {
        expect(node.abortables.size).to.be.eql(0)
        expect(aborted).to.be.eql(true)
      })
  })
})
