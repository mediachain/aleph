// @flow

const { Map: IMap, Record } = require('immutable')
import type { ReplicaID } from './index'

class GCounter extends Record({id: '', values: new IMap()}, 'GCounter') {
  get id (): ReplicaID { return this.get('id') }
  get values (): IMap<ReplicaID, number> { return this.get('values') }

  get localValue (): number {
    return this.values.get(this.id) || 0
  }

  get value (): number {
    let res = 0
    for (const v of this.values.values()) {
      res += v
    }
    return res
  }

  inc (amount: number = 1): GCounter {
    return this.join(
      this.incDelta(amount)
    )
  }

  incDelta (amount: number = 1): GCounterDelta {
    const val = this.localValue + amount
    return new GCounterDelta({
      values: new IMap([[this.id, val]])
    })
  }

  join (other: GCounter | GCounterDelta): GCounter {
    // $FlowIgnore the flow definition for mergeWith is broken :(
    const mergedVals: IMap<ReplicaID, number> =
      this.values.mergeWith(
        // $FlowIgnore
        (aVal, bVal) => Math.max(aVal, bVal),
        other.values)

    return new GCounter({
      id: this.id,
      values: mergedVals
    })
  }
}

class GCounterDelta extends Record({values: new IMap()}, 'GCounterDelta') {
  get values (): IMap<ReplicaID, number> { return this.get('values') }
}

module.exports = {
  GCounter,
  GCounterDelta
}
