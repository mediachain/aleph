// @flow

const { Record } = require('immutable')
import type { KeyType } from './types'

// really a positive integer, but no way to encode that as a type
export type DotClock = number

class Dot extends Record({id: '', clock: 1}) {
  constructor (id: KeyType, clock?: DotClock) {
    if (clock == null) clock = 1
    if (clock < 1) throw new Error('Dot clock must be a positive number')

    super({id, clock})
  }

  get id (): KeyType { return this.get('id') }
  get clock (): DotClock { return this.get('clock') }
}

module.exports = {
  Dot
}
