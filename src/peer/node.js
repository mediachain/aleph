/**
 * @module aleph/peer/node
 */

const { zip } = require('lodash')
const P2PNode = require('./libp2p_node')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Multiaddr = require('multiaddr')
const pb = require('../protobuf')
const pull = require('pull-stream')
const paramap = require('pull-paramap')
const { DEFAULT_LISTEN_ADDR, PROTOCOLS } = require('./constants')
const { inflateMultiaddr } = require('./identity')
const { Datastore } = require('./datastore')
const { StatementDB } = require('./db/index')
const {
  protoStreamEncode,
  protoStreamDecode,
  peerInfoProtoMarshal,
  lookupResponseToPeerInfo,
  pullToPromise,
  pullRepeatedly,
  resultStreamThrough,
  expandStatement
} = require('./util')
const { promiseHash, isB58Multihash } = require('../common/util')
const { pushStatementsToConn } = require('./push')
const { mergeFromStreams } = require('./merge')
const { Statement, SignedStatement } = require('../model/statement')
const { unpackQueryResultProtobuf } = require('../model/query_result')

import type { QueryResult, QueryResultValue } from '../model/query_result'
import type { DataResultMsg, DataObjectMsg, NodeInfoMsg, PushEndMsg } from '../protobuf/types'
import type { Connection } from 'interface-connection'
import type { PullStreamSource } from './util'
import type { DatastoreOptions } from './datastore'
import type { StatementDBOptions } from './db/index'
import type { PublisherId } from './identity'
import type { MergeResult } from './merge'
import type Abortable from 'pull-abortable'

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

/**
 * An object that represents a Mediachain node.
 * Aleph nodes do not have all the features implemented by concat nodes
 * (https://github.com/mediachain/concat)
 *
 * The idea is that an aleph node (often driven interactively at a REPL)
 * can act as a lightweight "client" node for a concat node.
 *
 * Aleph nodes do have a {@link Datastore} and a {@link StatementDB}, but
 * both are currently limited to in-memory usage, allowing an aleph node
 * to serve as a "staging area" for data manipulation before sending to
 * a concat node, which will persist the data.
 *
 * @example
 * const { generateIdentity } = require('aleph/peer/identity')
 *
 * let node
 * generateIdentity()
 *  .then(peerId => { node = new MediachainNode({peerId}) })
 *  .then(() => node.start())
 *  .then(() => node.ping(someOtherNodeId))
 *
 */
class MediachainNode {
  p2p: P2PNode
  datastore: Datastore
  db: StatementDB
  directory: ?PeerInfo
  infoMessage: string
  publisherId: ?PublisherId
  _statementCounter: number

  /**
   * Create a new `MediachainNode`. A `PeerId` is required to identify the node.
   * @param {MediachainNodeOptions} options
   *
   * @param {PeerId} options.peerId
   *  A libp2p PeerId object identifying the node. A PeerId is a representation of the node's
   *  public key.
   *
   * @param {PublisherId=} options.publisherId
   *  A PublisherId object that allows the node to create signed Mediachain statements.
   *  If the node does not have a PublisherId, it can still store and transmit statements
   *  created and signed by other nodes.
   *
   * @param {PeerInfo=} options.dirInfo
   *  The PeerInfo for a directory node, used to lookup public remote peers.
   *  If not provided to the constructor, can be set after the fact with {@link MediachainNode#setDirectory}
   *
   * @param {Array.<Multiaddr | string>=} options.listenAddresses
   *  An array of Multiaddr objects or string-encoded multiaddrs that the node will listen on.
   *  If not given, the node will listen on a randomly chosen available port on the localhost interface.
   *
   * @param {string=} options.infoMessage
   *  A string that will identify the node to the human operators of other peers.
   *  Defaults to "(aleph)"
   *
   * @param {DatastoreOptions=} options.datastoreOptions
   *  Options to be used for creating the node's object datastore.  Defaults to an in-memory
   *  key/value store.
   *
   * @param {StatementDBOptions=} options.statementDBOptions
   *  Options to be used for creating the node's statement database.  Defaults to a DB backed by
   *  a temporary file (unique to each node, not persistent across invocations)
   */
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

  /**
   * Start the node, bringing it online
   * @returns {Promise<void>} A Promise which will resolve with no value on success, or reject with an Error on failure
   */
  start (): Promise<void> {
    return this.p2p.start()
  }

