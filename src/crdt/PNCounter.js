// @flow

import type { ReplicaID } from './types'

const { Record } = require('immutable')
const { GCounter, GCounterDelta } = require('./GCounter')

class PNCounter extends Record({p: new GCounter(), n: new GCounter()}) {
  constructor (id: ReplicaID) {
    super({
      p: new GCounter({id}),
      n: new GCounter({id})
    })
  }

  get p (): GCounter { return this.get('p') }
  get n (): GCounter { return this.get('n') }

  join (other: PNCounter | PNCounterDelta): PNCounter {
    return this
      .set('p', this.p.join(other.p))
      .set('n', this.n.join(other.n))
  }

  get localValue (): number {
    return this.p.localValue - this.n.localValue
  }

  get value (): number {
    return this.p.value - this.n.value
  }

  inc (amount: number = 1): PNCounter {
    return this.join(this.incDelta(amount))
  }

  incDelta (amount: number = 1): PNCounterDelta {
    return new PNCounterDelta({
      p: this.p.incDelta(amount)
    })
  }

  dec (amount: number = 1): PNCounter {
    return this.join(this.decDelta(amount))
  }

  decDelta (amount: number = 1): PNCounterDelta {
    return new PNCounterDelta({
      n: this.n.incDelta(amount)
    })
  }
}

class PNCounterDelta extends Record({p: new GCounterDelta(), n: new GCounterDelta()}) {
  get p (): GCounterDelta { return this.get('p') }
  get n (): GCounterDelta { return this.get('n') }
}

module.exports = {
  PNCounter,
  PNCounterDelta
}
