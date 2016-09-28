// @flow

const { Record, is: isEqual, Map: IMap, Set: ISet } = require('immutable')
const { Dot } = require('./Dot')
const { DotContext } = require('./DotContext')
import type { KeyType } from './types' // eslint-disable-line

class DotKernel<V> extends Record({
  dots: new IMap(),          // IMap<Dot, V> - map of dots to values
  context: new DotContext()  // a (possibly shared) context for dot generation
}, 'DotKernel') {

  get dots (): IMap<Dot, V> { return this.get('dots') }
  get context (): DotContext { return this.get('context') }

  join<T: V> (other: DotKernel<T> | DotKernelDelta<T>): DotKernel<T> {
    if (isEqual(this, other)) return other

    let ourDots = this.dots
    let theirDots: IMap<Dot, V> = new IMap(other.dots)

    const allDots = ISet.fromKeys(ourDots)
      .merge(ISet.fromKeys(theirDots))

    for (const dot of allDots) {
      const ourVal = ourDots.get(dot)
      const theirVal = theirDots.get(dot)

      if (ourVal && !theirVal) {
        // dot is only in this kernel, not other
        if (other.context.hasDot(dot)) {
          // if the other kernel knows this dot (has seen a different version)
          // but doesn't have it now, we delete it from our dots
          ourDots = ourDots.delete(dot)
        }
      } else if (theirVal && !ourVal) {
        // dot is only in other kernel
        if (!this.context.hasDot(dot)) {
          // if dot is not in my context, import it
          ourDots = ourDots.set(dot, theirVal)
        }
      } else if (ourVal && theirVal) { // redundant, but makes flow happy
        // dot is in both kernels
        // If the payload is different, join the two CRDTs
        if (!isEqual(ourVal, theirVal)) {
          if (typeof ourVal.join === 'function') {
            const newVal = ourVal.join(theirVal)
            ourDots = ourDots.set(dot, newVal)
          }
        }
      }
    }

    // join our dot context with theirs
    const context = this.context.join(other.context)
    return new DotKernel({dots: ourDots, context})
  }

  /**
   * Return a new DotKernel with the key/value pair added
   */
  add (key: KeyType, val: V): DotKernel<V> {
    return this.join(
      this.addDelta(key, val)
    )
  }

  /**
   * Return a DotKernelDelta that adds the key/value pair
   */
  addDelta (key: KeyType, val: V): DotKernelDelta<V> {
    const {dot, context} = this.context.makeDot(key)
    const dots = this.dots.set(dot, val)

    return new DotKernelDelta({dots, context})
  }

  /**
   * Return a new DotKernel with all dots matching `val` removed
   */
  removeValue (val: V): DotKernel<V> {
    return this.join(
      this.removeValueDelta(val)
    )
  }

  /**
   * Return a DotKernelDelta that removes all dots matching `val`
   */
  removeValueDelta (val: V): DotKernelDelta<V> {
    let dots: IMap<Dot, V> = new IMap()
    let context: DotContext = new DotContext()
    for (const [dot, value] of this.dots) {
      if (isEqual(val, value)) {
        // delta knows about removed dots
        context = context.insertDot(dot, false)
      }
    }

    return new DotKernelDelta({
      dots,
      context: context.compact()
    })
  }

  /**
   * Return a DotKernelDelta that removes a single dot and its value
   */
  removeDotDelta (dot: Dot): DotKernelDelta<V> {
    const entry = this.dots.get(dot)
    let dots: IMap<Dot, V> = new IMap()
    let context: DotContext = new DotContext()
    if (entry) {
      // delta knows about removed dots
      context = context.insertDot(dot, false)
    }
    return new DotKernelDelta({
      dots,
      context: context.compact()
    })
  }

  /**
   * Return a new DotKernel with all dots removed, but which preserves its context
   */
  clear (): DotKernel<V> {
    let context: DotContext = new DotContext()
    for (const dot of this.dots.keys()) {
      context = context.insertDot(dot, false)
    }
    return new DotKernel({
      dots: new IMap(),
      context
    })
  }
}

class DotKernelDelta<V> extends Record({
  dots: new IMap(),
  context: new DotContext()
}) {
  get dots (): IMap<Dot, V> { return this.get('dots') }
  get context (): DotContext { return this.get('context') }
}

module.exports = {
  DotKernel,
  DotKernelDelta
}
