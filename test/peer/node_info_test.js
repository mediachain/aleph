/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { makeNode } = require('../util')

describe('Node Info', function () {
  const infoMessage = 'tests are great!'

  let p1, p2
  before(() => Promise.all([
    makeNode({listenAddresses: ['/ip4/127.0.0.1/tcp/9090/ws']}).then(_p1 => { p1 = _p1 }),
    makeNode({listenAddresses: ['/ip4/127.0.0.1/tcp/9091/ws']}).then(_p2 => { p2 = _p2; p2.setInfoMessage(infoMessage) })
  ]))

  it('retrieves the ids and info message from another node', () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p1.remoteNodeInfo(p2.peerInfo))
      .then(result => {
        assert.equal(result.peer, p2.peerInfo.id.toB58String(),
          'node info response should include correct peer id')
        assert.equal(result.info, infoMessage,
          'node info response should include correct info message')
      })
      .then(() => Promise.all([p1.stop(), p2.stop()]))
  })
})
