// @flow

const varint = require('varint')
const pull = require('pull-stream')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')

import type { LookupPeerResponse } from '../protobuf/types'

/**
 * Encode the objects using the given protobuf encoder, and return them in a pull-stream source
 * @param encoder a `protocol-buffers` encoder function
 * @param protos one or more POJOs that will be encoded to protobufs
 * @returns a pull-stream source function with the encoded protobufs, prefixed with thier varint-encoded size
 */
function protoStreamSource (encoder: Function, ...protos: Array<Object>): Function {
  const sizePrefixed = protos.map((obj) => {
    const encoded = encoder(obj)
    const size = new Buffer(varint.encode(encoded.length), 'binary')
    return Buffer.concat([size, encoded])
  })

  return pull.values(sizePrefixed)
}

/**
 * A through-stream that accepts size-prefixed encoded protbufs, decodes with the given decoder function,
 * and emits the decoded POJOs.
 * @param decoder a `protocol-buffers` decoder function
 * @returns a through-stream function that can be wired into a pull-stream pipeline
 */
function protoStreamThrough (decoder: Function): Function {
  let buffers = []

  return function (read) {
    return function (end, callback) {
      const reader = (end, data) => {
        if (end) {
          return callback(end, null)
        }

        buffers.push(data)
        if (buffers.length < 2) {
          // recursively call read until we have two buffers (size + proto)
          return read(end, reader)
        } else {
          const decoded = sizePrefixedProtoDecode(decoder, buffers)
          buffers = []
          return callback(end, decoded)
        }
      }

      return read(end, reader)
    }
  }
}

/**
 * Given a protobuf decode, and an array of two `Buffer`s, decode the first as a varint-encoded size,
 * check that the second has the correct size, and decode the second buffer using the `decoder` function.
 * @param decoder a `protocol-buffers` decoder function
 * @param buffers a two-element Array of Buffers
 * @returns the decoded protobuf
 * @throws if size validation or protobuf decoding fails
 */
function sizePrefixedProtoDecode (decoder: Function, buffers: Array<Buffer>): any {
  if (buffers.length !== 2) {
    throw new Error(
      `Expected size-prefixed protobuf, but got ${buffers.length} responses`
    )
  }

  const size = varint.decode(buffers[0])
  const data = buffers[1]
  if (size !== data.length) {
    throw new Error(
      `Size of encoded protobuf (${data.length}) does not match prefix (${size})`
    )
  }

  return decoder(data)
}

/**
 * Convert a decoded LookupPeerResponse object into a libp2p PeerInfo object
 * @param resp a LookupPeerResponse protobuf, decoded into a POJO
 * @returns a libp2p PeerInfo object, or null if lookup failed
 */
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

module.exports = {
  protoStreamSource,
  protoStreamThrough,
  sizePrefixedProtoDecode,
  lookupResponseToPeerInfo
}
