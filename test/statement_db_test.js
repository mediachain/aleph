// @flow

const assert = require('assert')
const { before, describe, it } = require('mocha')

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
  },
  {
    id: 'QmF001234:foo:6789',
    publisher: 'foo',
    namespace: 'scratch.blah',
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

  before(() => db.sqlDB()
    .then(() => Promise.all(SEED_STATEMENTS.map(stmt => db.put(stmt)))))

  it('can get statements by id', () =>
    Promise.all(SEED_STATEMENTS.map(stmt => db.get(stmt.id)))
      .then(retrieved => {
        assert.deepEqual(retrieved, SEED_STATEMENTS)
      })
  )

  it('can get statements by WKI', () =>
    db.getByWKI('foo:bar123')
      .then(results => {
        assert.deepEqual(results[0], SEED_STATEMENTS[0])
      }))

  it('can get statements by namespace', () =>
    Promise.all([
      db.getByNamespace('scratch.test')
        .then(results => {
          assert.deepEqual(results[0], SEED_STATEMENTS[0])
        }),
      db.getByNamespace('nothing.here')
        .then(results => assert.equal(results.length, 0))
    ]))

  it('can use wildcards in namespace queries', () =>
    Promise.all([
      db.getByNamespace('*')
        .then(results => {
          assert.deepEqual(results, SEED_STATEMENTS)
        }),
      db.getByNamespace('scratch.*')
        .then(results => {
          assert.deepEqual(results, SEED_STATEMENTS)
        })
    ]))
})
