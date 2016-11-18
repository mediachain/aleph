// @flow

const _ = require('lodash')
const { MediachainNode, RemoteNode } = require('../node')
const Identity = require('../identity')

type BootstrapOpts = {
  identityPath: string,
  remotePeer?: string,
  dir?: string
}

type BootstrapResult = {
  node: MediachainNode,
  remote: ?RemoteNode
}

function bootstrap (opts: BootstrapOpts): Promise<BootstrapResult> {
  const {identityPath, remotePeer, dir} = opts

  return Identity.loadOrGenerateIdentity(identityPath)
    .then(peerId => new MediachainNode({peerId}))
    .then(node => {
      let remote = null
      if (remotePeer != null) {
        const remotePeerInfo = Identity.inflateMultiaddr(remotePeer)
        remote = new RemoteNode(node, remotePeerInfo)
      }

      if (dir != null) {
        node.setDirectory(dir)
      }

      return {
        node,
        remote
      }
    })
}

function binaryToB64 (result: Object): Object {
  const replacer = obj => {
    if (obj instanceof Buffer) {
      return obj.toString('base64')
    }
  }

  return _.cloneDeepWith(result, replacer)
}

module.exports = {
  bootstrap,
  binaryToB64
}
