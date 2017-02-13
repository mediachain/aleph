// @flow

/**
 * @module aleph/peer/push
 * @description Implementation for pushing statements + data to remote peers.
 */

const lp = require('pull-length-prefixed')
const locks = require('locks')
const pb = require('../protobuf')
const { pullToPromise } = require('./util')
const { Statement } = require('../model/statement')

import type { Connection } from 'interface-connection'
import type { PushEndMsg } from '../protobuf/types'

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
function pushStatementsToConn (statements: Array<Statement>, conn: Connection): Promise<PushEndMsg> {
  // build the PushRequest message
  const namespaces: Set<string> = new Set()
  for (const stmt of statements) {
    namespaces.add(stmt.namespace)
  }
  const req = {namespaces: Array.from(namespaces)}

  // state variables
  let requestSent = false
  let endMessageSent = false
  let handshakeReceived = locks.createCondVariable(false)

  // a pull-stream source that sends three kinds of messages, depending on the current state:
  // - PushRequest is sent first, containing namespaces we want to push to
  // Assuming the request is accepted:
  // - PushValue with `stmt` field filled out is sent for each statement
  // - PushValue with `end` field filled out is sent to signal end of stream
  // If the request is rejected, the stream will be closed with an Error whose message will contain
  // the rejection reason sent by the remote peer
  const writer = (end, callback) => {
    if (end) return callback(end)

    // first, send the initial request
    if (!requestSent) {
      requestSent = true
      return callback(null, pb.node.PushRequest.encode(req))
    }

    // wait for the reader to handle the PushResponse handshake.
    // handshakeReceived is a "condition variable": the wait fn executes its second argument
    // once the first argument returns true.
    handshakeReceived.wait(
      val => val === true,
      () => {
        // if we have statements, pop one from the head of the array and send it, wrapped in a PushValue
        if (statements.length > 0) {
          const stmt = statements.pop().toProtobuf()
          const msg = { stmt }
          return callback(null, pb.node.PushValue.encode(msg))
        }

        // if we're out of statements, and haven't already done so, send the final PushValue "end" message
        // to signal the end of the stream
        if (!endMessageSent) {
          endMessageSent = true
          const msg = { end: {} }
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

        // if we got a rejection, close the stream with an error, passing along the message from the peer
        if (typeof handshake.reject === 'object' && handshake.reject != null) {
          const msg = (typeof handshake.reject.error === 'string')
            ? handshake.reject.error
            : 'Push request rejected with unknown error'

          return callback(new Error(msg))
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

  // create a pull-stream source that's composed of our writer -> conn -> reader pipeline.
  // the lp.encode() and lp.decode() functions are used to segment the length-prefixed messages
  // from the raw byte stream exposed by the connection.  This is handled automatically by the
  // protoStreamEncode / Decode helpers, but we can't use those here since we need to produce / accept
  // multiple message types in each handler.
  //
  // Since the stream only returns a single value (or error), we use the pullToPromise helper to
  // grab the result and deliver it as a Promise, thus escaping the wilds of pull-stream land
  return pullToPromise(
    writer,
    lp.encode(),
    conn,
    lp.decode(),
    reader
  )
}

module.exports = {
  pushStatementsToConn
}
