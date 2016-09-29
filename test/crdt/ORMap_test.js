// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { ORMap } = require('../../src/crdt/ORMap')
const { AWORSet } = require('../../src/crdt/AWORSet')

type StringSet = AWORSet<string>

describe('ORMap', () => {
  it('supports removing values', () => {
    const map: ORMap<StringSet> = new ORMap('id-a')
      .add('foo',
        new AWORSet('id-a').add('bar'))

    assert(map.values.get('foo').contains('bar'), 'map should have added value')
    assert(!map.remove('foo').get('foo'), 'map should not have removed value')
  })

  it('add wins in case of concurrent add/remove', () => {
    const mapA: ORMap<StringSet> = new ORMap('id-a')
      .add('foo', new AWORSet('id-a').add('bar'))

    const mapB: ORMap<StringSet> = new ORMap('id-b')
      .join(mapA)

    const changeValueDelta = mapA.addDelta('foo', new AWORSet('id-a').add('blammo'))
    const removeDelta = mapB.removeDelta('foo')

    // when just the remove delta is applied, the value is gone
    const noFoo = mapA.join(removeDelta)
    assert(!noFoo.contains('foo'), 'map should not have removed value')

    // when both deltas are applied concurrently, foo should still be present, with the new value
    const newFoo = mapA.join(removeDelta).join(changeValueDelta)
    assert(newFoo.values.get('foo').contains('blammo'),
      'map should apply add/change operation in case of concurrent add and remove'
    )
  })

  it('merges values when the same key exists in multiple replicas', () => {
    const mapA: ORMap<StringSet> = new ORMap('id-a')
      .add('foo', new AWORSet('id-a').add('bar'))

    const mapB: ORMap<StringSet> = new ORMap('id-b')
      .add('foo', new AWORSet('id-b').add('baz'))

    const merged = mapA.join(mapB)
    const mergedFoo = merged.values.get('foo')
    assert(mergedFoo.contains('bar') && mergedFoo.contains('baz'),
      'merged values should be joined'
    )
  })

  it('supports nested ORMaps', () => {
    const inner: ORMap<StringSet> = new ORMap('inner')
      .add('foo', new AWORSet('inner').add('bar'))

    const outer: ORMap<ORMap<StringSet>> = new ORMap('outer')
      .add('yo-dawg', inner)

    assert(outer.values.get('yo-dawg').contains('foo'),
      'should be able to access inner ORMap'
    )
  })
})
