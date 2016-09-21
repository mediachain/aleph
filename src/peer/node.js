const libp2p = require('libp2p-ipfs')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Multihash = require('multihashes')
const pb = require('../protobuf')
const pull = require('pull-stream')
const { protoStreamSource, protoStreamThrough, lookupResponseToPeerInfo } = require('./util')

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

  lookup (peerId: string): Promise<PeerInfo> {
    try {
      Multihash.fromB58String(peerId)
    } catch (err) {
      return Promise.reject(new Error(`Peer id is not a valid multihash: ${err.message}`))
    }

    const Request = pb.dir.LookupPeerRequest
    const Response = pb.dir.LookupPeerResponse

    return new Promise((resolve, reject) => {
      this.dialByPeerInfo(this.directory, '/mediachain/dir/lookup', (err: ?Error, conn: any) => { // TODO: type for conn
        if (err) {
          return reject(err)
        }
        pull(
          protoStreamSource(Request.encode, { id: peerId }),
          conn,
          protoStreamThrough(Response.decode),
          pull.map(lookupResponseToPeerInfo),
          pull.take(1),
          pull.drain(resolve)
        )
      })
    })
  }

  ping (peerId: string): Promise<boolean> {
    return this.lookup(peerId).then((peerInfo) => new Promise((resolve, reject) => {
      this.dialByPeerInfo(peerInfo, '/mediachain/node/ping', (err: ?Error, conn: any) => {
        if (err) {
          return reject(err)
        }

        const Request = pb.node.Ping
        const Response = pb.node.Pong

        console.log('sending ping')
        pull(
          protoStreamSource(Request.encode, {}),
          conn,
          protoStreamThrough(Response.decode),
          pull.take(1),
          pull.drain(() => { resolve(true) })
        )
      })
    }))
  }
}

module.exports = MediachainNode
