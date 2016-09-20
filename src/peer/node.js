const libp2p = require('libp2p-ipfs')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const b58 = require('bs58')
const pb = require('../protobuf')
const pull = require('pull-stream')
const { protobufStream } = require('./util')
const binstring = require('binstring')

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
    let mhash: Buffer
    try {
      mhash = new Buffer(b58.decode(peerId), 'binary')
    } catch (err) {
      return Promise.reject(err)
    }

    const req = pb.dir.LookupPeerRequest.encode({
      id: binstring(mhash, {in: 'buffer', out: 'binary'})
    })

    return new Promise((resolve, reject) => {
      this.dialByPeerInfo(this.directory, '/mediachain/dir/lookup', (err: ?Error, conn: any) => { // TODO: type for conn
        if (err) {
          return reject(err)
        }
        console.log('connected to ', peerId)
        pull(
          protobufStream(req),
          conn,
          pull.through(console.log), // TODO: remove once things are working
          pull.collect((err: ?Error, data: Buffer) => {
            if (err) {
              reject(err)
              return
            }

            const resp = pb.dir.LookupPeerResponse.decode(data)
            const info = lookupResponseToPeerInfo(resp)
            console.log('got lookup response: ', resp)
            console.log('returned peer info: ', info)
            resolve(info)
          }),
        )
      })
    })
  }
}

module.exports = MediachainNode

import type { LookupPeerResponse } from '../protobuf/types'

function lookupResponseToPeerInfo (resp: LookupPeerResponse): ?PeerInfo {
  if (!resp.peer) {
    return null
  }

  const peerId = PeerId.createFromB58String(resp.peer.id)
  const peerInfo = new PeerInfo(peerId)
  resp.peer.addr.forEach((addrBytes: Buffer) => {
    const addr = new Multiaddr(addrBytes)
    peerInfo.multiaddr.add(addr)
  })
  return peerInfo
}
