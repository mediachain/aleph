// @flow

/* eslint-env mocha */

const assert = require('assert')
const { describe, it } = require('mocha')

const { Dot } = require('../../src/crdt/Dot')
const { DotKernel, DotKernelDelta } = require('../../src/crdt/DotKernel')
const I = require('immutable')

describe('DotKernel', () => {
  it('adds and removes Dot/value pairs using delta states', () => {
    const addDelta: DotKernelDelta<string> = new DotKernel()
      .addDelta('foo', 'bar')

    const fooDot = new Dot('foo', 1) // the dot that was implicitly created by the add operation

    const expectedDots = new I.Map([[fooDot, 'bar']])
    assert(I.is(addDelta.dataStore, expectedDots),
      'DotKernelDelta should contain added dot / value pair')

    const kernelWithDot = new DotKernel().join(addDelta)
    assert(I.is(kernelWithDot.dataStore, expectedDots),
      'DotKernel should contain dataStore from delta')

    const removeDelta = kernelWithDot.removeValueDelta('bar')
    assert(removeDelta.dataStore.isEmpty(),
      'DotKernelDelta should have not dataStore after remove operation'
    )
    assert(removeDelta.context.hasDot(fooDot),
      'DotKernelDelta should "remember" the dot for the removed value'
    )

    const kernelWithDotRemoved = kernelWithDot.join(removeDelta)
    assert(kernelWithDotRemoved.dataStore.isEmpty(),
      'DotKernel should not have removed dot after applying delta'
    )
    assert(kernelWithDotRemoved.context.hasDot(fooDot),
      'DotKernel should "remember" the dot for the removed value'
    )
  })
})
