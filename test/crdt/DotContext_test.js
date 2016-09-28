// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { Dot } = require('../../src/crdt/Dot')
const { DotContext } = require('../../src/crdt/DotContext')

describe('DotContext', () => {
  it('generates dot clocks for a given id', () => {
    const {context, dot} = new DotContext().makeDot('some-id') // make initial dot for 'some-id'
    const {context: updatedContext, dot: updatedDot} = context.makeDot('some-id')

    assert(context.hasDot(dot), 'context should have generated dot')
    assert(updatedContext.hasDot(updatedDot), 'updated context should have updated dot')
    assert(updatedContext.hasDot(dot), 'updated context should have original dot')
    assert(!context.hasDot(updatedDot), 'original context should not have updated dot')
    assert.equal(dot.clock, 1, 'newly minted dot should have clock === 1')
    assert.equal(updatedDot.clock, 2, 'updating a dot should increment its clock')
  })

  it('compacts contiguous dot clocks', () => {
    let context = new DotContext()
      .insertDot(new Dot('some-id'))
      .insertDot(new Dot('some-id', 3))
      .insertDot(new Dot('some-id', 2))
      .insertDot(new Dot('some-id', 10))

    assert.equal(context.causalContext.get('some-id'), 3,
      'compact causalContext map only contains the highest contiguous dot seen')
    assert(context.dotCloud.get(new Dot('some-id', 10)),
      'non-contiguous dots are stored in the dotCloud set until they can be compacted')
  })
})
