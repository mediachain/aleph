// @flow

const { MediachainNode: Node } = require('../src/peer/node')
const Directory = require('../src/peer/directory')
const config = require('./config')
const thenify = require('thenify')
const PeerId = require('peer-id')
const path = require('path')

const createFromJSON = thenify(PeerId.createFromJSON)
const nodeIdObjects = require('./resources/test_node_ids.json')
const testNodeIds = Promise.all(nodeIdObjects.map(id => createFromJSON(id)))

function getTestNodeId (): Promise<PeerId> {
  return testNodeIds.then(ids => {
    const id = ids.pop()
    if (id == null) {
      throw new Error(
      'Out of pre-generated test ids! You should make some more and put them in ' +
      path.join(__dirname, 'resources', 'test_node_ids.json')
    )
    }
    return id
  })
}

function makeNode (options: Object = {}): Promise<Node> {
  return getTestNodeId().then(peerId => {
    const nodeOptions = Object.assign({peerId}, options)
    const node = new Node(nodeOptions)
    node.p2p.setSecureIOEnabled(config.secureIOEnabled)
    return node
  })
}

function makeDirectory (options: Object): Promise<Directory> {
  return getTestNodeId().then(peerId => {
    const dirOptions = Object.assign({peerId}, options)
    const dir = new Directory(dirOptions)
    dir.p2p.setSecureIOEnabled(config.secureIOEnabled)
    return dir
  })
}

module.exports = {
  getTestNodeId,
  makeNode,
  makeDirectory
}
