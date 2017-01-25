// @flow

const Swarm = require('libp2p-swarm')
const TCP = require('libp2p-tcp')
// const UTP = require('libp2p-utp')
const WS = require('libp2p-websockets')
const spdy = require('libp2p-spdy')
const secio = require('libp2p-secio')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const multiaddr = require('multiaddr')
const Ping = require('libp2p-ping')
const mafmt = require('mafmt')
const Abortable = require('pull-abortable')
const { promiseTimeout } = require('../common/util')

import type { Connection } from 'interface-connection'

const OFFLINE_ERROR_MESSAGE = 'The libp2p node is not started yet'
const DEFAULT_DIAL_TIMEOUT = 10000

type P2PNodeOptions = {
  peerInfo: PeerInfo,
  peerBook?: PeerBook,
  disableSecureIO?: boolean,
  dialTimeout?: number
}

class P2PNode {
  peerInfo: PeerInfo
  peerBook: PeerBook
  swarm: Swarm
  isOnline: boolean
  abortables: Set<Abortable>
  dialTimeout: number

  constructor (options: P2PNodeOptions) {
    let {peerInfo, peerBook, disableSecureIO, dialTimeout} = options
    this.isOnline = false
    this.dialTimeout = (dialTimeout != null) ? dialTimeout : DEFAULT_DIAL_TIMEOUT

    if (!peerBook) peerBook = new PeerBook()

    if (!disableSecureIO) disableSecureIO = false

    this.peerInfo = peerInfo
    this.peerBook = peerBook

    // Swarm
    this.swarm = new Swarm(peerInfo)
    this.swarm.connection.addStreamMuxer(spdy)
    this.swarm.connection.reuse()

    this.setSecureIOEnabled(!disableSecureIO)

    this.swarm.on('peer-mux-established', (peerInfo) => {
      this.peerBook.put(peerInfo)
    })

    this.swarm.on('peer-mux-closed', (peerInfo) => {
      this.peerBook.removeByB58String(peerInfo.id.toB58String())
    })

    Ping.mount(this.swarm)

    this.abortables = new Set()
  }

  newAbortable (): Abortable {
    const abortable = Abortable()
    this.abortables.add(abortable)
    return abortable
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

    return new Promise((resolve, reject) => {
      // abort any ongoing pull-stream connections
      this.abortables.forEach(a => { a.abort() })
      this.abortables.clear()

      this.swarm.close((err) => {
        if (err) return reject(err)
        this.isOnline = false
        resolve()
      })
    })
  }

  setSecureIOEnabled (use: boolean = true) {
    if (use) {
      this.swarm.connection.crypto(secio.tag, secio.encrypt)
    } else {
      this.swarm.connection.crypto()
    }
  }

  dialByPeerInfo (peer: PeerInfo, protocol: string): Promise<Connection> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    const dialPromise = new Promise((resolve, reject) => {
      this.swarm.dial(peer, protocol, (err, conn) => {
        if (err) {
          return reject(err)
        }
        this.peerBook.put(peer)
        resolve(conn)
      })
    })

    return promiseTimeout(this.dialTimeout, dialPromise)
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

  ping (peer: PeerInfo): Promise<number> {
    const pingPromise = new Promise((resolve, reject) => {
      const p = new Ping(this.swarm, peer)
      p.on('error', err => {
        p.stop()
        reject(err)
      })

      p.on('ping', latency => {
        p.stop()
        resolve(latency)
      })
    })
    return promiseTimeout(this.dialTimeout, pingPromise)
  }
}

module.exports = P2PNode
