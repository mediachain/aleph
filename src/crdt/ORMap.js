// @flow

const { Record, Map: IMap } = require('immutable')
const { AWORSet, AWORSetDelta } = require('./AWORSet')
const { DotContext } = require('./DotContext')
import type { KeyType, ReplicaID } from './types'

class ORMap<V> extends Record({
  id: '',
  keys: new AWORSet(''),
  values: new IMap()
}) {
  constructor (id: ReplicaID, context?: DotContext) {
    if (context == null) {
      context = new DotContext()
    }
    super({
      id,
      keys: new AWORSet(id, context),
      values: new IMap()
    })
  }

  static make (keySet: AWORSet<KeyType>, values: IMap<KeyType, V>): ORMap<V> {
    return new ORMap(keySet.id, keySet.context)
      .set('keys', keySet)
      .set('values', values)
  }

  get id (): ReplicaID { return this.get('id') }
  get keys (): AWORSet<KeyType> { return this.get('keys') }
  get values (): IMap<KeyType, V> { return this.get('values') }
  get context (): DotContext { return this.keys.context }

  // would be nice to "swizzle" the base class's `get` method,
  // so we could just call this `get`
  getValue (key: KeyType): ?V {
    return this.values.get(key)
  }

  contains (key: KeyType): boolean {
    return this.values.has(key)
  }

  add (key: KeyType, value: V): ORMap<V> {
    return this.join(this.addDelta(key, value))
  }

  addDelta (key: KeyType, value: V): ORMapDelta<V> {
    return new ORMapDelta({
      keys: this.keys.addDelta(key),
      values: new IMap([[key, value]])
    })
  }

  remove (key: KeyType): ORMap<V> {
    return this.join(this.removeDelta(key))
  }

  removeDelta (key: KeyType): ORMapDelta<V> {
    return new ORMapDelta({
      keys: this.keys.removeDelta(key),
      values: new IMap()
    })
  }

  join (other: ORMap<V> | ORMapDelta<V>): ORMap<V> {
    const keys = this.keys.join(other.keys)
    const values = this.values.merge(other.values)
      .filter((v, k) => keys.contains(k)) // only keep entries whose keys are in the merged keyset

    return ORMap.make(
      this.keys.join(other.keys),
      values
    )
  }
}

class ORMapDelta<V> extends Record({
  keys: new AWORSetDelta(),
  values: new IMap()
}) {
  get keys (): AWORSetDelta<KeyType> { return this.get('keys') }
  get values (): IMap<KeyType, V> { return this.get('values') }
}

module.exports = {
  ORMap,
  ORMapDelta
}
