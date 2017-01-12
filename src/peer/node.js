const { zip } = require('lodash')
const P2PNode = require('./libp2p_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const Multihash = require('multihashes')
const pb = require('../protobuf')
const pull = require('pull-stream')
const paramap = require('pull-paramap')
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
const { promiseHash } = require('../common/util')
const { pushStatementsToConn } = require('./push')
const { mergeFromStreams } = require('./merge')
const { makeSimpleStatement } = require('../metadata/statement')

import type { QueryResultMsg, QueryResultValueMsg, DataResultMsg, DataObjectMsg, NodeInfoMsg, StatementMsg, PushEndMsg } from '../protobuf/types'
import type { Connection } from 'interface-connection'
import type { PullStreamSource } from './util'
import type { DatastoreOptions } from './datastore'
import type { StatementDBOptions } from './db/statement-db'
import type { PublisherId } from './identity'
import type { MergeResult } from './merge'

export type MediachainNodeOptions = {
  peerId: PeerId,
  publisherId: ?PublisherId,
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
  publisherId: ?PublisherId
  _statementCounter: number

  constructor (options: MediachainNodeOptions) {
    let {peerId, publisherId, dirInfo, listenAddresses} = options
    if (listenAddresses == null) listenAddresses = [DEFAULT_LISTEN_ADDR]

    const peerInfo = new PeerInfo(peerId)
    listenAddresses.forEach((addr: Multiaddr | string) => {
      peerInfo.multiaddr.add(Multiaddr(addr))
    })

    const datastoreOptions = (options.datastoreOptions != null)
      ? options.datastoreOptions
      : { backend: 'memory', location: '/aleph/data-' + peerId.toB58String() }

    this.publisherId = publisherId
    this.datastore = new Datastore(datastoreOptions)
    this.db = new StatementDB(options.statementDBOptions)

    this.infoMessage = options.infoMessage || DEFAULT_INFO_MESSAGE

    this.p2p = new P2PNode({peerInfo})
    this.directory = dirInfo
    this.p2p.handle(PROTOCOLS.node.ping, this.pingHandler.bind(this))
    this.p2p.handle(PROTOCOLS.node.id, this.idHandler.bind(this))
    this.p2p.handle(PROTOCOLS.node.data, this.dataHandler.bind(this))
    this._statementCounter = 0
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

  get statementCounter (): number {
    return this._statementCounter++
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
      // TODO: support DHT lookups
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

  _resolvePeer (peer: PeerInfo | PeerId | string): Promise<PeerInfo> {
    return this._lookupIfNeeded(peer)
      .then(maybePeer => {
        if (!maybePeer) throw new Error(`Unable to locate peer ${peer}`)
        return maybePeer
      })
  }

  openConnection (peer: PeerInfo | PeerId | string, protocol: string): Promise<Connection> {
    return this._resolvePeer(peer)
      .then(peerInfo => this.p2p.dialByPeerInfo(peerInfo, protocol))
  }

  ping (peer: PeerInfo | PeerId | string): Promise<number> {
    let timestamp: number
    let latency: number

    return this._resolvePeer(peer)
      .then(peerInfo => this.p2p.ping(peerInfo))

      // fall-back to deprecated mediachain ping protocol if remote node
      // doesn't support libp2p ping
      .catch(_err => this.openConnection(peer, PROTOCOLS.node.ping))
      .then((conn: Connection) => pullToPromise(
        pull.values([{}]),
        protoStreamEncode(pb.node.Ping),
        pull.through(() => { timestamp = Date.now() }),
        conn,
        pull.through(() => { latency = Date.now() - timestamp }),
        protoStreamDecode(pb.node.Pong),
        pull.map(_ => { return latency })
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

  // local queries (MCQL parser NOT IMPLEMENTED)
  query (queryString: string): Promise<Array<QueryResultMsg>> {
    throw new Error('Local MCQL queries are not implemented!')
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

  merge (peer: PeerInfo | PeerId | string, queryString: string): Promise<MergeResult> {
    return this.remoteQueryStream(peer, queryString)
      .then(queryStream => promiseHash({
        queryStream,
        dataConn: this.openConnection(peer, PROTOCOLS.node.data)
      }))
      .then(({queryStream, dataConn}) => mergeFromStreams(this, queryStream, dataConn))
  }

  pushStatements (peer: PeerInfo | PeerId | string, statements: Array<StatementMsg>): Promise<PushEndMsg> {
    return this.openConnection(peer, PROTOCOLS.node.push)
      .then(conn => pushStatementsToConn(statements, conn))
  }

  pushStatementsById (peer: PeerInfo | PeerId | string, statementIds: Array<string>): Promise<PushEndMsg> {
    return Promise.all(statementIds.map(id => this.db.get(id)))
      .then(statements => this.pushStatements(peer, statements))
  }

  ingestSimpleStatement (namespace: string, object: Object, meta: {
    refs: Array<string>,
    deps?: Array<string>,
    tags?: Array<string>
  })
  : Promise<string> {
    if (this.publisherId == null) {
      return Promise.reject('Node does not have a publisher id, cannot create statements')
    }

    let publisherId = this.publisherId
    const {refs, deps, tags} = meta
    return this.putData(object)
      .then(([objectHash]) => {
        const body = {object: objectHash, refs, deps, tags}
        return makeSimpleStatement(publisherId, namespace, body, this.statementCounter)
      })
      .then(stmt => this.db.put(stmt)
        .then(() => stmt.id))
  }
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
