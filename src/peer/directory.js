const P2PNode = require('./libp2p_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const Multiaddr = require('multiaddr')
const pull = require('pull-stream')
const pb = require('../protobuf')
const { protoStreamDecode, protoStreamEncode, peerInfoProtoUnmarshal } = require('./util')
import type { Connection } from 'interface-connection'
import type { LookupPeerRequestMsg, LookupPeerResponseMsg } from '../protobuf/types'

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/0')

class DirectoryNode {
  p2p: P2PNode
  registeredPeers: PeerBook

  constructor (peerId: PeerId, listenAddrs: Array<Multiaddr> = [DEFAULT_LISTEN_ADDR]) {
    const peerInfo = new PeerInfo(peerId)
    listenAddrs.forEach((addr: Multiaddr) => {
      peerInfo.multiaddr.add(addr)
    })

    this.p2p = new P2PNode(peerInfo)
    this.registeredPeers = new PeerBook()
    this.p2p.handle('/mediachain/dir/register', this.registerHandler.bind(this))
    this.p2p.handle('/mediachain/dir/lookup', this.lookupHandler.bind(this))
    this.p2p.handle('/mediachain/dir/list', this.listHandler.bind(this))
  }

  start (): Promise<void> {
    return this.p2p.start()
  }

  stop (): Promise<void> {
    return this.p2p.stop()
  }

  get peerInfo (): PeerInfo {
    return this.p2p.peerInfo
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
          }
          return
        }

        if (end) throw end

        if (peerInfo) {
          peerForConn = peerInfo
          this.registeredPeers.put(peerInfo)
        }
        read(null, next)
      })
    }

    const abortable = this.p2p.newAbortable()

    pull(
      conn,
      protoStreamDecode(pb.dir.RegisterPeer),
      pull.map(req => req.info),
      pull.map(peerInfoProtoUnmarshal),
      abortable,
      sink
    )
  }

  lookupHandler (conn: Connection) {
    const abortable = this.p2p.newAbortable()

    pull(
      conn,
      protoStreamDecode(pb.dir.LookupPeerRequest),
      pull.map(req => this._doLookup(req)),
      protoStreamEncode(pb.dir.LookupPeerResponse),
      abortable,
      conn,
    )
  }

  _doLookup (req: LookupPeerRequestMsg): LookupPeerResponseMsg {
    if (req.id == null) {
      return { peer: null }
    }

    try {
      const peerInfo = this.registeredPeers.getByB58String(req.id)
      const peer = {
        id: peerInfo.id.toB58String(),
        addr: peerInfo.multiaddrs.map(maddr => maddr.buffer)
      }
      return {peer}
    } catch (err) {
      return { peer: null }
    }
  }

  listHandler (conn: Connection) {

  }
}

module.exports = DirectoryNode
