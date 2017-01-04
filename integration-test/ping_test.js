// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { setConcatNodeStatus, concatNodePeerInfo, concatNodePeerId, directoryPeerInfo } = require('./util')

describe('Ping', () => {
  it('pings a concat node directly by PeerInfo', () => {
    let alephPeer

    return getTestNodeId()
      .then(peerId => { alephPeer = new AlephNode({peerId}) })
      .then(() => alephPeer.start())
      .then(() => setConcatNodeStatus('online'))
      .then(() => concatNodePeerInfo())
      .then(concatNodeInfo => alephPeer.ping(concatNodeInfo))
      .then(result => assert(result != null, 'ping failed'))
  })

  it('pings a concat node via a directory lookup', () => {
    let alephPeer
    return getTestNodeId()
      .then(peerId => { alephPeer = new AlephNode({peerId}) })
      .then(() => directoryPeerInfo())
      .then(dirInfo => alephPeer.setDirectory(dirInfo))
      .then(() => alephPeer.start())
      .then(() => setConcatNodeStatus('public'))
      .then(() => concatNodePeerId())
      .then(peerId => alephPeer.ping(peerId))
      .then(result => assert(result != null, 'ping failed'))
  })
})
