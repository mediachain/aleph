// @flow

const fs = require('fs')
const path = require('path')
const protobuf = require('protocol-buffers')

import type {
  ProtoCodec,
  PeerInfoMsg,
  PublisherInfoMsg,
  RegisterPeerMsg,
  LookupPeerRequestMsg,
  LookupPeerResponseMsg,
  ListPeersRequestMsg,
  ListPeersResponseMsg,
  PingMsg,
  PongMsg,
  NodeInfoRequestMsg,
  NodeInfoMsg,
  QueryRequestMsg,
  QueryResultMsg,
  QueryResultValueMsg,
  DataRequestMsg,
  DataObjectMsg,
  DataResultMsg,
  PushRequestMsg,
  PushAcceptMsg,
  PushRejectMsg,
  PushValueMsg,
  PushEndMsg,
  PushResponseMsg,
  SimpleValueMsg,
  CompoundValueMsg,
  KeyValuePairMsg,
  StreamErrorMsg,
  StreamEndMsg,
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
    PublisherInfo: ProtoCodec<PublisherInfoMsg>,
    RegisterPeer: ProtoCodec<RegisterPeerMsg>,
    LookupPeerRequest: ProtoCodec<LookupPeerRequestMsg>,
    LookupPeerResponse: ProtoCodec<LookupPeerResponseMsg>,
    ListPeersRequest: ProtoCodec<ListPeersRequestMsg>,
    ListPeersResponse: ProtoCodec<ListPeersResponseMsg>
  },
  node: {
    Ping: ProtoCodec<PingMsg>,
    Pong: ProtoCodec<PongMsg>,
    NodeInfoRequest: ProtoCodec<NodeInfoRequestMsg>,
    NodeInfo: ProtoCodec<NodeInfoMsg>,
    QueryRequest: ProtoCodec<QueryRequestMsg>,
    QueryResult: ProtoCodec<QueryResultMsg>,
    QueryResultValue: ProtoCodec<QueryResultValueMsg>,
    DataRequest: ProtoCodec<DataRequestMsg>,
    DataResult: ProtoCodec<DataResultMsg>,
    DataObject: ProtoCodec<DataObjectMsg>,
    PushRequest: ProtoCodec<PushRequestMsg>,
    PushResponse: ProtoCodec<PushResponseMsg>,
    PushValue: ProtoCodec<PushValueMsg>,
    PushEnd: ProtoCodec<PushEndMsg>,
    PushAccept: ProtoCodec<PushAcceptMsg>,
    PushReject: ProtoCodec<PushRejectMsg>,
    StreamError: ProtoCodec<StreamErrorMsg>,
    StreamEnd: ProtoCodec<StreamEndMsg>,
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
      PublisherInfo: pb.PublisherInfo,
      RegisterPeer: pb.RegisterPeer,
      LookupPeerRequest: pb.LookupPeerRequest,
      LookupPeerResponse: pb.LookupPeerResponse,
      ListPeersRequest: pb.ListPeersRequest,
      ListPeersResponse: pb.ListPeersResponse
    },
    node: {
      Ping: pb.Ping,
      Pong: pb.Pong,
      NodeInfoRequest: pb.NodeInfoRequest,
      NodeInfo: pb.NodeInfo,
      QueryRequest: pb.QueryRequest,
      QueryResult: pb.QueryResult,
      QueryResultValue: pb.QueryResultValue,
      DataRequest: pb.DataRequest,
      DataResult: pb.DataResult,
      DataObject: pb.DataObject,
      PushRequest: pb.PushRequest,
      PushResponse: pb.PushResponse,
      PushValue: pb.PushValue,
      PushEnd: pb.PushEnd,
      PushAccept: pb.PushAccept,
      PushReject: pb.PushReject,
      StreamError: pb.StreamError,
      StreamEnd: pb.StreamEnd,
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
