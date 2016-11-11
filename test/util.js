// @flow

const Node = require('../src/peer/node')
const Directory = require('../src/peer/directory')
const config = require('./config')
const thenify = require('thenify')
const PeerId = require('peer-id')

import type { MediachainNodeOptions } from '../src/peer/node'
import type { DirectoryNodeOptions } from '../src/peer/directory'

function loadTestNodeIds (): Promise<Array<PeerId>> {
  const ids = require('./resources/test_node_ids.json')
  const createFromJSON = thenify(PeerId.createFromJSON)
  return Promise.all(ids.map((el, pos, array) => createFromJSON(el)))
}

function makeNode (options: MediachainNodeOptions): Node {
  const node = new Node(options)
  node.p2p.setSecureIOEnabled(config.secureIOEnabled)
  return node
}

function makeDirectory (options: DirectoryNodeOptions): Directory {
  const dir = new Directory(options)
  dir.p2p.setSecureIOEnabled(config.secureIOEnabled)
  return dir
}

module.exports = {
  loadTestNodeIds,
  makeNode,
  makeDirectory
}
