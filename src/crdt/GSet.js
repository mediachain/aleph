// @flow

const { Record, Set: ISet } = require('immutable')

class GSet<T> extends Record({value: new ISet()}) {
  get value (): ISet<T> { return this.get('value') }

  has (val: T): boolean {
    return this.value.has(val)
  }

  add (val: T): GSet<T> {
    return new GSet({value: this.value.add(val)})
  }

  join (other: GSet<T>): GSet<T> {
    return new GSet({value: this.value.merge(other.value)})
  }
}

module.exports = { GSet }
