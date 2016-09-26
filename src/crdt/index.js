// @flow

export type ReplicaID = string

export interface Joinable<T> {
  join(other: T): void
}
