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
  QueryRequestMsg,
  QueryResultMsg,
  QueryResultValueMsg,
  SimpleValueMsg,
  CompoundValueMsg,
  KeyValuePairMsg,
  QueryResultErrorMsg,
  QueryResultEndMsg,
  SimpleStatementMsg,
  CompoundStatementMsg,
  EnvelopeStatementMsg,
  ArchiveStatementMsg,
  StatementBodyMsg,
  StatementMsg,
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
  Pong: ProtoCodec<PongMsg>,
  QueryRequest: ProtoCodec<QueryRequestMsg>,
  QueryResult: ProtoCodec<QueryResultMsg>,
  QueryResultValue: ProtoCodec<QueryResultValueMsg>,
  SimpleValue: ProtoCodec<SimpleValueMsg>,
  CompoundValue: ProtoCodec<CompoundValueMsg>,
  KeyValuePair: ProtoCodec<KeyValuePairMsg>,
  QueryResultError: ProtoCodec<QueryResultErrorMsg>,
  QueryResultEnd: ProtoCodec<QueryResultEndMsg>
}

type StmtProtos = {
  SimpleStatement: ProtoCodec<SimpleStatementMsg>,
  CompoundStatement: ProtoCodec<CompoundStatementMsg>,
  EnvelopeStatement: ProtoCodec<EnvelopeStatementMsg>,
  ArchiveStatement: ProtoCodec<ArchiveStatementMsg>,
  StatementBody: ProtoCodec<StatementBodyMsg>,
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
