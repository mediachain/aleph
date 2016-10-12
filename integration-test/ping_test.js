// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const nodeIds = loadTestNodeIds()
const AlephNode = require('../src/peer/node')
const { setConcatNodeStatus, concatNodePeerInfo } = require('./util')

describe('Ping', () => {
  const alephPeer = new AlephNode({peerId: nodeIds.pop()})

  it('pings a concat node directly by PeerInfo', () => {
    return alephPeer.start()
      .then(() => setConcatNodeStatus('online'))
      .then(() => concatNodePeerInfo())
      .then(concatNodeInfo => alephPeer.ping(concatNodeInfo))
      .then(result => assert(result))
  })
})