  /**
   * Stop the node, bringing it offline
   * @returns {*|Promise.<void>} A Promise which will resolve with no value on success, or reject with an Error on failure
   */
  stop (): Promise<void> {
    return this.p2p.stop()
  }

  /**
   * @returns {PeerInfo} The `PeerInfo` object that contains the node's id, plus the multiaddrs that the node listens on.
   */
  get peerInfo (): PeerInfo {
    return this.p2p.peerInfo
  }

  /**
   * @returns {number} An auto-incrementing counter that is used when constructing Statements for publication.
   */
  get statementCounter (): number {
    return this._statementCounter++
  }

  /**
   * Set the location of a mediachain directory server that can be used for peer lookups.
   * @param {string | PeerInfo} dirInfo
   *  Either a `PeerInfo` object containing at least one valid multiaddr, or a valid string-encoded
   *  multiaddr with either the `/ipfs/` or `/p2p/` protocol components.
   *
   * @example
   *  // with a string-encoded multiaddr
   *  myNode.setDirectory('/ip4/52.7.126.237/tcp/9000/p2p/QmSdJVceFki4rDbcSrW7JTJZgU9so25Ko7oKHE97mGmkU6')
   *
   *  // with a PeerInfo object
   *  const PeerId = require('peer-id')
   *  const PeerInfo = require('peer-info')
   *  const dirId = PeerId.createFromB58String('QmSdJVceFki4rDbcSrW7JTJZgU9so25Ko7oKHE97mGmkU6')
   *  const dirInfo = new PeerInfo(dirId)
   *  dirInfo.multiaddr.add('/ip4/52.7.126.237/tcp/9000')
   *
   *  myNode.setDirectory(dirInfo)
   */
  setDirectory (dirInfo: PeerInfo | string) {
    if (typeof dirInfo === 'string') {
      dirInfo = inflateMultiaddr(dirInfo)
    }
    this.directory = dirInfo
  }

  /**
   * Set the node's "info message", a short string that identifies the node to humans.
   * The info message is returned by the node in response to a mediachain "id" request.
   * @param {string} message
   */
  setInfoMessage (message: string) {
    this.infoMessage = message
  }

