// @flow

const { mergeSets } = require('./util')

class GSet<T> {
  _values: Set<T>

  constructor () {
    this._values = new Set()
  }

  value (): Set<T> {
    return this._values
  }

  has (val: T): boolean {
    return this._values.has(val)
  }

  add (val: T): GSet<T> {
    const res = new GSet()
    this._values.add(val)
    res._values.add(val)
    return res
  }

  join (other: GSet<T>) {
    this._values = mergeSets(this._values, other._values)
  }
}

module.exports = { GSet }
