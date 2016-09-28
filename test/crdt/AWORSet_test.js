// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { AWORSet } = require('../../src/crdt/AWORSet')

describe('AWORSet', () => {
  it('supports removing elements', () => {
    const set: AWORSet<string> = new AWORSet('some-id')
      .add('foo')

    assert(set.read().has('foo'), 'set should contain added element')
    assert(!set.remove('foo').read().has('foo'), 'set should not contain removed element')
  })

  it('retains an element in case of concurrent add/remove', () => {
    const setA: AWORSet<string> = new AWORSet('id-a')
      .add('foo')

    const setB: AWORSet<string> = new AWORSet('id-b')
      .join(setA)

    // Replica B removes the element
    const removeDelta = setB.removeDelta('foo')
    // Just merging in the remove operation alone should remove the element
    const removeOnly = setA.join(removeDelta)
    assert(!removeOnly.read().has('foo'), 'when only remove operation is applied, element is removed')

    // Replica A adds the element back in
    // When both are merged in, add wins, and the element ends up in the set
    const addDeltaA = setA.addDelta('foo')
    const concurrentMerge = setA.join(addDeltaA).join(removeDelta)

    assert(concurrentMerge.read().has('foo'), 'concurrent add/remove should keep the element')
  })
})