// @flow

const { mergeSets } = require('./util')

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

module.exports = {
  Dot,
  DotContext
}
