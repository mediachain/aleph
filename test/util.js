// @flow

const { MediachainNode: Node } = require('../src/peer/node')
const Directory = require('../src/peer/directory')
const config = require('./config')
const thenify = require('thenify')
const PeerId = require('peer-id')
const path = require('path')
const pull = require('pull-stream')

const pb = require('../src/protobuf')
const { protoStreamEncode, protoStreamDecode } = require('../src/peer/util')
const createFromJSON = thenify(PeerId.createFromJSON)
const nodeIdObjects = require('./resources/test_node_ids.json')
const testNodeIds = Promise.all(nodeIdObjects.map(id => createFromJSON(id)))

import type { Connection } from 'interface-connection'
import type { QueryResultMsg } from '../src/protobuf/types'

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

/**
 * Respond to any query with the given QueryResult messages.
 * Should be added to an aleph node with
 * `node.p2p.handle(PROTOCOLS.node.query, mockQueryHandler(results)`
 *
 * @param results - the query results, including any `StreamEnd` or `StreamError` messages
 */
const mockQueryHandler = (results: Array<QueryResultMsg>) => (protocol: string, conn: Connection) => pull(
  conn,
  protoStreamDecode(pb.node.QueryRequest),
  pull.map(() => results),
  pull.flatten(),
  protoStreamEncode(pb.node.QueryResult),
  conn
)

module.exports = {
  getTestNodeId,
  makeNode,
  makeDirectory,
  mockQueryHandler
}
