const libp2p = require('./base_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Multihash = require('multihashes')
const pb = require('../protobuf')
const pull = require('pull-stream')
const { protoStreamSource, protoStreamThrough, lookupResponseToPeerInfo, pullToPromise } = require('./util')

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/9002')

class MediachainNode extends libp2p.Node {
  directory: PeerInfo

  constructor (peerId: PeerId, dirInfo: PeerInfo, listenAddrs: Array<Multiaddr> = [DEFAULT_LISTEN_ADDR]) {
    const peerInfo = new PeerInfo(peerId)
    listenAddrs.forEach((addr: Multiaddr) => {
      peerInfo.multiaddr.add(addr)
    })

    super(peerInfo)
    this.directory = dirInfo
  }

  lookup (peerId: string | PeerId): Promise<PeerInfo> {
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

    const Request = pb.dir.LookupPeerRequest
    const Response = pb.dir.LookupPeerResponse

    return this.dialByPeerInfo(this.directory, '/mediachain/dir/lookup')
      .then(conn => pullToPromise(
        protoStreamSource(Request.encode, {id: peerId}),
        conn,
        protoStreamThrough(Response.decode),
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

    const Request = pb.node.Ping
    const Response = pb.node.Pong

    return peerInfoPromise
      .then(peerInfo => {
        return this.dialByPeerInfo(peerInfo, '/mediachain/node/ping')
      })
      .then(conn => pullToPromise(
        protoStreamSource(Request.encode, {}),
        conn,
        protoStreamThrough(Response.decode),
        pull.map(_ => { return true })
      ))
  }
}

module.exports = MediachainNode
