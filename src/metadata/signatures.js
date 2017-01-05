// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')
const { publisherKeyFromB58String, signBuffer, verifyBuffer } = require('../peer/identity')

import type { PublisherId, PublicSigningKey } from '../peer/identity'
import type { StatementMsg } from '../protobuf/types'

function signStatement (stmt: StatementMsg, publisherId: PublisherId): Promise<StatementMsg> {
  // clone the original message, removing any existing signature
  const result = omit(cloneDeep(stmt), 'signature')
  return calculateSignature(result, publisherId).then((sig) => {
    result.signature = sig
    return result
  })
}

function calculateSignature (stmt: StatementMsg, publisherId: PublisherId): Promise<Buffer> {
  return Promise.resolve().then(() => {
    const bytes = pb.stmt.Statement.encode(stmt)
    // sign the encoded statement message and set the signature
    return signBuffer(publisherId.privateKey, bytes)
  })
}

function verifyStatement (stmt: StatementMsg): Promise<boolean> {
  return Promise.resolve()
    .then(() => publisherKeyFromB58String(stmt.publisher))
    .then(pubKey => verifyStatementSignature(stmt, pubKey))
}

function verifyStatementSignature (stmt: StatementMsg, publicKey: PublicSigningKey): Promise<boolean> {
  return Promise.resolve()
    .then(() => {
      const sig = stmt.signature
      const withoutSig = omit(cloneDeep(stmt), 'signature')
      const bytes = pb.stmt.Statement.encode(withoutSig)
      return verifyBuffer(publicKey, bytes, sig)
    })
}

function verifyStatementWithKeyCache (stmt: StatementMsg, cache: Map<string, PublicSigningKey>): Promise<boolean> {
  return Promise.resolve()
    .then(() => {
      const maybeKey = cache.get(stmt.publisher)
      if (maybeKey != null) return maybeKey
      const key = publisherKeyFromB58String(stmt.publisher)
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
