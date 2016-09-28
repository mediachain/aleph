// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { ORMap } = require('../../src/crdt/ORMap')

describe('ORMap', () => {
  it('supports removing values', () => {
    const map: ORMap<string> = new ORMap('id-a')
      .add('foo', 'bar')

    assert.equal(map.values.get('foo'), 'bar', 'map should have added value')
    assert(!map.remove('foo').contains('foo'), 'map should not have removed value')
  })

  it('add wins in case of concurrent add/remove', () => {
    const mapA: ORMap<string> = new ORMap('id-a')
      .add('foo', 'bar')

    const mapB: ORMap<string> = new ORMap('id-b')
      .join(mapA)

    const changeValueDelta = mapA.addDelta('foo', 'blammo')
    const removeDelta = mapB.removeDelta('foo')

    // when just the remove delta is applied, the value is gone
    const noFoo = mapA.join(removeDelta)
    assert(!noFoo.contains('foo'), 'map should not have removed value')

    // when both deltas are applied concurrently, foo should still be present, with the new value
    const newFoo = mapA.join(removeDelta).join(changeValueDelta)
    assert.equal(newFoo.values.get('foo'), 'blammo',
      'map should apply add/change operation in case of concurrent add and remove'
    )
  })
})
