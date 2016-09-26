// @flow

import type { ReplicaID } from './index'
const { GCounter, GCounterDelta } = require('./GCounter')

class PNCounter {
  _p: GCounter
  _n: GCounter

  constructor (id: ReplicaID) {
    this._p = new GCounter(id)
    this._n = new GCounter(id)
  }

  inc (amount: number = 1): PNCounterDelta {
    const res = new PNCounterDelta()
    res._p = this._p.inc(amount)
    return res
  }

  dec (amount: number = 1): PNCounterDelta {
    const res = new PNCounterDelta()
    res._n = this._n.inc(amount)
    return res
  }

  localValue (): number {
    return this._p.localValue() - this._n.localValue()
  }

  value (): number {
    return this._p.value() - this._n.value()
  }

  join (other: PNCounter | PNCounterDelta) {
    this._p.join(other._p)
    this._n.join(other._n)
  }
}

class PNCounterDelta {
  _p: GCounterDelta
  _n: GCounterDelta

  constructor () {
    this._p = new GCounterDelta()
    this._n = new GCounterDelta()
  }
}

module.exports = {
  PNCounter,
  PNCounterDelta
}
