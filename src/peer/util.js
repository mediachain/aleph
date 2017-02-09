// @flow

/**
 * @module peer/util
 */

const pull = require('pull-stream')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const lp = require('pull-length-prefixed')
const {decode} = require('../metadata/serialize')

import type { Statement } from '../model/statement'
import type { PeerInfoMsg, LookupPeerResponseMsg, ProtoCodec, QueryResultMsg, DataResultMsg, DataObjectMsg } from '../protobuf/types' // eslint-disable-line no-unused-vars

// Flow signatures for pull-streams
export type PullStreamCallback<T> = (end: ?mixed, value?: ?T) => void
export type PullStreamSource<T> = (end: ?mixed, cb: PullStreamCallback<T>) => void
export type PullStreamSink<T> = (source: PullStreamSource<T>) => void
export type PullStreamThrough<T, U> = (source: PullStreamSource<T>) => PullStreamSource<U>

module.exports = exports = {}

/**
 * A through stream that accepts POJOs and encodes them with the given `protocol-buffers` schema
 * @param codec a `protocol-buffers` schema, containing an `encode` function
 * @returns a pull-stream through function that will output encoded protos, prefixed with thier varint-encoded size
 */
exports.protoStreamEncode = function protoStreamEncode<T> (codec: ProtoCodec<T>): PullStreamThrough<T, Buffer> {
  return pull(
    pull.map(codec.encode),
    lp.encode()
  )
}

/**
 * A through-stream that accepts size-prefixed encoded protobufs, decodes with the given decoder function,
 * and emits the decoded POJOs.
 * @param codec a `protocol-buffers` schema, containing a `decode` function
 * @returns a through-stream function that can be wired into a pull-stream pipeline
 */
exports.protoStreamDecode = function protoStreamDecode<T> (codec: ProtoCodec<T>): PullStreamThrough<Buffer, T> {
  return pull(
    lp.decode(),
    pull.map(codec.decode)
  )
}

/**
 * Convert a decoded LookupPeerResponse object into a libp2p PeerInfo object
 * @param resp a LookupPeerResponse protobuf, decoded into a POJO
 * @returns a libp2p PeerInfo object, or null if lookup failed
 */
exports.lookupResponseToPeerInfo = function lookupResponseToPeerInfo (resp: LookupPeerResponseMsg): ?PeerInfo {
  const peer = resp.peer
  if (peer == null) return null

  return exports.peerInfoProtoUnmarshal(peer)
}

/**
 * Convert a decoded PeerInfo protobuf message into a libp2p PeerInfo object
 * @param pbPeer a PeerInfo protobuf message, decoded into a POJO
 * @returns {PeerInfo} a libp2p PeerInfo object
 */
exports.peerInfoProtoUnmarshal = function peerInfoProtoUnmarshal (pbPeer: PeerInfoMsg): PeerInfo {
  const peerId = PeerId.createFromB58String(pbPeer.id)
  const peerInfo = new PeerInfo(peerId)
  if (pbPeer.addr == null) {
    return peerInfo
  }
  pbPeer.addr.forEach((addrBytes: Buffer) => {
    const addr = new Multiaddr(addrBytes)
    peerInfo.multiaddr.add(addr)
  })
  return peerInfo
}

/**
 * Convert a libp2p PeerInfo object into a PeerInfo protobuf message POJO
 * @param peerInfo a libp2p PeerInfo
 * @returns a POJO that's encodable to a PeerInfo protobuf message
 */
exports.peerInfoProtoMarshal = function peerInfoProtoMarshal (peerInfo: PeerInfo): PeerInfoMsg {
  return {
    id: peerInfo.id.toB58String(),
    addr: peerInfo.multiaddrs.map(a => a.buffer)
  }
}

/**
 * Like a standard pull-stream `pull`, but returns a Promise that will contain the final value.
 * Use when you want a single value out of a stream, not for long-lived connections, etc.
 * @param streams a pull-stream pipeline of source + through streams.  Do not include a sink,
 *        since we're draining to Promise.resolve
 * @returns {Promise} a promise that will resolve to the first value that reaches the end of the pipeline.
 */
exports.pullToPromise = function pullToPromise<T> (...streams: Array<Function>): Promise<T> {
  return new Promise((resolve, reject) => {
    pull(
      ...streams,
      pull.take(1),
      pull.collect((err, values) => {
        if (err) {
          return reject(err)
        }
        resolve(values.pop())
      })
    )
  })
}

/**
 * A pull-stream source that supplies `value` repeatedly, waiting at least `interval` milliseconds
 * between pulls.
 * @param value whatever you want to send
 * @param interval milliseconds to wait between providing value to consumers
 * @returns a pull-stream source
 */
exports.pullRepeatedly = function pullRepeatedly<T> (value: T, interval: number = 1000): PullStreamSource<T> {
  let intervalStart: ?Date = null
  let timeoutId: ?number = null
  function intervalElapsed () {
    return intervalStart == null || (new Date().getTime() - intervalStart >= interval)
  }

  return function send (end, cb) {
    if (end) {
      if (timeoutId != null) {
        clearTimeout(timeoutId)
      }
      return cb(end)
    }

    if (intervalElapsed()) {
      intervalStart = new Date()
      cb(null, value)
      return
    }
    if (intervalStart == null) intervalStart = new Date()
    const elapsedTime = new Date().getTime() - intervalStart
    timeoutId = setTimeout(send, interval - elapsedTime, end, cb)
  }
}

/**
 * A pull-stream through stream that will end the stream when it receives a StreamEnd message,
 * and end the stream with an Error object if it receives a StreamError message.  Without this,
 * you need to explicitly `pull.take(n)` from the result stream, or it will never terminate.
 */
exports.resultStreamThrough = function resultStreamThrough<T: QueryResultMsg | DataResultMsg> (read: PullStreamSource<T>): PullStreamSource<T> {
  return (end, callback) => {
    if (end) return callback(end, null)

    return read(end, (end, data) => {
      if (data == null) return callback(end, null)

      if (data.end !== undefined) {
        return callback(true, data)
      }

      if (data.error !== undefined) {
        const message = (data: Object).error.error || 'Unknown error'
        return callback(new Error(message), data)
      }

      return callback(end, data)
    })
  }
}

/**
 * Convert a `Statement` into it's "expanded" form, so that it contains the data objects it links to.
 * @param {Statement} stmt - A `Statement` with object references
 * @param {Array<DataObjectMsg>} dataObjects - an array of decoded DataObject protobuf messages, as delivered
 *  by the `/mediachain/node/data` protocol.
 * @returns {Statement} - The expanded `Statement`.  This will be a new object, with `ExpandedSimpleStatmentBody`
 *  objects replacing any `SimpleStatementBody` objects in the original.
 */
exports.expandStatement = function expandStatement (stmt: Statement, dataObjects: Array<DataObjectMsg>): Statement {
  const objectMap = new Map()

  // convert the array of key/value pairs into a map, attempting to
  // deserialize the raw data Buffer for each object as CBOR along the way
  // ignore decoding errors in case there's non-cbor data
  for (const obj of dataObjects) {
    let val: Object | Buffer = obj.data
    try {
      val = decode(obj.data)
    } catch (err) {
    }
    objectMap.set(obj.key, val)
  }

  return stmt.expandObjects(objectMap)
}

