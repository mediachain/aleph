// @flow

const pull = require('pull-stream')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const lp = require('pull-length-prefixed')
const {decode} = require('../metadata/serialize')
const _ = require('lodash')

import type { PeerInfoMsg, LookupPeerResponseMsg, ProtoCodec, QueryResultMsg, QueryResultValueMsg, SimpleValueMsg, DataResultMsg, DataObjectMsg, StatementMsg, StatementBodyMsg, SimpleStatementMsg } from '../protobuf/types'  // eslint-disable-line no-unused-vars

// Flow signatures for pull-streams
export type PullStreamCallback<T> = (end: ?mixed, value?: ?T) => void
export type PullStreamSource<T> = (end: ?mixed, cb: PullStreamCallback<T>) => void
export type PullStreamSink<T> = (source: PullStreamSource<T>) => void
export type PullStreamThrough<T, U> = (source: PullStreamSource<T>) => PullStreamSource<U>

/**
 * A through stream that accepts POJOs and encodes them with the given `protocol-buffers` schema
 * @param codec a `protocol-buffers` schema, containing an `encode` function
 * @returns a pull-stream through function that will output encoded protos, prefixed with thier varint-encoded size
 */
function protoStreamEncode<T> (codec: ProtoCodec<T>): PullStreamThrough<T, Buffer> {
  return pull(
    pull.map(codec.encode),
    lp.encode()
  )
}

/**
 * A through-stream that accepts size-prefixed encoded protbufs, decodes with the given decoder function,
 * and emits the decoded POJOs.
 * @param codec a `protocol-buffers` schema, containing a `decode` function
 * @returns a through-stream function that can be wired into a pull-stream pipeline
 */
function protoStreamDecode<T> (codec: ProtoCodec<T>): PullStreamThrough<Buffer, T> {
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
function lookupResponseToPeerInfo (resp: LookupPeerResponseMsg): ?PeerInfo {
  const peer = resp.peer
  if (peer == null) return null

  return peerInfoProtoUnmarshal(peer)
}

/**
 * Convert a decoded PeerInfo protobuf message into a libp2p PeerInfo object
 * @param pbPeer a PeerInfo protobuf message, decoded into a POJO
 * @returns {PeerInfo} a libp2p PeerInfo object
 */
function peerInfoProtoUnmarshal (pbPeer: PeerInfoMsg): PeerInfo {
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
function peerInfoProtoMarshal (peerInfo: PeerInfo): PeerInfoMsg {
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
function pullToPromise<T> (...streams: Array<Function>): Promise<T> {
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
function pullRepeatedly<T> (value: T, interval: number = 1000): PullStreamSource<T> {
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
type MediachainStreamThrough<T: QueryResultMsg | DataResultMsg> = PullStreamThrough<T, T>
const resultStreamThrough: MediachainStreamThrough<*> = (read) => {
  return (end, callback) => {
    if (end) return callback(end, null)

    return read(end, (end, data) => {
      if (data == null) return callback(end, null)

      if (data.end !== undefined) {
        return callback(true, data)
      }

      if (data.error !== undefined) {
        const message = data.error.error || 'Unknown error'
        return callback(new Error(message), data)
      }

      return callback(end, data)
    })
  }
}

/**
 * Reject `promise` if it doesn't complete within `timeout` milliseconds
 * @param timeout milliseconds to wait before rejecting
 * @param promise a promise that you want to set a timeout for
 * @returns a Promise that will resolve to the value of `promise`, unless the timeout is exceeded
 */
function promiseTimeout<T> (timeout: number, promise: Promise<T>): Promise<T> {
  return Promise.race([promise, new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout of ${timeout}ms exceeded`))
    }, timeout)
  })])
}

function flatMap<T, U> (array: Array<T>, f: (x: T) => Array<U>): Array<U> {
  return [].concat(...array.map(x => f(x)))
}

function objectIdsForQueryResult (result: QueryResultValueMsg): Array<string> {
  let values: Array<SimpleValueMsg> = []

  const simpleResultValue: ?SimpleValueMsg = _.get(result, 'simple')
  if (simpleResultValue != null) {
    values = [simpleResultValue]
  } else {
    const compoundResultBodies: ?Array<{key: string, value: SimpleValueMsg}> =
      _.get(result, 'compound.body')
    if (compoundResultBodies != null) {
      values = compoundResultBodies.map(b => b.value)
    }
  }

  const statementBodies: Array<StatementBodyMsg> = values
    .map(v => _.get(v, 'stmt'))
    .filter(stmt => stmt != null)
    .map((stmt: StatementMsg) => stmt.body)

  const simpleStatements: Array<SimpleStatementMsg> =
    flatMap(statementBodies, s => {
      const stmt: ?SimpleStatementMsg = _.get(s, 'simple')
      if (stmt != null) return [stmt]

      const compoundStatements: Array<SimpleStatementMsg> =
        _.get(s, 'compound.body')
      if (compoundStatements != null) return compoundStatements
      return []
    })

  return simpleStatements.map(s => s.object)
}

function expandQueryResult (result: QueryResultValueMsg, dataObjects: Array<DataObjectMsg>): Object {
  const objectMap = {}
  for (const obj of dataObjects) {
    let val: Object | string
    try {
      val = decode(obj.data)
    } catch (err) {
      val = obj.data.toString('base64')
    }
    objectMap[obj.key] = val
  }

  function replacer (value: any) {
    const key = _.get(value, 'object')
    const data = objectMap[key]
    if (data != null) {
      return _.set(value, 'object', {key, data})
    }
  }

  return _.cloneDeepWith(result, replacer)
}

module.exports = {
  protoStreamEncode,
  protoStreamDecode,
  lookupResponseToPeerInfo,
  peerInfoProtoUnmarshal,
  peerInfoProtoMarshal,
  pullToPromise,
  pullRepeatedly,
  resultStreamThrough,
  promiseTimeout,
  objectIdsForQueryResult,
  expandQueryResult,
  flatMap
}
