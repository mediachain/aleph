// @flow

export type ReplicaID = string

export interface CRDT {
  join(other: CRDT): void,

  equals(other: CRDT): boolean
}
