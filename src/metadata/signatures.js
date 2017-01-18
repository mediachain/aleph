// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')
const { PublicSigningKey } = require('../peer/identity')

import type { PublisherId } from '../peer/identity'
import type { StatementMsg } from '../protobuf/types'

function signStatement (stmt: StatementMsg, publisherId: PublisherId): Promise<StatementMsg> {
  // clone the original message, removing any existing signature
  const result = omit(cloneDeep(stmt), 'signature')
  return calculateSignature(result, publisherId.privateKey).then((sig) => {
    result.signature = sig
    return result
  })
}

function calculateSignature (stmt: StatementMsg, publisherId: PublisherId): Promise<Buffer> {
  return Promise.resolve().then(() => {
    const bytes = pb.stmt.Statement.encode(stmt)
    return publisherId.sign(bytes)
  })
}

function verifyStatement (stmt: StatementMsg): Promise<boolean> {
  return Promise.resolve()
    .then(() => PublicSigningKey.fromB58String(stmt.publisher))
    .then(pubKey => verifyStatementSignature(stmt, pubKey))
}

function verifyStatementSignature (stmt: StatementMsg, publicKey: PublicSigningKey): Promise<boolean> {
  return Promise.resolve()
    .then(() => {
      const sig = stmt.signature
      const withoutSig = omit(cloneDeep(stmt), 'signature')
      const bytes = pb.stmt.Statement.encode(withoutSig)
      return publicKey.verify(bytes, sig)
    })
}

function verifyStatementWithKeyCache (stmt: StatementMsg, cache: Map<string, PublicSigningKey>): Promise<boolean> {
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
  calculateSignature,
  verifyStatement,
  verifyStatementSignature,
  verifyStatementWithKeyCache
}
