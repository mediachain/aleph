/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { loadTestNodeIds, makeNode } = require('./util')

describe('Node Info', function () {
  const infoMessage = 'tests are great!'

  let p1, p2
  before(() => loadTestNodeIds().then(nodeIds => {
    p1 = makeNode({peerId: nodeIds.pop()})
    p2 = makeNode({peerId: nodeIds.pop(), infoMessage})
  }))

  it('retrieves the ids and info message from another node', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.remoteNodeInfo(p2.peerInfo))
      .then(result => {
        assert.equal(result.peer, p2.peerInfo.id.toB58String(),
          'node info response should include correct peer id')
        assert.equal(result.info, infoMessage,
          'node info response should include correct info message')
      })
  })
})
