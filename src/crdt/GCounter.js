// @flow

import type { ReplicaID } from './index'
const { mapEquals } = require('./util')

class GCounter {
  _values: Map<ReplicaID, number>
  id: ReplicaID

  constructor(id: ReplicaID) {
    this.id = id
    this._values = new Map()
  }

  inc (amount: Number = 1): GCounterDelta {
    const res = new GCounterDelta()
    const val = this.localValue() + amount
    this._values.set(this.id, val)
    res._values.set(this.id,  val)
    return res
  }

  value () {
    let res = 0
    for (const v of this._values.values()) {
      res += v
    }
    return res
  }

  localValue () {
    return this._values.get(this.id) || 0
  }

  equals(other: GCounter | GCounterDelta): boolean {
    return mapEquals(this._values, other._values)
  }

  join (other: GCounter | GCounterDelta) {
    for (const [k, v] of other._values.entries()) {
      const local = this._values.get(k) || 0
      this._values.set(k, Math.max(local, v))
    }
  }
}

class GCounterDelta {
  _values: Map<ReplicaID, number>

  constructor () {
    this._values = new Map()
  }
}

module.exports = GCounter