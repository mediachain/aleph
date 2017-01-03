// @flow

const { omit, cloneDeep } = require('lodash')
const pb = require('../protobuf')

import type { PublisherId } from '../peer/identity'
import type { StatementMsg } from '../protobuf/types'

function signStatement (stmt: StatementMsg, publisherId: PublisherId): Promise<StatementMsg> {
  return new Promise((resolve, reject) => {
    // clone the original message, removing any existing signature
    const result = omit(cloneDeep(stmt), 'signature')
    let bytes
    try {
      // encode statement protobuf
      bytes = pb.stmt.Statement.encode(result)
    } catch (err) {
      return reject(err)
    }

    // sign the encoded statement message and set the signature
    publisherId.privateKey.sign(bytes, (err, sig) => {
      if (err) return reject(err)
      result.signature = sig
      resolve(result)
    })
  })
}

module.exports = {
  signStatement
}
