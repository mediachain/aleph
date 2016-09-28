// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')
const { PNCounter } = require('../../src/crdt/PNCounter')

describe('PNCounter', () => {
  it(`has a value equal to the sum of all replica's values`, () => {
    const a = new PNCounter('a').inc(10)
    const b = new PNCounter('b').dec(5)

    const merged = a.join(b)
    assert.equal(merged.value, 5)
  })
})
