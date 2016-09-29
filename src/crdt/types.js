// @flow

export type ReplicaID = string
export type KeyType = string | number

import type { DotContext } from './DotContext'

// eslint doesn't like flow interface declarations
/* eslint-disable no-undef */
/**
 * A CRDT type that can be used as a value in an ORMap
 */
export interface ContainableCRDT {
  reset (): ContainableCRDT;
  join (other: ContainableCRDT): ContainableCRDT;
  context: DotContext;
}
/* eslint-enable no-undef */
