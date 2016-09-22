const BaseNode = require('./base_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Multihash = require('multihashes')
const pb = require('../protobuf')
const pull = require('pull-stream')
const {
  protoStreamEncode,
  protoStreamDecode,
  lookupResponseToPeerInfo,
  pullToPromise,
  pullRepeatedly
} = require('./util')

import type { Connection } from 'interface-connection'

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/9002')

class MediachainNode extends BaseNode {
  directory: PeerInfo

  constructor (peerId: PeerId, dirInfo: PeerInfo, listenAddrs: Array<Multiaddr> = [DEFAULT_LISTEN_ADDR]) {
    const peerInfo = new PeerInfo(peerId)
    listenAddrs.forEach((addr: Multiaddr) => {
      peerInfo.multiaddr.add(addr)
    })

    super(peerInfo)
    this.directory = dirInfo
    this.handle('/mediachain/node/ping', this.pingHandler.bind(this))
  }

  register (): Promise<boolean> {
    const abortable = this.newAbortable()

    return this.dialByPeerInfo(this.directory, '/mediachain/dir/register')
      .then((conn: Connection) => {
        pull(
          pullRepeatedly({
            info: {id: this.peerInfo.id.toB58String()}
          }, 5000),
          abortable,
          protoStreamEncode(pb.dir.RegisterPeer),
          conn,
          pull.onEnd(() => {
            console.log('registration connection ended')
          })
        )
        return true
      })
  }

  lookup (peerId: string | PeerId): Promise<?PeerInfo> {
    if (peerId instanceof PeerId) {
      peerId = peerId.toB58String()
    } else {
      // validate that string arguments are legit multihashes
      try {
        Multihash.fromB58String(peerId)
      } catch (err) {
        return Promise.reject(new Error(`Peer id is not a valid multihash: ${err.message}`))
      }
    }

    return this.dialByPeerInfo(this.directory, '/mediachain/dir/lookup')
      .then((conn: Connection) => pullToPromise(
        pull.values([{id: peerId}]),
        protoStreamEncode(pb.dir.LookupPeerRequest),
        conn,
        protoStreamDecode(pb.dir.LookupPeerResponse),
        pull.map(lookupResponseToPeerInfo),
        )
      )
  }

  ping (peer: string | PeerInfo | PeerId): Promise<boolean> {
    let peerInfoPromise: Promise<PeerInfo>
    if (peer instanceof PeerInfo) {
      peerInfoPromise = Promise.resolve(peer)
    } else {
      peerInfoPromise = this.lookup(peer)
    }

    return peerInfoPromise
      .then(peerInfo => this.dialByPeerInfo(peerInfo, '/mediachain/node/ping'))
      .then((conn: Connection) => pullToPromise(
        pull.values([{}]),
        protoStreamEncode(pb.node.Ping),
        conn,
        protoStreamDecode(pb.node.Pong),
        pull.map(_ => { return true })
      ))
  }

  pingHandler (conn: Connection) {
    pull(
      conn,
      protoStreamDecode(pb.node.Ping),
      protoStreamEncode(pb.node.Pong),
      conn
    )
  }
}

module.exports = MediachainNode
