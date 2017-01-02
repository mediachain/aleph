const { zip } = require('lodash')
const P2PNode = require('./libp2p_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Multihash = require('multihashes')
const pb = require('../protobuf')
const pull = require('pull-stream')
const paramap = require('pull-paramap')
const lp = require('pull-length-prefixed')
const locks = require('locks')
const { DEFAULT_LISTEN_ADDR, PROTOCOLS } = require('./constants')
const { inflateMultiaddr } = require('./identity')
const { Datastore } = require('./datastore')
const { StatementDB } = require('./db/statement-db')
const {
  protoStreamEncode,
  protoStreamDecode,
  peerInfoProtoMarshal,
  lookupResponseToPeerInfo,
  pullToPromise,
  pullRepeatedly,
  resultStreamThrough,
  objectIdsForQueryResult,
  expandQueryResult
} = require('./util')

import type { QueryResultMsg, QueryResultValueMsg, DataResultMsg, DataObjectMsg, NodeInfoMsg, StatementMsg, PushEndMsg } from '../protobuf/types'
import type { Connection } from 'interface-connection'
import type { PullStreamSource } from './util'
import type { DatastoreOptions } from './datastore'
import type { StatementDBOptions } from './db/statement-db'

export type MediachainNodeOptions = {
  peerId: PeerId,
  dirInfo?: PeerInfo,
  listenAddresses?: Array<Multiaddr | string>,
  infoMessage?: string,
  datastoreOptions?: DatastoreOptions,
  statementDBOptions?: StatementDBOptions,
}

const DEFAULT_INFO_MESSAGE = '(aleph)'

class MediachainNode {
  p2p: P2PNode
  datastore: Datastore
  db: StatementDB
  directory: ?PeerInfo
  infoMessage: string

  constructor (options: MediachainNodeOptions) {
    let {peerId, dirInfo, listenAddresses} = options
    if (listenAddresses == null) listenAddresses = [DEFAULT_LISTEN_ADDR]

    const peerInfo = new PeerInfo(peerId)
    listenAddresses.forEach((addr: Multiaddr | string) => {
      peerInfo.multiaddr.add(Multiaddr(addr))
    })

    this.datastore = new Datastore(options.datastoreOptions)
    this.db = new StatementDB(options.statementDBOptions)

    this.infoMessage = options.infoMessage || DEFAULT_INFO_MESSAGE

    this.p2p = new P2PNode({peerInfo})
    this.directory = dirInfo
    this.p2p.handle(PROTOCOLS.node.ping, this.pingHandler.bind(this))
    this.p2p.handle(PROTOCOLS.node.id, this.idHandler.bind(this))
    this.p2p.handle(PROTOCOLS.node.data, this.dataHandler.bind(this))
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

  setDirectory (dirInfo: PeerInfo | string) {
    if (typeof dirInfo === 'string') {
      dirInfo = inflateMultiaddr(dirInfo)
    }
    this.directory = dirInfo
  }

  setInfoMessage (message: string) {
    this.infoMessage = message
  }

  register (): Promise<boolean> {
    if (this.directory == null) {
      return Promise.reject(new Error('No known directory server, cannot register'))
    }

    const abortable = this.p2p.newAbortable()

    const req = {
      info: peerInfoProtoMarshal(this.p2p.peerInfo)
    }

    return this.p2p.dialByPeerInfo(this.directory, PROTOCOLS.dir.register)
      .then(conn => {
        pull(
          pullRepeatedly(req, 5000 * 60),
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

    // If we've already got an entry for this PeerId in our PeerBook,
    // because we already have a multiplex connection open to this peer,
    // use the existing entry.
    //
    // Note that when we close the peer multiplex connection, then entry is
    // automatically removed from the peer book, so we should never be returning
    // stale results.
    try {
      const peerInfo = this.p2p.peerBook.getByB58String(peerId)
      return Promise.resolve(peerInfo)
    } catch (err) {
    }

    if (this.directory == null) {
      return Promise.reject(new Error('No known directory server, cannot lookup'))
    }

    return this.p2p.dialByPeerInfo(this.directory, PROTOCOLS.dir.lookup)
      .then(conn => pullToPromise(
        pull.values([{id: peerId}]),
        protoStreamEncode(pb.dir.LookupPeerRequest),
        conn,
        protoStreamDecode(pb.dir.LookupPeerResponse),
        pull.map(lookupResponseToPeerInfo),
        )
      )
  }

  _lookupIfNeeded (peer: PeerInfo | PeerId | string): Promise<?PeerInfo> {
    if (peer instanceof PeerInfo) {
      return Promise.resolve(peer)
    }
    if (typeof peer === 'string' && peer.startsWith('/')) {
      // try to decode as multiaddr. If it doesn't start with '/', it may be resolvable
      // as a multihash peer id via lookup()
      try {
        const peerInfo = inflateMultiaddr(peer)
        return Promise.resolve(peerInfo)
      } catch (err) {
        return Promise.reject(new Error(`Peer id is not a valid multiaddr: ${err.message}`))
      }
    }

    return this.lookup(peer)
  }

  openConnection (peer: PeerInfo | PeerId | string, protocol: string): Promise<Connection> {
    return this._lookupIfNeeded(peer)
      .then(maybePeer => {
        if (!maybePeer) throw new Error(`Unable to locate peer ${peer}`)
        return maybePeer
      })
      .then(peerInfo => this.p2p.dialByPeerInfo(peerInfo, protocol))
  }

  ping (peer: PeerInfo | PeerId | string): Promise<boolean> {
    return this.openConnection(peer, PROTOCOLS.node.ping)
      .then((conn: Connection) => pullToPromise(
        pull.values([{}]),
        protoStreamEncode(pb.node.Ping),
        conn,
        protoStreamDecode(pb.node.Pong),
        pull.map(_ => { return true })
      ))
  }

  pingHandler (protocol: string, conn: Connection) {
    pull(
      conn,
      protoStreamDecode(pb.node.Ping),
      protoStreamEncode(pb.node.Pong),
      conn
    )
  }

  idHandler (protocol: string, conn: Connection) {
    const response = {
      peer: this.peerInfo.id.toB58String(),
      info: this.infoMessage
    }

    pull(
      conn,
      protoStreamDecode(pb.node.NodeInfoRequest),
      pull.map(() => response),
      protoStreamEncode(pb.node.NodeInfo),
      conn
    )
  }

  remoteNodeInfo (peer: PeerInfo | PeerId | string): Promise<NodeInfoMsg> {
    return this.openConnection(peer, PROTOCOLS.node.id)
      .then(conn => pullToPromise(
        pull.once({}),
        protoStreamEncode(pb.node.NodeInfoRequest),
        conn,
        protoStreamDecode(pb.node.NodeInfo)
      ))
  }

  remoteQueryStream (peer: PeerInfo | PeerId | string, queryString: string): Promise<PullStreamSource> {
    return this.openConnection(peer, PROTOCOLS.node.query)
      .then(conn => pull(
          pull.values([{query: queryString}]),
          protoStreamEncode(pb.node.QueryRequest),
          conn,
          protoStreamDecode(pb.node.QueryResult),
          resultStreamThrough,
        ))
  }

  remoteQuery (peer: PeerInfo | PeerId | string, queryString: string): Promise<Array<QueryResultMsg>> {
    return this.remoteQueryStream(peer, queryString)
      .then(stream => new Promise((resolve, reject) => {
        pull(
          stream,
          pull.collect((err, results) => {
            if (err) return reject(err)
            resolve(results)
          })
        )
      }))
  }

  remoteData (peer: PeerInfo | PeerId | string, keys: Array<string>): Array<DataResultMsg> {
    return this.remoteDataStream(peer, keys)
      .then(stream => new Promise((resolve, reject) => {
        pull(
          stream,
          pull.collect((err, results) => {
            if (err) return reject(err)
            resolve(results)
          })
        )
      }))
  }

  remoteDataStream (peer: PeerInfo | PeerId | string, keys: Array<string>): Promise<PullStreamSource> {
    return this.openConnection(peer, PROTOCOLS.node.data)
      .then(conn => pull(
        pull.once({keys}),
        protoStreamEncode(pb.node.DataRequest),
        conn,
        protoStreamDecode(pb.node.DataResult),
        resultStreamThrough,
        pull.map(result => result.data)
      ))
  }

  // local queries (NOT IMPLEMENTED -- NO LOCAL STORE)
  query (queryString: string): Promise<Array<QueryResultMsg>> {
    throw new Error('Local statement _db not implemented!')
  }

  putData (...vals: Array<Object | Buffer>): Promise<Array<string>> {
    return Promise.all(
      vals.map(val => this.datastore.put(val))
    )
  }

  data (...keys: Array<string>): Promise<Array<DataObjectMsg>> {
    const valuePromises = keys.map(k => this.datastore.get(k, {returnRawBuffer: true}))
    return Promise.all(valuePromises)
      .then(vals => {
        const kvs = zip(keys, vals)
        return kvs.map(([key, data]) => ({
          key,
          data
        }))
      })
  }

  dataHandler (protocol: string, conn: Connection) {
    pull(
      // read data request from stream and decode
      conn,
      protoStreamDecode(pb.node.DataRequest),
      pull.through(req => console.log('data request: ', req)),
      // make sure we close the stream when the node stops
      this.p2p.newAbortable(),

      // convert each request into a stream of keys, followed by a StreamEnd message object
      pull.map(req => [...req.keys, {end: {}}]),
      pull.flatten(),

      // fetch values from the datastore, returning them in the same order as the input
      paramap((keyOrEnd: string | Object, callback) => {
        if (typeof keyOrEnd === 'object' && keyOrEnd.end !== undefined) {
          return callback(null, keyOrEnd)
        }

        const key: string = keyOrEnd
        this.datastore.get(key, {returnRawBuffer: true})
          .catch(err => {
            callback(null, {error: {error: err.message}})
          })
          .then(data => {
            callback(null, {data: {key, data}})
          })
      }),

      pull.through(resp => console.log('sending data response: ', resp)),
      // encode to DataResult protobuf and send on the wire
      protoStreamEncode(pb.node.DataResult),
      conn
    )
  }

  remoteQueryWithDataStream (peer: PeerInfo | PeerId | string, queryString: string): Promise<PullStreamSource> {
    return this.remoteQueryStream(peer, queryString)
      .then(resultStream =>
        pull(
          resultStream,
          paramap((queryResult, cb) => {
            if (queryResult.value == null) {
              return cb(null, queryResult)
            }

            this._expandQueryResultData(peer, queryResult.value)
              .then(result => cb(null, result))
              .catch(err => cb(err))
          })
        )
      )
  }

  remoteQueryWithData (peer: PeerInfo | PeerId | string, queryString: string): Promise<Array<Object>> {
    return this.remoteQueryWithDataStream(peer, queryString)
      .then(stream => new Promise((resolve, reject) => {
        pull(
          stream,
          pull.collect((err, results) => {
            if (err) return reject(err)
            resolve(results)
          })
        )
      }))
  }

  _expandQueryResultData (peer: PeerInfo | PeerId | string, result: QueryResultValueMsg): Promise<Object> {
    const objectIds = objectIdsForQueryResult(result)
    if (objectIds.length < 1) return Promise.resolve(result)

    return this.remoteData(peer, objectIds)
      .then((dataResults: Array<DataObjectMsg>) =>
        expandQueryResult(result, dataResults)
      )
  }

  pushStatements (peer: PeerInfo | PeerId | string, statements: Array<StatementMsg>): Promise<PushEndMsg> {
    return this.openConnection(peer, PROTOCOLS.node.push)
      .then(conn =>
        pullToPromise(
          pushStatementsToConn(statements, conn)
        )
      )
  }

  pushStatementsById (peer: PeerInfo | PeerId | string, statementIds: Array<string>): Promise<*> {
    return Promise.all(statementIds.map(id => this.db.get(id)))
      .then(statements => this.pushStatements(peer, statements))
  }
}

/**
 * "Driver" function for pushing statements to a remote peer.
 * The push protocol works like this:
 * - We send a PushRequest message that enumerates all the namespaces for each statement we want to push.
 * - The peer sends a PushResponse with either a PushAccept, or PushReject message, depending on whether we're
 *   sufficiently authorized.
 * - If the request is accepted, the peer opens a data stream to our node, to request data objects referenced in the
 *   statements.
 * - We send a PushValue message for each statement, containing the statement message, followed by a PushValue "end" message.
 * - The peer sends a PushEnd message containing counts for statements and objects they merged, plus an error message if
 *   an error occured.
 * @param statements - an array of Statement messages to push to the peer.  Statements must be properly signed, or the remote
 *                     peer will reject them.
 * @param conn - an open libp2p Connection to the remote peer's /mediachain/node/push handler
 * @returns {*}
 */
function pushStatementsToConn (statements: Array<Object>, conn: Connection): PullStreamSource<*> {
  // build the PushRequest message
  const namespaces: Set<string> = new Set()
  for (const stmt of statements) {
    namespaces.add(stmt.namespace)
  }
  const req = {namespaces: Array.from(namespaces)}

  // state variables
  let requestSent = false
  let sentEndMessage = false
  let handshakeReceived = locks.createCondVariable(false)

  // a pull-stream source that sends three kinds of messages, depending on the current state:
  // - PushRequest is sent first, containing namespaces we want to push to
  // Assuming the request is accepted:
  // - PushValue with `stmt` field filled out is sent for each statement
  // - PushValue with `end` field filled out is sent to signal end of stream
  const writer = (end, callback) => {
    if (end) return callback(end)

    // first, send the initial request
    if (!requestSent) {
      requestSent = true
      console.log('sending push request: ', req)
      return callback(null, pb.node.PushRequest.encode(req))
    }

    // wait for the reader to handle the PushResponse handshake.
    // handshakeReceived is a "condition variable": the wait fn executes its second argument
    // once the first argument returns true.
    handshakeReceived.wait(
      val => val === true,
      () => {
        // if we're out of statements, and haven't already done so send the final PushValue "end" message
        // to signal the end of the stream
        if (!sentEndMessage && statements.length < 1) {
          sentEndMessage = true
          const msg = { end: {} }
          console.log('sending push end message: ', msg)
          return callback(null, pb.node.PushValue.encode(msg))
        }

        // if we have statements, pop one from the head of the array and send it, wrapped in a PushValue
        const stmt = statements.pop()
        if (stmt != null) {
          const msg = { stmt }
          console.log('sending push value message: ', msg)
          return callback(null, pb.node.PushValue.encode(msg))
        }
      }
    )
  }

  // a pull-stream through function that reads PushResponse and PushEnd messages from the remote peer.
  // If the PushResponse is a rejection, the stream will be closed with an Error.  Otherwise, we'll
  // wait until we get a PushEnd message and send it downstream.
  const reader = read => (end, callback) => {
    read(end, (end, data) => {
      if (end) return callback(end)

      // read the initial PushResponse message from the peer
      if (!handshakeReceived.get()) {
        const handshake = pb.node.PushResponse.decode(data)
        console.log('got push handshake: ', handshake)

        // if we got a rejection, close the stream with an error, passing along the message from the peer
        if (handshake.reject !== undefined) {
          return callback(new Error(handshake.reject.error))
        }
        // set the condition variable so the writer will start sending messages
        handshakeReceived.set(true)

        // read the PushEnd message from the peer and send it down the line
        read(null, (end, data) => {
          if (end) return callback(end)
          const pushEnd = pb.node.PushEnd.decode(data)
          return callback(null, pushEnd)
        })
      }
    })
  }

  // return a pull-stream source that's composed of our writer -> conn -> reader pipeline.
  // the lp.encode() and lp.decode() functions are used to segment the length-prefixed messages
  // from the raw byte stream exposed by the connection.  This is handled automatically by the
  // protoStreamEncode / Decode helpers, but we can't use those here since we need to produce / accept
  // multiple message types in each handler.
  return pull(
    writer,
    lp.encode(),
    conn,
    lp.decode(),
    reader,
    pull.through(resp => console.log('push response: ', resp))
  )
}

class RemoteNode {
  node: MediachainNode
  remotePeerInfo: PeerInfo

  constructor (node: MediachainNode, remotePeerInfo: PeerInfo) {
    this.node = node
    this.remotePeerInfo = remotePeerInfo
  }

  ping (): Promise<boolean> {
    return this.node.ping(this.remotePeerInfo)
  }

  query (queryString: string): Promise<Array<QueryResultMsg>> {
    return this.node.remoteQuery(this.remotePeerInfo, queryString)
  }

  data (keys: Array<string>): Array<DataResultMsg> {
    return this.node.remoteData(this.remotePeerInfo, keys)
  }

  queryWithData (queryString: string): Promise<Array<Object>> {
    return this.node.remoteQueryWithData(this.remotePeerInfo, queryString)
  }
}

module.exports = {
  MediachainNode,
  RemoteNode
}
