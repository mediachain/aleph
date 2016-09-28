// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { GCounter } = require('../../src/crdt/GCounter')

describe('GCounter', () => {
  it(`has a value equal to the sum of all replica's values`, () => {
    const a = new GCounter('a').inc(10)
    const b = new GCounter('b').inc()

    const merged = a.join(b)
    assert.equal(merged.value, 11)
  })
})
