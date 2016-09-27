// @flow

export type ReplicaID = string

export type KeyType = string | number

// eslint chokes on this interface declaration
/* eslint-disable no-undef */
export interface CRDT<T> {
  join(other: T): T
}
/* eslint-enable no-undef */
