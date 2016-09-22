// @flow

const Swarm = require('libp2p-swarm')
const TCP = require('libp2p-tcp')
// const UTP = require('libp2p-utp')
const WS = require('libp2p-websockets')
const spdy = require('libp2p-spdy')
const secio = require('libp2p-secio')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const multiaddr = require('multiaddr')
const mafmt = require('mafmt')

import type { Connection } from 'interface-connection'

const OFFLINE_ERROR_MESSAGE = 'The libp2p node is not started yet'
const IPFS_CODE = 421

class Node {
  peerInfo: PeerInfo
  peerBook: PeerBook
  swarm: Swarm
  isOnline: boolean

  constructor (pInfo: ?PeerInfo, pBook: ?PeerBook) {
    if (!pInfo) {
      pInfo = new PeerInfo()
      pInfo.multiaddr.add(multiaddr('/ip4/0.0.0.0/tcp/0'))
    }

    if (!pBook) {
      pBook = new PeerBook()
    }

    this.peerInfo = pInfo
    this.peerBook = pBook

    this.peerInfo = pInfo
    this.peerBook = pBook

    // Swarm
    this.swarm = new Swarm(pInfo)
    this.swarm.connection.addStreamMuxer(spdy)
    this.swarm.connection.reuse()

    this.swarm.connection.crypto(secio.tag, secio.encrypt)

    this.swarm.on('peer-mux-established', (peerInfo) => {
      this.peerBook.put(peerInfo)
    })

    this.swarm.on('peer-mux-closed', (peerInfo) => {
      this.peerBook.removeByB58String(peerInfo.id.toB58String())
    })

    this.isOnline = false
  }

  start (): Promise<void> {
    if (this.isOnline) return Promise.resolve()

    const ws = new WS()
    const tcp = new TCP()

    // Do not activate the dialer if no listener is going to be present
    if (ws.filter(this.peerInfo.multiaddrs).length > 0) {
      this.swarm.transport.add('ws', new WS())
    }
    if (tcp.filter(this.peerInfo.multiaddrs).length > 0) {
      this.swarm.transport.add('tcp', new TCP())
    }

    return new Promise((resolve, reject) => {
      this.swarm.listen((err) => {
        if (err) {
          return reject(err)
        }

        this.isOnline = true
        resolve()
      })
    })
  }

  stop (): Promise<void> {
    if (!this.isOnline) return Promise.resolve()

    this.isOnline = false
    return new Promise(resolve => {
      this.swarm.close(() => {
        resolve()
      })
    })
  }

  dialById (id: PeerId, protocol: string): Promise<Connection> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }
    // NOTE, these dialById only works if a previous dial
    // was made until we have PeerRouting
    // TODO support PeerRouting when it is Ready
    return Promise.reject(new Error('not implemented yet'))
  }

  dialByMultiaddr (maddr: multiaddr, protocol: string): Promise<Connection> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    if (typeof maddr === 'string') {
      maddr = multiaddr(maddr)
    }

    if (!mafmt.IPFS.matches(maddr.toString())) {
      return Promise.reject(new Error('multiaddr not valid'))
    }

    const ipfsIdB58String = maddr.stringTuples().filter((tuple) => {
      if (tuple[0] === IPFS_CODE) {
        return true
      }
    })[0][1]

    let peer
    try {
      peer = this.peerBook.getByB58String(ipfsIdB58String)
    } catch (err) {
      peer = new PeerInfo(PeerId.createFromB58String(ipfsIdB58String))
    }

    peer.multiaddr.add(maddr)
    return this.dialByPeerInfo(peer, protocol)
  }

  dialByPeerInfo (peer: PeerInfo, protocol: string): Promise<Connection> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    return new Promise((resolve, reject) => {
      this.swarm.dial(peer, protocol, (err, conn) => {
        if (err) {
          return reject(err)
        }
        this.peerBook.put(peer)
        resolve(conn)
      })
    })
  }

  hangUpById (id: PeerId): Promise<void> {
    return Promise.reject(new Error('not implemented yet'))
    // TODO
  }

  hangUpByMultiaddr (maddr: multiaddr): Promise<void> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    if (typeof maddr === 'string') {
      maddr = multiaddr(maddr)
    }

    if (!mafmt.IPFS.matches(maddr.toString())) {
      return Promise.reject(new Error('multiaddr not valid'))
    }

    const ipfsIdB58String = maddr.stringTuples().filter((tuple) => {
      if (tuple[0] === IPFS_CODE) {
        return true
      }
    })[0][1]

    try {
      const pi = this.peerBook.getByB58String(ipfsIdB58String)
      return this.hangUpByPeerInfo(pi)
    } catch (err) {
      // already disconnected
      return Promise.resolve()
    }
  }

  hangUpByPeerInfo (peer: PeerInfo): Promise<void> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    this.peerBook.removeByB58String(peer.id.toB58String())
    return new Promise((resolve) => {
      this.swarm.hangUp(peer, resolve)
    })
  }

  handle (protocol: string, handler: Function): any {
    return this.swarm.handle(protocol, handler)
  }

  unhandle (protocol: string): any {
    return this.swarm.unhandle(protocol)
  }
}

module.exports = Node
