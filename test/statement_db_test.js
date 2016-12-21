// @flow

const assert = require('assert')
const { describe, it } = require('mocha')

const { StatementDB } = require('../src/peer/db/statement-db')

import type { StatementMsg } from '../src/protobuf/types'

const SEED_STATEMENTS: Array<StatementMsg> = [
  {
    id: 'QmF001234:foo:5678',
    publisher: 'foo',
    namespace: 'scratch.test',
    body: {
      simple: {
        object: 'QmF00123456789',
        refs: ['foo:bar123'],
        tags: ['test'],
        deps: []
      }
    },
    timestamp: Date.now(),
    signature: Buffer.from('')
  }
]

describe('Statement DB', () => {
  const db = new StatementDB()

  it('can put and get statements', () => {
    return Promise.all(SEED_STATEMENTS.map(stmt => db.put(stmt)))
      .then(() => Promise.all(SEED_STATEMENTS.map(stmt => db.get(stmt.id))))
      .then(retrieved => {
        assert.deepEqual(retrieved, SEED_STATEMENTS)
      })
  })
})
