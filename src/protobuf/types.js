// @flow
// flow types for protobuf messages.  resisting urge to write automatic flow code generator for these

// dir.proto
export type PeerInfo = {
  id: string,
  addr: Array<Buffer>
}

export type RegisterPeer = {
  info: PeerInfo
}

export type LookupPeerRequest = {
  id: string
}

export type LookupPeerResponse = {
  peer: ?PeerInfo
}

export type ListPeersRequest = {
}

export type ListPeersResponse = {
  peers: Array<PeerInfo>
}

// node.proto

export type Ping = { }
export type Pong = { }

// stmt.proto

export type SimpleStatement = {
  object: string,
  refs?: Array<string>,
  tags?: Array<string>,
};

export type CompoundStatement = {
  body: Array<SimpleStatement>
};

export type Statement = {
  id?: string,
  publisher?: string,
  namespace?: string,
  body: SimpleStatement | CompoundStatement,
};
