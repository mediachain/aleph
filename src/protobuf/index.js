// @flow

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')

function loadProto (name: string): Object {
  return protobuf(fs.readFileSync(path.join(__dirname, `./${name}`)))
}

module.exports = {
  dir: loadProto('dir.proto'),
  node: loadProto('node.proto'),
  stmt: loadProto('stmt.proto')
}
