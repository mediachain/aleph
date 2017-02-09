// @flow

const { assert, expect } = require('chai')
const { before, describe, it } = require('mocha')
const path = require('path')
const { StatementDB } = require('../../src/peer/db/index')
const { Statement } = require('../../src/model/statement')

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'src', 'peer', 'db', 'migrations')

const SEED_STATEMENTS: Array<Statement> = [
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
        refs: ['foo:bar456'],
        tags: ['test'],
        deps: []
      }
    },
    timestamp: Date.now(),
    signature: Buffer.from('')
  }
].map(stmt => Statement.fromProtobuf(stmt))

describe('Statement DB', () => {
  const db = new StatementDB(null)

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
        const expected = SEED_STATEMENTS.filter((stmt: Statement) => stmt.refSet.has('foo:bar123'))
        assert.deepEqual(results, expected)
      }))

  it('can get statements by namespace', () =>
    Promise.all([
      db.getByNamespace('scratch.test')
        .then(results => {
          const expected = SEED_STATEMENTS.filter(stmt => stmt.namespace === 'scratch.test')
          assert.deepEqual(results, expected)
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
          const expected = SEED_STATEMENTS.filter(stmt => stmt.namespace.startsWith('scratch.'))
          assert.deepEqual(results, expected)
        })
    ]))
})

describe('StatementDB migrations', () => {
  it('migrates and rolls back', () => {
    const db = new StatementDB()
    let sqlDB
    return db.sqlDB()
      .then(_sqlDB => { sqlDB = _sqlDB })
      .then(() => sqlDB.select().table('Statement'))
      .then(result => {
        expect(result).to.exist
      })
      .then(() => sqlDB.migrate.rollback({
        directory: MIGRATIONS_DIR
      }))
      .then(() =>
        sqlDB.select().table('Statement')
          .catch(err => {
            expect(err).to.be.an.instanceof(Error)
          })
      )
  })
})
