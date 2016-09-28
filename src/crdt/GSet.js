// @flow

const { Record, Set: ISet } = require('immutable')

class GSet<T> extends Record({value: new ISet()}) {
  constructor (value?: ISet<T>) {
    super({ value: value || new ISet() })
  }

  get value (): ISet<T> { return this.get('value') }

  // sadly, naming this `has` doesn't correctly override the `has`
  // method in the base class, so it ends up blowing the stack
  contains (val: T): boolean {
    return this.value.has(val)
  }

  add (val: T): GSet<T> {
    return new GSet(this.value.add(val))
  }

  join (other: GSet<T>): GSet<T> {
    return new GSet(this.value.merge(other.value))
  }
}

module.exports = { GSet }
