// @flow
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
        const dirInfo = Identity.inflateMultiaddr(dir)
        node.setDirectory(dirInfo)
      }

      return {
        node,
        remote
      }
    })
}

module.exports = {
  bootstrap
}
