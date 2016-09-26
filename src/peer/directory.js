const libp2p = require('./base_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const Multiaddr = require('multiaddr')

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/9000')

class DirectoryNode extends libp2p.Node {
  registeredPeers: PeerBook

  constructor (peerId: PeerId, listenAddrs: Array<Multiaddr> = [DEFAULT_LISTEN_ADDR]) {
    const peerInfo = new PeerInfo(peerId)
    listenAddrs.forEach((addr: Multiaddr) => {
      peerInfo.multiaddr.add(addr)
    })

    super(peerInfo)
    this.registeredPeers = new PeerBook()
    this.handle('/mediachain/dir/register', this.registerHandler.bind(this))
    this.handle('/mediachain/dir/lookup', this.lookupHandler.bind(this))
    this.handle('/mediachain/dir/list', this.listHandler.bind(this))
  }

  registerHandler (conn: Function) {
    // TODO
  }

  lookupHandler (conn: Function) {
    // TODO
  }

  listHandler (conn: Function) {

  }
}

module.exports = DirectoryNode
