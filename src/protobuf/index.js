// @flow

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')

function loadProto (name: string): Object {
  return protobuf(fs.readFileSync(path.join(__dirname, `./${name}`)))
}

import type {
  ProtoCodec,
  PeerInfoMsg,
  RegisterPeerMsg,
  LookupPeerRequestMsg,
  LookupPeerResponseMsg,
  ListPeersRequestMsg,
  ListPeersResponseMsg,
  PingMsg,
  PongMsg,
  SimpleStatementMsg,
  CompoundStatementMsg,
  StatementMsg
} from './types'

type DirProtos = {
  PeerInfo: ProtoCodec<PeerInfoMsg>,
  RegisterPeer: ProtoCodec<RegisterPeerMsg>,
  LookupPeerRequest: ProtoCodec<LookupPeerRequestMsg>,
  LookupPeerResponse: ProtoCodec<LookupPeerResponseMsg>,
  ListPeersRequest: ProtoCodec<ListPeersRequestMsg>,
  ListPeersResponse: ProtoCodec<ListPeersResponseMsg>
}

type NodeProtos = {
  Ping: ProtoCodec<PingMsg>,
  Pong: ProtoCodec<PongMsg>
}

type StmtProtos = {
  SimpleStatement: ProtoCodec<SimpleStatementMsg>,
  CompoundStatement: ProtoCodec<CompoundStatementMsg>,
  Statement: ProtoCodec<StatementMsg>
}

const exported: {
  dir: DirProtos,
  node: NodeProtos,
  stmt: StmtProtos
} = {
  dir: loadProto('dir.proto'),
  node: loadProto('node.proto'),
  stmt: loadProto('stmt.proto')
}

module.exports = exported