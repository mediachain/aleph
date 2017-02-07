const P2PNode = require('./libp2p_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const Multiaddr = require('multiaddr')
const pull = require('pull-stream')
const { values } = require('lodash')
const pb = require('../protobuf')
const { protoStreamDecode, protoStreamEncode, peerInfoProtoUnmarshal } = require('./util')
const { DEFAULT_LISTEN_ADDR, PROTOCOLS } = require('./constants')
const { isB58Multihash } = require('../common/util')

import type { Connection } from 'interface-connection'
import type { LookupPeerRequestMsg, LookupPeerResponseMsg } from '../protobuf/types'

export type DirectoryNodeOptions = {
  peerId: PeerId,
  listenAddresses: Array<Multiaddr | string>
}

class DirectoryNode {
  p2p: P2PNode
  peerBook: PeerBook

  constructor (options: DirectoryNodeOptions) {
    let { peerId, listenAddresses } = options
    if (listenAddresses == null) listenAddresses = [DEFAULT_LISTEN_ADDR]

    const peerInfo = new PeerInfo(peerId)
    listenAddresses.forEach((addr: Multiaddr | string) => {
      peerInfo.multiaddr.add(Multiaddr(addr))
    })

    this.p2p = new P2PNode({peerInfo})
    this.peerBook = new PeerBook()
    this.p2p.handle(PROTOCOLS.dir.register, this.registerHandler.bind(this))
    this.p2p.handle(PROTOCOLS.dir.lookup, this.lookupHandler.bind(this))
    this.p2p.handle(PROTOCOLS.dir.list, this.listHandler.bind(this))
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

  get registeredPeers (): Array<PeerInfo> {
    return values(this.peerBook.getAll())
  }

  getPeerInfo (peerId: PeerId | string): ?PeerInfo {
    let peerId58
    if (typeof peerId === 'string' && isB58Multihash(peerId)) {
      peerId58 = peerId
    } else if (peerId instanceof PeerId) {
      peerId58 = peerId.toB58String()
    } else {
      throw new Error('getPeerInfo needs a PeerId or base58-encoded multihash')
    }

    try {
      return this.peerBook.getByB58String(peerId58)
    } catch (err) {
      return null
    }
  }

  registerHandler (protocol: string, conn: Connection) {
    conn.getPeerInfo((err, pInfo) => {
      if (err) {
        console.error('Error getting peer info for connection:', err)
        return
      }

      const abortable = this.p2p.newAbortable()
      pull(
        conn,
        protoStreamDecode(pb.dir.RegisterPeer),
        pull.map(req => req.info),
        pull.map(peerInfoProtoUnmarshal),
        pull.through(reqInfo => {
          this.peerBook.put(reqInfo)
        }),
        abortable,
        pull.drain()
      )
    })
  }

  lookupHandler (protocol: string, conn: Connection) {
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
      const peerInfo = this.peerBook.getByB58String(req.id)
      const peer = {
        id: peerInfo.id.toB58String(),
        addr: peerInfo.multiaddrs.map(maddr => maddr.buffer)
      }
      return {peer}
    } catch (err) {
      return { peer: null }
    }
  }

  listHandler (protocol: string, conn: Connection) {

  }
}

module.exports = DirectoryNode
