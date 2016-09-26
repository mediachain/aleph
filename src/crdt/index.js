// @flow

export type ReplicaID = string
export const DELTA_REPLICA_ID = 'DELTA_ONLY'

export interface Joinable<T> {
  join(other: T): void
}
