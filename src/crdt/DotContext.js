// @flow

const { Map: IMap, Set: ISet, Record, is: isEqual } = require('immutable')
const { Dot } = require('./Dot')
import type { KeyType } from './types'
import type { DotClock } from './Dot'

class DotContext extends Record({
  causalContext: new IMap(), // IMap<KeyType, DotClock>
  dotCloud: new ISet()       // ISet<Dot>
}) {

  get causalContext (): IMap<KeyType, DotClock> { return this.get('causalContext') }
  get dotCloud (): ISet<Dot> { return this.get('dotCloud') }

  hasDot (dot: Dot): boolean {
    const ccDotClock = this.causalContext.get(dot.id)
    if (ccDotClock !== undefined && dot.clock <= ccDotClock) return true

    return this.dotCloud.has(dot)
  }

  // compact the set of [id, clock] pairs in dotCloud
  // to a Map<id, clock> if possible
  compact (): DotContext {
    let doneCompacting: boolean = false
    let cc: IMap<KeyType, DotClock> = this.causalContext
    let dc: ISet<Dot> = this.dotCloud

    // TODO: use .asMutable / .asImmutable to avoid churning through immutable collections

    while (!doneCompacting) {
      doneCompacting = true

      for (const dot of this.dotCloud) {
        const ccDotClock = cc.get(dot.id)

        if (ccDotClock === undefined) { // dot id not present in causalContext
          if (dot.clock === 1) { // at first clock version, can compact
            cc = cc.set(dot.id, dot.clock)
            dc = dc.delete(dot)
            doneCompacting = false
          }
        } else {
          // there is an entry in causalContext already, compact if possible
          if (dot.clock === ccDotClock + 1) {
            // dotCloud clock is contiguous with value stored in causalContext, can compact
            cc = cc.set(dot.id, dot.clock)
            dc = dc.delete(dot)
            doneCompacting = false
            console.log()
          } else {
            if (dot.clock <= ccDotClock) {
              // the clock in dotCloud is dominated by the value in causalContext, prune from dotCloud
              dc = dc.delete(dot)
            }
            // if we end up here, dotCloud has a clock that's at least 2 ticks greater than our entry
            // in causalContext, so we keep it in dotCloud until we can (hopefully) compact it later
          }
        }
      }
    }

    return new DotContext({causalContext: cc, dotCloud: dc})
  }

  makeDot (id: KeyType): {dot: Dot, context: DotContext } {
    let clock = this.causalContext.get(id)
    if (clock === undefined) {
      clock = 1
    } else {
      clock += 1
    }
    const dot = new Dot(id, clock)
    const withDot = this.set('causalContext', this.causalContext.set(dot.id, clock))
    return {dot, context: withDot}
  }

  insertDot (dot: Dot, compactImmediately: boolean = true): DotContext {
    const withDot = this.set('dotCloud', this.dotCloud.add(dot))
    if (compactImmediately) return withDot.compact()
    else return withDot
  }

  join (other: DotContext): DotContext {
    if (isEqual(this, other)) return other

    let cc = this.causalContext
    for (const [id, otherClock] of other.causalContext.entries()) {
      const ourClock = cc.get(id)
      if (!ourClock) {
        // we don't have an entry for that ID, use theirs
        cc = cc.set(id, otherClock)
      } else {
        // we both have entries, update our clock to the max of both clocks
        cc = cc.set(id, Math.max(ourClock, otherClock))
      }
    }

    const dc = this.dotCloud.merge(other.dotCloud)
    return new DotContext({causalContext: cc, dotCloud: dc})
      .compact()
  }
}

module.exports = {
  DotContext
}
