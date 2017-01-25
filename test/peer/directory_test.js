/* eslint-env mocha */

const { assert, expect } = require('chai')
const { describe, it, before, after, afterEach } = require('mocha')
const eventually = require('mocha-eventually')
const PeerInfo = require('peer-info')

const { makeNode, makeDirectory } = require('../util')

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

  it('responds to lookup requests for known peers', function () {
    // just stuff the node's id into the directory manually
    dir.peerBook.put(node.peerInfo)

    return node.lookup(nodeIdB58)
      .then(peerInfo => {
        assert(peerInfo != null)
        assert.equal(peerInfo.id.toB58String(), nodeIdB58)
      })
  })
})
