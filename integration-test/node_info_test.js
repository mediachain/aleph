// @flow
/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { setConcatNodeStatus, concatNodePeerInfo, setConcatNodeInfoMessage } = require('./util')

describe('Node Info', () => {
  let nodeIds = []
  const infoMessage = `I'm a concat test node`

  before(() => {
    return Promise.all([
      loadTestNodeIds().then(res => { nodeIds = res }),
      setConcatNodeInfoMessage(infoMessage)
    ])
  })

  it('retrieves the node ids and info message from a concat node', () => {
    const alephPeer = new AlephNode({peerId: nodeIds.pop()})
    return alephPeer.start()
      .then(() => setConcatNodeStatus('online'))
      .then(() => concatNodePeerInfo())
      .then(concatNodeInfo => alephPeer.remoteNodeInfo(concatNodeInfo))
      .then(result => {
        assert.equal(result.info, infoMessage,
          'node info response should include correct info message'
        )
      })
  })
})