  /**
   * Register the node with the configured directory server (see {@link MediachainNode#setDirectory})
   * Note that the node will send a new registration message as a "heartbeat", at five minute intervals after
   * the initial registration.  If you want to cancel the registration stream, call `.abort()` on the
   * pull-stream Abortable that the `.register()` promise resolves to.
   *
   * @returns {Promise<Abortable>} resolves with an "abortable" object that you can call `.abort()` on to cancel
   *   the registration heartbeat stream.
   */
  register (): Promise<Abortable> {
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
          conn
        )
        return abortable
      })
  }

  /**
   * Lookup a peer by string-encoded multihash id or `PeerId` object,
   * returning a `PeerInfo` object if the peer could be found.
   * @param {string | PeerId} peerId
   *  Either a libp2p PeerId object, or a base58-encoded multihash string that identifies a peer.
   *
   * @returns {Promise<?PeerInfo>}
   *  Resolves to a `PeerInfo` object with at least one valid listen address, or to `null` if the
   *  peer could not be located.
   *  Rejects with an `Error` if lookup fails entirely due to e.g. a network failure or invalid input.
   */
  lookup (peerId: string | PeerId): Promise<?PeerInfo> {
    return Promise.resolve().then(() => {
      if (peerId instanceof PeerId) {
        peerId = peerId.toB58String()
      } else if (typeof peerId !== 'string') {
        throw new Error(`invalid input: lookup requires a PeerId or base58-encoded multihash string`)
      }

      if (!isB58Multihash(peerId)) {
        throw new Error('Peer id is not a valid multihash')
      }

      // If we've already got an entry for this PeerId in our PeerBook,
      // because we already have a multiplex connection open to this peer,
      // use the existing entry.
      //
      // Note that when we close the peer multiplex connection, then entry is
      // automatically removed from the peer book, so we should never be returning
      // stale results.
      try {
        return this.p2p.peerBook.getByB58String(peerId)
      } catch (err) {
      }

      if (this.directory == null) {
        // TODO: support DHT lookups
        throw new Error('No known directory server, cannot lookup')
      }

      return this.p2p.dialByPeerInfo(this.directory, PROTOCOLS.dir.lookup)
        .then(conn => pullToPromise(
          pull.values([ { id: peerId } ]),
          protoStreamEncode(pb.dir.LookupPeerRequest),
          conn,
          protoStreamDecode(pb.dir.LookupPeerResponse),
          pull.map(lookupResponseToPeerInfo),
          )
        )
    })
  }

  /**
   * Internal helper used when opening connections to another peer.
   * If `peer` is a `PeerInfo` object, it is assumed to be valid and returned directly.
   * If `peer` is a string-encoded multiaddr, we attempt to convert it to a `PeerInfo` object.
   * Otherwise, returns the result of {@link MediachainNode#lookup}
   * @param {PeerInfo | PeerId | string} peer
   * @returns {Promise<?PeerInfo>}
   *  Resolves to a `PeerInfo` object with at least one valid listen address, or to `null` if the
   *  peer could not be located.
   *  Rejects with an `Error` if lookup fails entirely due to e.g. a network failure or invalid input.
   * @private
   */
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

  /**
   * Similar to {@link MediachainNode#_lookupIfNeeded}, but rejects with an error if the peer
   * cannot be found.
   * @param {PeerInfo | PeerId | string} peer
   * @returns {Promise<PeerInfo>}
   *  Resolves to a `PeerInfo` object with at least one valid listen address.
   *  Rejects with an `Error` if the peer cannot be found, or if lookup fails entirely
   *  due to e.g. a network failure or invalid input.
   * @private
   */
  _resolvePeer (peer: PeerInfo | PeerId | string): Promise<PeerInfo> {
    return this._lookupIfNeeded(peer)
      .then(maybePeer => {
        if (!maybePeer) throw new Error(`Unable to locate peer ${peer}`)
        return maybePeer
      })
  }

  /**
   * Open a new stream to the given `peer` using the named `protocol`
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} protocol
   *  A string identifying a libp2p protocol, e.g. `"/mediachain/node/query"`
   *
   * @returns {Promise.<Connection>}
   *  Resolves to a libp2p Connection which can be used in a pull-stream.
   *  Rejects with an error if the peer cannot be found, or e.g. a network error occurs.
   */
  openConnection (peer: PeerInfo | PeerId | string, protocol: string): Promise<Connection> {
    return this._resolvePeer(peer)
      .then(peerInfo => this.p2p.dialByPeerInfo(peerInfo, protocol))
  }

  /**
   * Send a "ping" message to the given `peer`, returning the latency between "ping" and "pong" in milliseconds.
   * @param {PeerInfo | PeerId | string} peer
   * @returns {Promise<number>}
   *  Latency between sending "ping" and receiving "pong", in milliseconds.
   */
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

  /**
   * Protocol handler for mediachain "ping" protocol.
   * Deprecated in favor of libp2p ping protocol, handled by {@link P2PNode} class.
   * @param {string} protocol
   * @param {Connection} conn
   */
  pingHandler (protocol: string, conn: Connection) {
    pull(
      conn,
      protoStreamDecode(pb.node.Ping),
      protoStreamEncode(pb.node.Pong),
      conn
    )
  }

  /**
   * Protocol handler for mediachain "id" protocol.
   * Responds to incoming "id" requests with the node's PeerId, PublisherId (if any), and info message.
   * @param {string} protocol
   * @param {Connection} conn
   */
  idHandler (protocol: string, conn: Connection) {
    const response = {
      peer: this.peerInfo.id.toB58String(),
      info: this.infoMessage
    }
    if (this.publisherId != null) {
      response.publisher = this.publisherId.id58
    }

    pull(
      conn,
      protoStreamDecode(pb.node.NodeInfoRequest),
      pull.map(() => response),
      protoStreamEncode(pb.node.NodeInfo),
      conn
    )
  }

  /**
   * Sends a mediachain "id" request to the remote node.
   * @param {PeerInfo | PeerId | string} peer
   * @returns {Promise<NodeInfoMsg>}
   */
  remoteNodeInfo (peer: PeerInfo | PeerId | string): Promise<NodeInfoMsg> {
    return this.openConnection(peer, PROTOCOLS.node.id)
      .then(conn => pullToPromise(
        pull.once({}),
        protoStreamEncode(pb.node.NodeInfoRequest),
        conn,
        protoStreamDecode(pb.node.NodeInfo)
      ))
  }

  /**
   * Sends a MCQL query string to the remote node, and returns a pull-stream "source" that
   * can read query results.
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} queryString
   * @returns {Promise<PullStreamSource<QueryResult>>}
   *  Resolves to a pull-stream "source", which can be used to read query results off of the stream.
   *
   * @see {@link MediachainNode#remoteQuery} for non-streaming version.
   */
  remoteQueryStream (peer: PeerInfo | PeerId | string, queryString: string): Promise<PullStreamSource> {
    return this.openConnection(peer, PROTOCOLS.node.query)
      .then(conn => pull(
          pull.values([{query: queryString}]),
          protoStreamEncode(pb.node.QueryRequest),
          conn,
          protoStreamDecode(pb.node.QueryResult),
          resultStreamThrough,
          pull.map(r => unpackQueryResultProtobuf(r))
        ))
  }

  /**
   * Sends a MCQL query string to the remote node, and returns an Array of `QueryResult`s.
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} queryString
   * @returns {Promise<Array<QueryResult>>}
   * @see {@link MediachainNode#remoteQueryStream} for streaming version.
   */
  remoteQuery (peer: PeerInfo | PeerId | string, queryString: string): Promise<Array<QueryResult>> {
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

  /**
   * Sends a request for data objects to the remote node, identified by the given `keys`.
   * Returns an Array of `DataResultMsg` objects, which contain key/value pairs for each
   * key requested.
   * @param {PeerInfo | PeerId | string} peer
   * @param {Array<string>} keys
   *  Array of base58-encoded multihash strings.
   * @returns {Promise<Array<DataResultMsg>>}
   * @see {@link MediachainNode#remoteDataStream} for streaming version.
   */
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

  /**
   * Sends a request for data objects to the remote node, identified by the given `keys`.
   * Returns an pull-stream "source" of `DataResultMsg` objects, which contain key/value pairs for each
   * key requested.
   * @param {PeerInfo | PeerId | string}peer
   * @param {Array<string>} keys
   *  Array of base58-encoded multihash strings.
   * @returns {Promise<PullStreamSource<DataObjectMsg>>}
   *  A pull-stream "source" that can be used to read `DataObjectMsg` objects off of the stream.
   * @see {@link MediachainNode#remoteData} for non-streaming version.
   */
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

  /**
   * Not implemented! Will someday parse MCQL queries and return results from local statement db.
   * @param {string} queryString
   * @throws Always!
   */
  query (queryString: string): Promise<Array<QueryResult>> {
    throw new Error('Local MCQL queries are not implemented!')
  }

  /**
   * Add the given data objects to the node's {@link Datastore}.
   * @param {Array<Object | Buffer>} vals
   *  Each value should be either a `Buffer` full of binary data, or a JS object that can be serialized to CBOR.
   * @returns {Promise<Array<string>>}
   *  Resolves to an array of keys (base58-encoded multihash strings) that can be used to fetch the objects.
   */
  putData (...vals: Array<Object | Buffer>): Promise<Array<string>> {
    return Promise.all(
      vals.map(val => this.datastore.put(val))
    )
  }

  /**
   * Looks up the given `keys` in the node's {@link Datastore}, returning the results
   * as an array of `DataObjectMsg` key/value pair objects.
   * @param {...string} keys
   *  One or more base58-encoded multihash keys for the objects to retrieve
   * @returns {Promise<Array<DataObjectMsg>>}
   */
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

  /**
   * Protocol handler for the mediachain "data" protocol.
   * Accepts requests for data from peers and responds with `DataResultMsg` objects
   * containing either a `DataObjectMsg` or `StreamErrorMsg`
   * @param {string} protocol
   * @param {Connection} conn
   */
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

  /**
   * Sends a MCQL `queryString` to the remote `peer`.  For each Statement received, also fetches the associated
   * data objects referred to in the Statement and "expands" the statement body, so that the data objects are
   * available embedded within the Statement.
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} queryString
   * @returns {Promise<PullStreamSource<QueryResult>>}
   *  A pull-stream "source" that can be used to read QueryResults (with expanded statements) from the stream.
   * @see {@link MediachainNode#remoteQueryWithData} for non-streaming version.
   */
  remoteQueryWithDataStream (peer: PeerInfo | PeerId | string, queryString: string): Promise<PullStreamSource> {
    return this.remoteQueryStream(peer, queryString)
      .then(resultStream =>
        pull(
          resultStream,
          paramap((queryResult, cb) => {
            this._expandQueryResultData(peer, queryResult)
              .then(result => cb(null, result))
              .catch(err => cb(err))
          })
        )
      )
  }

  /**
   * Sends a MCQL `queryString` to the remote `peer`.  For each Statement received, also fetches the associated
   * data objects referred to in the Statement and "expands" the statement body, so that the data objects are
   * available embedded within the Statement.
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} queryString
   * @returns {Promise<Array<QueryResult>>}
   *  Resolves to an array of QueryResults (with expanded statements) when the query completes and all results are received.
   * @see {@link MediachainNode#remoteQueryWithData} for streaming version.
   */
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

  /**
   * Internal helper for {@link MediachainNode#remoteQueryWithDataStream}
   * @param {PeerInfo | PeerId | string} peer
   * @param {QueryResultValue} result
   * @returns {Promise<QueryResultValue>}
   * @private
   */
  _expandQueryResultData (peer: PeerInfo | PeerId | string, result: QueryResultValue): Promise<QueryResultValue> {
    if (!(result instanceof Statement)) return Promise.resolve(result)
    const stmt: Statement = result
    if (stmt.objectIds.length < 1) return Promise.resolve(result)

    return this.remoteData(peer, stmt.objectIds)
      .then((dataResults: Array<DataObjectMsg>) =>
        expandStatement(stmt, dataResults)
      )
  }

  /**
   * Send an MCQL `queryString` to the remote `peer`, merging the statements and objects returned into the local
   * datastore and statement db.
   * @param {PeerInfo | PeerId | string} peer
   * @param {string} queryString
   * @returns {Promise<MergeResult>}
   */
  merge (peer: PeerInfo | PeerId | string, queryString: string): Promise<MergeResult> {
    return this.remoteQueryStream(peer, queryString)
      .then(queryStream => promiseHash({
        queryStream,
        dataConn: this.openConnection(peer, PROTOCOLS.node.data)
      }))
      .then(({queryStream, dataConn}) => mergeFromStreams(this, queryStream, dataConn))
  }

  /**
   * Push the given `Statement`s to the remote `peer`.
   * Will fail if this node has not been authorized to push to the namespaces referred to in the statements.
   * @param {PeerInfo | PeerId | string} peer
   * @param {Array<Statement>} statements
   * @returns {Promise<PushEndMsg>}
   */
  pushStatements (peer: PeerInfo | PeerId | string, statements: Array<Statement>): Promise<PushEndMsg> {
    return this.openConnection(peer, PROTOCOLS.node.push)
      .then(conn => pushStatementsToConn(statements, conn))
  }

  /**
   * Push the statements with the given `statementIds` to the remote `peer`.
   * The identified statements must exist in the node's statement db prior to pushing.
   * Will fail if this node has not been authorized to push to the namespaces referred to in the statements.
   * @param {PeerInfo | PeerId | string} peer
   * @param {Array<string>} statementIds
   * @returns {Promise<PushEndMsg>}
   */
  pushStatementsById (peer: PeerInfo | PeerId | string, statementIds: Array<string>): Promise<PushEndMsg> {
    return Promise.all(statementIds.map(id => this.db.get(id)))
      .then(statements => this.pushStatements(peer, statements))
  }

  /**
   * Creates a `SignedStatement` from the given `object` and `meta`-data, signed with the node's `PublisherId`
   * Will fail if the node does not have a `PublisherId`
   * @param {string} namespace
   * @param {Object} object
   * @param {Object} meta
   * @param {Array<string>} meta.refs
   *  The "well known identifiers" or external ids for the subject of the statement.
   * @param {Array<string>} [meta.deps = []]
   *  Multihash references for other data objects the statement depends on, e.g. because they are linked to from
   *  inside the main data object.
   * @param {Array<string>} [meta.tags = []]
   *  String "tags" used to surface keywords for indexing the statement.
   * @returns {Promise<string>}
   *  The created Statement's `id` string, which can be used to fetch the statement from the node's statement db.
   */
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
        return SignedStatement.createSimple(publisherId, namespace, body, this.statementCounter)
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

  query (queryString: string): Promise<Array<QueryResult>> {
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
