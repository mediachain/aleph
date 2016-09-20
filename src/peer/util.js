// @flow

const varint = require('varint')
const pull = require('pull-stream')

function protobufStream (encodedProto: Buffer): any {
  const lengthBuffer = new Buffer(varint.encode(encodedProto.length), 'binary')
  return pull.values([Buffer.concat([lengthBuffer, encodedProto])])
}

module.exports = {
  protobufStream
}
