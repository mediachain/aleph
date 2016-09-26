// @flow
// flow types for protobuf messages.  resisting urge to write automatic flow code generator for these

// dir.proto
export type PeerInfoMsg = {
  id: string,
  addr: Array<Buffer>
}

export type RegisterPeerMsg = {
  info: PeerInfoMsg
}

export type LookupPeerRequestMsg = {
  id: string
}

export type LookupPeerResponseMsg = {
  peer: ?PeerInfoMsg
}

export type ListPeersRequestMsg = {
}

export type ListPeersResponseMsg = {
  peers: Array<PeerInfoMsg>
}

// node.proto

export type PingMsg = { }
export type PongMsg = { }

// stmt.proto

export type SimpleStatementMsg = {
  object: string,
  refs?: Array<string>,
  tags?: Array<string>,
};

export type CompoundStatementMsg = {
  body: Array<SimpleStatementMsg>
};

export type StatementMsg = {
  id?: string,
  publisher?: string,
  namespace?: string,
  body: SimpleStatementMsg | CompoundStatementMsg,
};
