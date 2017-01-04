// @flow
/* eslint-env mocha */

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { getTestNodeId } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { setConcatNodeStatus, concatNodePeerInfo, setConcatNodeInfoMessage } = require('./util')

describe('Node Info', () => {
  let nodeId
  const infoMessage = `I'm a concat test node`

  before(() => {
    return Promise.all([
      getTestNodeId().then(id => { nodeId = id }),
      setConcatNodeInfoMessage(infoMessage)
    ])
  })

  it('retrieves the node ids and info message from a concat node', () => {
    const alephPeer = new AlephNode({peerId: nodeId})
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
