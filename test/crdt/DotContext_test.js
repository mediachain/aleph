// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { DotContext } = require('../../src/crdt/DotContext')

describe('DotContext', () => {
  it('generates dot clocks for a given id', () => {
    let {context, dot} = new DotContext().makeDot('some-id') // make initial dot for 'some-id'
    let {context: updatedContext, dot: updatedDot} = context.makeDot('some-id')

    assert(context.hasDot(dot), 'context should have generated dot')
    assert(updatedContext.hasDot(updatedDot), 'updated context should have updated dot')
    assert(updatedContext.hasDot(dot), 'updated context should have original dot')
    assert(!context.hasDot(updatedDot), 'original context should not have updated dot')
    assert.equal(dot.clock, 1, 'newly minted dot should have clock === 1')
    assert.equal(updatedDot.clock, 2, 'updating a dot should increment its clock')
  })
})
