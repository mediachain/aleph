/* eslint-env mocha */
const chai = require('chai')
chai.use(require('chai-as-promised'))
const { assert, expect } = chai
const { describe, it, before, afterEach } = require('mocha')
const eventually = require('mocha-eventually')
const PeerInfo = require('peer-info')

const { makeNode, makeDirectory } = require('../util')

describe('Directory Node', function () {
  let dir, node, nodeIdB58

  before(() => makeDirectory().then(_dir => { dir = _dir })
    .then(() => makeNode())
    .then(_node => {
      node = _node
      node.setDirectory(dir.peerInfo)
      nodeIdB58 = node.peerInfo.id.toB58String()
    })
    .then(() => Promise.all([node.start(), dir.start()]))
  )

  afterEach(() => {
    dir.peerBook.removeByB58String(nodeIdB58)
  })

  it('adds a node to its registry in response to a register message', function () {
    // verify that the peer is not registered before the call
    expect(dir.getPeerInfo(nodeIdB58)).to.be.null

    return node.register()
      .then(() => eventually((done) => {
        const result = dir.getPeerInfo(nodeIdB58)
        expect(result).to.not.be.null
        expect(result).to.be.an.instanceof(PeerInfo)
        expect(result.id.toB58String()).to.be.eql(nodeIdB58)
        done()
      }))
  })

  it('node can set directory with string multiaddr', () => {
    const dirInfo = dir.p2p.peerInfo
    const dirId = dirInfo.id
    const addrString = dirInfo.multiaddrs[0].toString() + '/p2p/' + dirId.toB58String()
    expect(() =>
      node.setDirectory(addrString)
    ).to.not.throw()

    node.setDirectory(dirInfo)
  })

  it('responds to lookup requests for known peers', function () {
    // just stuff the node's id into the directory manually
    dir.peerBook.put(node.peerInfo)

    return node.lookup(nodeIdB58)
      .then(peerInfo => {
        assert(peerInfo != null)
        assert.equal(peerInfo.id.toB58String(), nodeIdB58)
      })
  })

  it('node throws during lookup & register if no directory is set', () =>
    Promise.resolve()
      .then(() => { node.directory = null })
      .then(() =>
         Promise.all([
           expect(node.lookup(nodeIdB58))
              .to.eventually.be.rejectedWith('No known directory server'),
           expect(node.register())
              .to.eventually.be.rejectedWith('No known directory server')
         ]))
      .then(() => { node.setDirectory(dir.peerInfo) })
  )

  it('node throws if asked to lookup an invalid string or other bogus input', () =>
  Promise.all([
    expect(node.lookup('foo'))
      .to.eventually.be.rejectedWith('not a valid multihash'),
    expect(node.lookup(42))
      .to.eventually.be.rejectedWith('invalid input')
  ])
  )

  it('can lookup by string or PeerId', () => {
    dir.peerBook.put(node.peerInfo)
    return expect(node.lookup(node.peerInfo.id))
      .to.eventually.be.an.instanceof(PeerInfo)
  })

  it('internal _resolvePeer method accepts PeerInfo, multiaddr string', () => {
    dir.peerBook.put(node.peerInfo)

    return Promise.all([
      expect(node._resolvePeer(node.peerInfo))
          .to.eventually.eql(node.peerInfo),

      expect(node._resolvePeer(nodeIdB58))
          .to.eventually.be.an.instanceof(PeerInfo),

      expect(node._resolvePeer('/ip4/127.0.0.1/tcp/1234/p2p/QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Na'))
          .to.eventually.be.an.instanceof(PeerInfo),

      expect(node._resolvePeer('/ip4/not-a-real-multiaddr'))
          .to.eventually.be.rejectedWith('not a valid multiaddr'),

      expect(node._resolvePeer('QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Na'))
          .to.eventually.be.rejectedWith('Unable to locate peer')
    ])
  }
  )
})
