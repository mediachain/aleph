// @flow

const Swarm = require('libp2p-swarm')
const TCP = require('libp2p-tcp')
// const UTP = require('libp2p-utp')
const WS = require('libp2p-websockets')
const spdy = require('libp2p-spdy')
const secio = require('libp2p-secio')
const PeerInfo = require('peer-info')
const PeerBook = require('peer-book')
const Ping = require('libp2p-ping')
const Abortable = require('pull-abortable')
const { promiseTimeout } = require('../common/util')

import type { Connection } from 'interface-connection'

const OFFLINE_ERROR_MESSAGE = 'The libp2p node is not started yet'
const DEFAULT_DIAL_TIMEOUT = 10000

/**
 * Options for {@link P2PNode} constructor.
 * @property peerInfo
 *  A libp2p PeerInfo object that identifies a peer.
 *  Must contain at least one valid multiaddr for the node to listen on.
 *
 * @property peerBook
 *  An optional PeerBook object to "pre-seed" the node with mappings from PeerId to PeerInfo.
 *
 * @property disableSecureIO
 *  If true, disables encryption for streams opened by the node. Use for testing only.
 *
 * @property timeout
 *  Timeout in milliseconds to wait when dialing a peer before erroring out.
 *  Default is 10000 (10s) if this option is not present.
 */
type P2PNodeOptions = {
  peerInfo: PeerInfo,
  peerBook?: PeerBook,
  disableSecureIO?: boolean,
  dialTimeout?: number
}

/**
 * An object that acts as a LibP2P peer.  Provides promise-based interfaces
 * for [opening]{@link P2PNode#dialByPeerInfo} and [closing]{@link P2PNode#hangUpByPeerInfo}
 * streams to other peers, as well as [handling named protocols]{@link P2PNode#handle}.
 *
 * A newly-constructed `P2PNode` handles a single protocol, the libp2p standard Ping protocol.
 * You can ping another libp2p node (including IPFS nodes) with {@link P2PNode#ping}.
 *
 * `P2PNode`s begin offline, and you must call {@link P2PNode#start} to take them online.
 *
 * A `PeerInfo` object with at least one multiaddr is required when constructing a `P2PNode`.
 * The node will attempt to listen on all tcp and / or websocket multiaddrs contained in the `PeerInfo`.
 * The node must be listening on a transport in order to dial with it; if no websocket listen
 * addresses are provided, you won't be able to dial to a peer using websockets.  Note that concat
 * nodes only support tcp transports, so that's probably what you want to use.
 *
 */
class P2PNode {
  peerInfo: PeerInfo
  peerBook: PeerBook
  swarm: Swarm
  isOnline: boolean
  abortables: Set<Abortable>
  dialTimeout: number

  /**
   * Create a P2PNode.
   * @param {P2PNodeOptions} options
   */
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

  /**
   * Creates and returns a pull-stream "abortable", which can be
   * added to a pull-stream pipeline to allow aborting the stream
   * at any time. All abortables returned from this method will be
   * aborted when the node is [stopped]{@link P2PNode#stop}
   *
   * @example
   * const abortable = myNode.newAbortable()
   * pull(
   *   connectionToOtherNode,
   *   abortable,
   *   handleLongRunningProcess(),
   * )
   *
   * // later...
   * abortable.abort() // -> closes the stream
   *
   * @returns {Object} a pull-stream abortable.  Call `.abort()` to cancel
   * a stream that passes through the abortable.
   */
  newAbortable (): Abortable {
    const abortable = Abortable()
    this.abortables.add(abortable)
    return abortable
  }

  /**
   * Start the node, bringing it online.  This causes the node to listen on
   * all available transports, and allows the node to dial out to other peers.
   * @returns {Promise<void>} resolves with no value on success, or rejects with an
   * `Error` if the node can't be started.
   */
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

  /**
   * Stop the node, taking it offline.
   * This will cancel any "abortables" returned from {@link P2PNode#newAbortable},
   * and close any open transports.
   *
   * Note that this may take several seconds using the TCP transport, even if there
   * are no streams open.
   * @returns {Promise<void>} resolves with no value on success, or rejects with an `Error`
   * if the node can't be stopped.
   */
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

  /**
   * Set whether to use encrypted streams for communication with other nodes.
   * The default is true, and should usually be left alone. Disabling secure IO
   * is useful during unit testing, where security isn't a concern and the overhead
   * of encryption can slow down test execution.
   *
   * Note that a node with secure IO disabled cannot communicate with a node that
   * requires secure IO.
   */
  setSecureIOEnabled (use: boolean = true) {
    if (use) {
      this.swarm.connection.crypto(secio.tag, secio.encrypt)
    } else {
      this.swarm.connection.crypto()
    }
  }

  /**
   * Connect to a `peer`, opening a stream named by the `protocol` string.
   * @param peer - a `PeerInfo` object with at least one valid multiaddr for the node you want to dial.
   * @param protocol - a string identifying a P2P protocol, e.g. `"/mediachain/node/query"`
   * @returns {Promise<Connection>} resolves to a libp2p Connection, which can be used in a pull-stream.
   */
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

  /**
   * Close all open streams to the given peer.
   * @param peer a `PeerInfo` object identifying a peer with open streams.
   * @returns {Promise} resolves with no value on success, or rejects with an
   * `Error` if one occurs during the hang up operation.
   */
  hangUpByPeerInfo (peer: PeerInfo): Promise<void> {
    if (!this.isOnline) {
      return Promise.reject(new Error(OFFLINE_ERROR_MESSAGE))
    }

    this.peerBook.removeByB58String(peer.id.toB58String())
    return new Promise((resolve) => {
      this.swarm.hangUp(peer, resolve)
    })
  }

  /**
   * Register a `handler` for the named `protocol`.
   * @param protocol - a string identifying a libp2p protocol, e.g. `"/mediachain/node/query"`
   * @param handler - a function that will be called with the name of the protocol and a libp2p Connection
   * for incoming streams.
   */
  handle (protocol: string, handler: (protocol: string, connection: Connection) => void): any {
    return this.swarm.handle(protocol, handler)
  }

  /**
   * Remove any handlers registered for the named `protocol`
   * @param protocol - a string identifying a previously handled protocol.
   */
  unhandle (protocol: string): any {
    return this.swarm.unhandle(protocol)
  }

  /**
   * Send a libp2p Ping message to the given `peer` and wait for a response.
   * @param peer - a `PeerInfo` for a peer, with at least one valid multiaddr.
   * @returns {Promise<number>} - resolves to the latency (in msec), or rejects
   * with an `Error` if the ping fails.
   */
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
