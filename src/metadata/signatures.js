// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')
const { PublicSigningKey } = require('../peer/identity')
const { Statement } = require('../model/statement')

import type { PublisherId } from '../peer/identity'
import type { StatementMsg } from '../protobuf/types'

function signStatement (stmt: StatementMsg | Statement, publisherId: PublisherId): Promise<StatementMsg> {
  // clone the original message, removing any existing signature
  const msg: Object = (stmt instanceof Statement) ? stmt.toProtobuf() : cloneDeep(stmt)
  msg.signature = undefined

  return calculateSignature(msg, publisherId).then((sig) => {
    msg.signature = sig
    return msg
  })
}

function calculateSignature (stmt: StatementMsg | Statement, publisherId: PublisherId): Promise<Buffer> {
  const msg: StatementMsg = (stmt instanceof Statement) ? stmt.toProtobuf() : stmt

  return Promise.resolve().then(() => {
    const bytes = pb.stmt.Statement.encode(msg)
    // sign the encoded statement message and set the signature
    return publisherId.sign(bytes)
  })
}

function verifyStatement (stmt: StatementMsg | Statement): Promise<boolean> {
  return Promise.resolve()
    .then(() => PublicSigningKey.fromB58String(stmt.publisher))
    .then(pubKey => verifyStatementSignature(stmt, pubKey))
}

function verifyStatementSignature (stmt: StatementMsg | Statement, publicKey: PublicSigningKey): Promise<boolean> {
  const msg: StatementMsg = (stmt instanceof Statement) ? stmt.toProtobuf() : stmt

  return Promise.resolve()
    .then(() => {
      const sig = msg.signature
      const withoutSig = omit(cloneDeep(msg), 'signature')
      const bytes = pb.stmt.Statement.encode(withoutSig)
      return publicKey.verify(bytes, sig)
    })
}

function verifyStatementWithKeyCache (stmt: StatementMsg | Statement, cache: Map<string, PublicSigningKey>): Promise<boolean> {
  return Promise.resolve()
    .then(() => {
      const maybeKey = cache.get(stmt.publisher)
      if (maybeKey != null) return maybeKey
      const key = PublicSigningKey.fromB58String(stmt.publisher)
      cache.set(stmt.publisher, key)
      return key
    }).then(pubKey => verifyStatementSignature(stmt, pubKey))
}

module.exports = {
  signStatement,
  verifyStatement,
  verifyStatementSignature,
  verifyStatementWithKeyCache
}
