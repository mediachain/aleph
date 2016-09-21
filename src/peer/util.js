// @flow

const pull = require('pull-stream')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const lp = require('pull-length-prefixed')

import type { PeerInfoMsg, LookupPeerResponseMsg } from '../protobuf/types'

/**
 * Encode the objects using the given protobuf encoder, and return them in a pull-stream source
 * @param encoder a `protocol-buffers` encoder function
 * @param protos one or more POJOs that will be encoded to protobufs
 * @returns a pull-stream source function with the encoded protobufs, prefixed with thier varint-encoded size
 */
function protoStreamSource (encoder: Function, ...protos: Array<Object>): Function {
  return pull(
    pull.values(protos),
    pull.map(encoder),
    lp.encode()
  )
}

/**
 * A through-stream that accepts size-prefixed encoded protbufs, decodes with the given decoder function,
 * and emits the decoded POJOs.
 * @param decoder a `protocol-buffers` decoder function
 * @returns a through-stream function that can be wired into a pull-stream pipeline
 */
function protoStreamThrough (decoder: Function): Function {
  return pull(
    lp.decode(),
    pull.map(decoder)
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
 * Like a standard pull-stream `pull`, but returns a Promise that will contain the final value.
 * Use when you want a single value out of a stream, not for long-lived connections, etc.
 * @param streams a pull-stream pipeline of source + through streams.  Do not include a sink,
 *        since we're draining to Promise.resolve
 * @returns {Promise} a promise that will resolve to the first value that reaches the end of the pipeline.
 */
function pullToPromise<T> (...streams: Array<Function>): Promise<T> {
  return new Promise(resolve => {
    pull(
      ...streams,
      pull.take(1),
      pull.drain(resolve)
    )
  })
}

module.exports = {
  protoStreamSource,
  protoStreamThrough,
  lookupResponseToPeerInfo,
  peerInfoProtoUnmarshal,
  pullToPromise
}
