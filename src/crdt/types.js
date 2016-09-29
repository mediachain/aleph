// @flow

export type ReplicaID = string
export type KeyType = string | number

import type { DotContext } from './DotContext'

// eslint doesn't like flow interface declarations
/* eslint-disable no-undef */
/**
 * A CRDT type that can be used as a value in an ORMap, and which shares a
 * causal context with other members of the map.
 */
export interface ContainableCRDT {
  constructor (id: ReplicaID, context?: DotContext): ContainableCRDT;

  context: DotContext;
}
/* eslint-enable no-undef */
