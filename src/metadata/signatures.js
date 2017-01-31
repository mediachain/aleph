// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')
const { PublicSigningKey } = require('../peer/identity')

import type { IPublisherId } from '../peer/identity'
import type { StatementMsg } from '../protobuf/types'

function signStatement (stmt: StatementMsg, publisherId: IPublisherId): Promise<StatementMsg> {
  // clone the original message, removing any existing signature
  const result = omit(cloneDeep(stmt), 'signature')
  return calculateSignature(result, publisherId).then((sig) => {
    result.signature = sig
    return result
  })
}

function calculateSignature (stmt: StatementMsg, publisherId: IPublisherId): Promise<Buffer> {
  return Promise.resolve().then(() => {
    const bytes = pb.stmt.Statement.encode(stmt)
    // sign the encoded statement message and set the signature
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
  verifyStatement,
  verifyStatementSignature,
  verifyStatementWithKeyCache
}
