// @flow

const { mergeSets, mapEquals, setEquals } = require('./util')
import type { CRDT } from './index'

// really a positive integer, but no way to encode that as a type
type DotClock = number

class Dot<K> {
  id: K
  clock: DotClock

  constructor (id: K, clock: number) {
    this.id = id
    this.clock = clock
  }

  static fromJSON(jsonString: string): Dot<K> {
    const obj = JSON.parse(jsonString)
    if (obj.id == null) {
      throw new Error('Cannot create Dot from json, required field "id" missing')
    }
    if (obj.clock == null) {
      throw new Error('Cannot create Dot from json, required field "clock" missing')
    }
    return new Dot(obj.id, obj.clock)
  }

  toObject (): { id: K, clock: DotClock } {
    return {id: this.id, clock: this.clock}
  }

  toString (): string {
    return JSON.stringify(this.toObject())
  }
}


class DotContext<K> {
  causalContext: Map<K, number>
  dotCloud: Set<string>

  constructor () {
    this.causalContext = new Map()
    this.dotCloud = new Set()
  }

  equals (other: DotContext<K>): boolean {
    if (!other instanceof DotContext) return false
    if (!mapEquals(this.causalContext, other.causalContext)) return false
    if (!setEquals(this.dotCloud, other.dotCloud)) return false
    return true
  }

  hasDot (dot: Dot<K> | string): boolean {
    if (typeof dot === 'string') dot = Dot.fromJSON(dot)

    const ccDotClock = this.causalContext.get(dot.id)
    if (ccDotClock && ccDotClock <= dot.clock) return true

    return this.dotCloud.has(dot.toString())
  }

  // compact the set of [id, clock] pairs in dotCloud
  // to a Map<id, clock> if possible
  compact () {
    let doneCompacting: boolean = false

    while (!doneCompacting) {
      doneCompacting = true

      for (const dotString of this.dotCloud) {
        const dot = Dot.fromJSON(dotString)
        const ccDotClock = this.causalContext.get(dot.id)

        if (!ccDotClock) { // dot id not present in causalContext
          if (dot.clock === 1) { // at first clock version, can compact
            this.causalContext.set(dot.id, dot.clock)
            this.dotCloud.delete(dotString)
            doneCompacting = false
          }
        } else {
          // there is an entry in causalContext already, compact if possible
          if (dot.clock === ccDotClock + 1) {
            // dotCloud clock is contiguous with value stored in causalContext, can compact
            this.causalContext.set(dot.id, dot.clock)
            this.dotCloud.delete(dotString)
            doneCompacting = false
          } else {
            if (dot.clock <= ccDotClock) {
              // the clock in dotCloud is dominated by the value in causalContext, prune from dotCloud
              this.dotCloud.delete(dotString)
            }
            // if we end up here, dotCloud has a clock that's at least 2 ticks greater than our entry
            // in causalContext, so we keep it in dotCloud until we can (hopefully) compact it later
          }
        }
      }
    }
  }

  makeDot (id: K): Dot<K> {
    let version = this.causalContext.get(id)
    if (version === undefined) {
      version = 1
    } else {
      version += 1
    }
    this.causalContext.set(id, version)
    return new Dot(id, version)
  }

  insertDot (dot: Dot<K> | string, compactImmediately: boolean = true) {
    this.dotCloud.add(dot.toString())
    if (compactImmediately) this.compact()
  }

  join (other: DotContext<K>) {
    if (other === this) return

    for (const [id, otherClock] of other.causalContext.entries()) {
      const ourClock = this.causalContext.get(id)
      if (!ourClock) {
        // we don't have an entry for that ID, use theirs
        this.causalContext.set(id, otherClock)
      } else {
        // we both have entries, update our clock to the max of both clocks
        this.causalContext.set(id, Math.max(ourClock, otherClock))
      }
    }

    this.dotCloud = mergeSets(this.dotCloud, other.dotCloud)
    this.compact()
  }
}

class DotKernel<K, V: CRDT> {
  dots: Map<string, V> // map of (stringified) dots to values
  context: DotContext<K>  // a (possibly shared) context for dot generation

  constructor (context: ?DotContext<K>) {
    if (!context) {
      context = new DotContext()
    }
    this.context = context
    this.dots = new Map()
  }

  equals (other: DotKernel<K, V>): boolean {
    if (!other instanceof DotKernel) return false
    if (!mapEquals(this.dots, other.dots)) return false
    return this.context.equals(other.context)
  }

  join (other: DotKernel<K, V>) {
    if (this === other) return

    const allDots = mergeSets(this.dots.keys(), other.dots.keys())

    for (const dotString of allDots) {
      const ourVal = this.dots.get(dotString)
      const theirVal = this.dots.get(dotString)
      if (ourVal && !theirVal) {
        // dot is only in this kernel, not other
        if (other.context.hasDot(dotString)) {
          // if the other kernel knows this dot (has seen a different version)
          // but doesn't have it now, we delete it from our dots
          this.dots.delete(dotString)
        }
      } else if (theirVal && !ourVal) {
        // dot is only in other kernel
        if (!this.context.hasDot(dotString)) {
          // if dot is not in my context, import it
          this.dots.set(dotString, theirVal)
        }
      } else if (ourVal && theirVal) { // redundant, but makes flow happy
        // dot is in both kernels
        // If the payload is different, join the two CRDTs

        if (!ourVal.equals(theirVal)) {
          ourVal.join(theirVal)
        }
      }
    }

    // join our dot context with theirs
    this.context.join(other.context)
  }

  /// add the key/value pair, returning a DotKernel delta
  add (key: K, val: V): DotKernel<K, V> {
    const delta = new DotKernel()
    const dot = this.context.makeDot(key)
    const dotString = dot.toString()
    this.dots.set(dotString, val)
    delta.dots.set(dotString, val)
    delta.context.insertDot(dot)
    return delta
  }

  /// add the key/value pair, but return the added dot instead of a kernel delta
  dotAdd (key: K, val: V): Dot<K> {
    const dot = this.context.makeDot(key)
    this.dots.set(dot.toString(), val)
    return dot
  }

  // remove all dots matching value, returning a DotKernel delta
  removeValue (val: V) {
    const delta = new DotKernel()
    for (const [dotString, value] of this.dots) {
      if (value.equals(val)) {
        this.dots.delete(dotString)
        // delta knows about removed dots
        delta.context.insertDot(dotString)
      }
    }

    delta.context.compact()
    return delta
  }

  /// remove a dot
  removeDot (dot: Dot<K>): DotKernel<K, V> {
    const delta = new DotKernel()
    const dotString = dot.toString()
    const entry = this.dots.get(dotString)
    if (entry) {
      this.dots.delete(dotString)
      // delta knows about removed dots
      delta.context.insertDot(dot)
    }
    delta.context.compact()
    return delta
  }

  /// remove all dots
  clear (): DotKernel<K, V> {
    const delta = new DotKernel()
    for (const dotString of this.dots.keys()) {
      delta.context.insertDot(dotString)
    }
    delta.context.compact()
    this.dots.clear() // clear the payload, but remember context
    return delta
  }
}

module.exports = {
  Dot,
  DotContext
}
