// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { GSet } = require('../../src/crdt/GSet')
const I = require('immutable')

describe('GSet', () => {
  it(`contains the union of all replica sets`, () => {
    const a = new GSet()
      .add('foo')

    const b = new GSet()
      .add('foo')
      .add('bar')
      .add('baz')

    const merged = a.join(b)
    const expected = new I.Set(['foo', 'bar', 'baz'])
    assert(I.is(merged.value, expected))
  })
})
