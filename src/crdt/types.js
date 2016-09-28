// @flow

export type ReplicaID = string

export type KeyType = string | number

// eslint chokes on this interface declaration
/* eslint-disable no-undef */
export interface CRDT {
  join(other: CRDT): CRDT
}
/* eslint-enable no-undef */
