// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')

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

function calculateSignature (stmt: StatementMsg, signer: { sign: (bytes: Buffer) => string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let bytes
    try {
      // encode statement protobuf
      bytes = pb.stmt.Statement.encode(stmt)
    } catch (err) {
      return reject(err)
    }

    // sign the encoded statement message and set the signature
    signer.sign(bytes, (err, sig) => {
      if (err) return reject(err)
      resolve(sig)
    })
  })
}

module.exports = {
  signStatement,
  calculateSignature
}
