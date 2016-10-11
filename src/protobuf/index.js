// @flow

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')

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
  StatementMsg
} from './types'

type AllProtos = {
  dir: {
    PeerInfo: ProtoCodec<PeerInfoMsg>,
    RegisterPeer: ProtoCodec<RegisterPeerMsg>,
    LookupPeerRequest: ProtoCodec<LookupPeerRequestMsg>,
    LookupPeerResponse: ProtoCodec<LookupPeerResponseMsg>,
    ListPeersRequest: ProtoCodec<ListPeersRequestMsg>,
    ListPeersResponse: ProtoCodec<ListPeersResponseMsg>
  },
  node: {
    Ping: ProtoCodec<PingMsg>,
    Pong: ProtoCodec<PongMsg>,
    QueryRequest: ProtoCodec<QueryRequestMsg>,
    QueryResult: ProtoCodec<QueryResultMsg>,
    QueryResultValue: ProtoCodec<QueryResultValueMsg>,
    QueryResultError: ProtoCodec<QueryResultErrorMsg>,
    QueryResultEnd: ProtoCodec<QueryResultEndMsg>,
    SimpleValue: ProtoCodec<SimpleValueMsg>,
    CompoundValue: ProtoCodec<CompoundValueMsg>,
    KeyValuePair: ProtoCodec<KeyValuePairMsg>
  },
  stmt: {
    SimpleStatement: ProtoCodec<SimpleStatementMsg>,
    CompoundStatement: ProtoCodec<CompoundStatementMsg>,
    EnvelopeStatement: ProtoCodec<EnvelopeStatementMsg>,
    ArchiveStatement: ProtoCodec<ArchiveStatementMsg>,
    StatementBody: ProtoCodec<StatementBodyMsg>,
    Statement: ProtoCodec<StatementMsg>
  }
}

// FIXME: to work around the lack of `import` support in the protocol-buffers lib
// (see https://github.com/mafintosh/protocol-buffers/issues/56)
// we're concatenating all of our protos into one big string
// Stop doing this when import works!
function loadProtos (): AllProtos {
  const files = ['dir.proto', 'node.proto', 'stmt.proto']

  // parsing will fail if there's a `syntax` statement that's not the first line of the file
  // so we remove them from the concatenated monster and add back as the first line
  let joined = 'syntax = "proto3";\n'
  const syntaxStmt = new RegExp('^syntax.*$', 'gm')

  for (const file of files) {
    const content = fs.readFileSync(path.join(__dirname, file), {encoding: 'utf-8'})
    joined += content.replace(syntaxStmt, '') + '\n'
  }

  const pb = protobuf(joined)

  return {
    dir: {
      PeerInfo: pb.PeerInfo,
      RegisterPeer: pb.RegisterPeer,
      LookupPeerRequest: pb.LookupPeerRequest,
      LookupPeerResponse: pb.LookupPeerResponse,
      ListPeersRequest: pb.ListPeersRequest,
      ListPeersResponse: pb.ListPeersResponse
    },
    node: {
      Ping: pb.Ping,
      Pong: pb.Pong,
      QueryRequest: pb.QueryRequest,
      QueryResult: pb.QueryResult,
      QueryResultValue: pb.QueryResultValue,
      QueryResultError: pb.QueryResultError,
      QueryResultEnd: pb.QueryResultEnd,
      SimpleValue: pb.SimpleValue,
      CompoundValue: pb.CompoundValue,
      KeyValuePair: pb.KeyValuePair
    },
    stmt: {
      SimpleStatement: pb.SimpleStatement,
      CompoundStatement: pb.CompoundStatement,
      EnvelopeStatement: pb.EnvelopeStatement,
      ArchiveStatement: pb.ArchiveStatement,
      StatementBody: pb.StatementBody,
      Statement: pb.Statement
    }
  }
}

const { dir, node, stmt } = loadProtos()
module.exports = { dir, node, stmt }
