// @flow

const { Record } = require('immutable')
import type { KeyType } from './types'

// really a positive integer, but no way to encode that as a type
export type DotClock = number

class Dot extends Record({id: undefined, clock: 1}) {
  constructor (id: KeyType, clock?: DotClock) {
    super({
      id,
      clock: (clock != null) ? clock : 1
    })
  }

  get id (): KeyType { return this.get('id') }
  get clock (): DotClock { return this.get('clock') }
}

module.exports = {
  Dot
}
