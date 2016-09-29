// @flow

const { Record, is: isEqual, Map: IMap, Set: ISet } = require('immutable')
const { Dot } = require('./Dot')
const { DotContext } = require('./DotContext')
import type { KeyType } from './types' // eslint-disable-line

class DotKernel<V> extends Record({
  dataStore: new IMap(),     // IMap<Dot, V> - map of dataStore to values
  context: new DotContext()  // a (possibly shared) context for dot generation
}, 'DotKernel') {

  get dataStore (): IMap<Dot, V> { return this.get('dataStore') }
  get context (): DotContext { return this.get('context') }

  join<T: V> (other: DotKernel<T> | DotKernelDelta<T>): DotKernel<T> {
    if (isEqual(this, other)) return other

    let ourStore = this.dataStore
    let theirStore: IMap<Dot, V> = new IMap(other.dataStore)

    const allDots = ISet.fromKeys(ourStore)
      .merge(ISet.fromKeys(theirStore))

    for (const dot of allDots) {
      const ourVal = ourStore.get(dot)
      const theirVal = theirStore.get(dot)

      if (ourVal && !theirVal) {
        // dot is only in this kernel, not other
        if (other.context.hasDot(dot)) {
          // if the other kernel knows this dot (has seen a different version)
          // but doesn't have it now, we delete it from our dataStore
          ourStore = ourStore.delete(dot)
        }
      } else if (theirVal && !ourVal) {
        // dot is only in other kernel
        if (!this.context.hasDot(dot)) {
          // if dot is not in my context, import it
          ourStore = ourStore.set(dot, theirVal)
        }
      } else if (ourVal && theirVal) { // redundant, but makes flow happy
        // dot is in both kernels
        // If the payload is different, join the two CRDTs
        if (!isEqual(ourVal, theirVal)) {
          if (typeof ourVal.join === 'function') {
            const newVal = ourVal.join(theirVal)
            ourStore = ourStore.set(dot, newVal)
          }
        }
      }
    }

    // join our dot context with theirs
    const context = this.context.join(other.context)
    return new DotKernel({dataStore: ourStore, context})
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
    const dataStore = this.dataStore.set(dot, val)

    return new DotKernelDelta({dataStore, context})
  }

  /**
   * Return a new DotKernel with all dataStore matching `val` removed
   */
  removeValue (val: V): DotKernel<V> {
    return this.join(
      this.removeValueDelta(val)
    )
  }

  /**
   * Return a DotKernelDelta that removes all dataStore matching `val`
   */
  removeValueDelta (val: V): DotKernelDelta<V> {
    let dataStore: IMap<Dot, V> = new IMap()
    let context: DotContext = new DotContext()
    for (const [dot, value] of this.dataStore) {
      if (isEqual(val, value)) {
        // delta knows about removed dataStore
        context = context.insertDot(dot, false)
      }
    }

    return new DotKernelDelta({
      dataStore,
      context: context.compact()
    })
  }

  /**
   * Return a DotKernelDelta that removes a single dot and its value
   */
  removeDotDelta (dot: Dot): DotKernelDelta<V> {
    const entry = this.dataStore.get(dot)
    let dataStore: IMap<Dot, V> = new IMap()
    let context: DotContext = new DotContext()
    if (entry) {
      // delta knows about removed dataStore
      context = context.insertDot(dot, false)
    }
    return new DotKernelDelta({
      dataStore,
      context: context.compact()
    })
  }

  /**
   * Return a new DotKernel with all dataStore removed, but which preserves its context
   */
  clear (): DotKernel<V> {
    let context: DotContext = new DotContext()
    for (const dot of this.dataStore.keys()) {
      context = context.insertDot(dot, false)
    }
    return new DotKernel({
      dataStore: new IMap(),
      context
    })
  }
}

class DotKernelDelta<V> extends Record({
  dataStore: new IMap(),
  context: new DotContext()
}) {
  get dataStore (): IMap<Dot, V> { return this.get('dataStore') }
  get context (): DotContext { return this.get('context') }
}

module.exports = {
  DotKernel,
  DotKernelDelta
}
