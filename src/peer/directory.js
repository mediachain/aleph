const libp2p = require('./base_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const Multiaddr = require('multiaddr')
const pull = require('pull-stream')
const pb = require('../protobuf')
const { protoStreamDecode, peerInfoProtoUnmarshal } = require('./util')
import type { Connection } from 'interface-connection'

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

  registerHandler (conn: Connection) {
    // for some reason, conn.peerInfo is always null here,
    // so we store the peerInfo from the register message
    let peerForConn: ?PeerInfo = null

    const sink = () => (read: Function) => {
      read(null, function next (end: ?(boolean | Error), peerInfo: ?PeerInfo) {
        if (end === true) {
          if (peerForConn) {
            this.registeredPeers.removeByB58String(peerForConn.id.toB58String())
            return
          }
        }

        if (end) throw end

        if (peerInfo) {
          peerForConn = peerInfo
          this.registeredPeers.put(peerInfo)
        }
        read(null, next)
      })
    }

    pull(
      conn,
      protoStreamDecode(pb.dir.RegisterPeer),
      pull.map(req => req.info),
      pull.map(peerInfoProtoUnmarshal),
      sink
    )
  }

  lookupHandler (conn: Connection) {
    // TODO
  }

  listHandler (conn: Connection) {

  }
}

module.exports = DirectoryNode
