// @flow

/**
 * @module aleph/peer/db
 */

const path = require('path')
const Knex = require('knex')
const locks = require('locks')
const temp = require('temp').track()
const pb = require('../../protobuf')
const { Statement } = require('../../model/statement')

import type { Mutex } from 'locks'

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

type StatementDBOptions = {
  filename: ?string,
}

const DefaultOptions: StatementDBOptions = {
  filename: null
}

/**
 * A database for mediachain `Statement`s.
 * Used by {@link MediachainNode} for locally storing statements, either created locally or
 * merged from a remote node.
 *
 * Currently defaults to transient (temporary file-backed) storage.
 */
class StatementDB {
  _db: Object
  _migrated: boolean
  _migrationLock: Mutex

  constructor (options: ?StatementDBOptions = DefaultOptions) {
    if (options == null) options = DefaultOptions
    const filename = options.filename || temp.path({prefix: 'aleph-', suffix: '.db'})

    this._db = Knex({
      client: 'sqlite3',
      connection: { filename },
      useNullAsDefault: true
    })
    this._migrated = false
    this._migrationLock = locks.createMutex()
  }

  /**
   * Accessor for the underlying sql DB (via knex query builder).
   * Use this instead of directly accessing the `_db` instance,
   * to ensure that the db migrations are run before accessing
   * the db.
   * @returns {*}
   */
  sqlDB (): Promise<Object> {
    if (this._migrated) return Promise.resolve(this._db)

    return new Promise(resolve => this._migrationLock.lock(() => {
      this._db.migrate.latest({directory: MIGRATIONS_DIR})
        .then(() => {
          this._migrated = true
          this._migrationLock.unlock()
          resolve(this._db)
        })
    }))
  }

  /**
   * Add a {@link Statement} object to the DB.
   * @param stmt
   * @returns {Promise<void>}
   *  Resolves with no value on success, or rejects with an Error if something fails.
   */
  put (stmt: Statement): Promise<void> {
    const msg = stmt.toProtobuf()

    return this.sqlDB().then(db => {
      const data = pb.stmt.Statement.encode(msg)
      const {id, namespace, publisher, timestamp} = stmt
      const refs = Array.from(stmt.refSet)
      return db.transaction(
        // insert statement data
        tx => tx.insert({id, data}).into('Statement')
          // insert envelope
          .then(() => tx.insert({id, namespace, publisher, source: stmt.source, timestamp}).into('Envelope'))
          // insert all refs
          .then(() => Promise.all(refs.map(
            wki => tx.insert({id, wki}).into('Refs')
          )))
      )
    })
  }

  /**
   * Get a statement from the DB using its `id` field.
   * @param id
   *  The `id` string field for a Statement
   * @returns {Promise<Statement>}
   *  Resolves to the `Statement` object on success, or rejects with an `Error` if the statement can't be found, or
   *  an error occurs while fetching it.
   */
  get (id: string): Promise<Statement> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .first('data')
        .where('id', id)
    ).then(decodeStatementRow)
  }

  /**
   * Get all statements that refer to the given "wki" (Well-Known-Identifier) in the `refs` field of the statement body.
   * @param wki
   * @returns {Promise<Array<Statement>>}
   *  Resolves to an array of Statement objects (may be empty).
   *  Rejects with an Error if there's a DB failure while fetching.
   */
  getByWKI (wki: string): Promise<Array<Statement>> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .join('Refs', 'Statement.id', 'Refs.id')
        .select('Statement.data')
        .where('Refs.wki', wki)
    ).then(rows => rows.map(decodeStatementRow))
  }

  /**
   * Get all the statements that are in the given namespace.
   * The `'*'` wildcard can be used to fetch all statements,
   * or those matching a given prefix.
   *
   * @example
   *  db.getByNamespace('*')
   *    .then(statements => {
   *      // statements contains all statements in the db
   *    })
   *
   *  db.getByNamespace('museums.*')
   *    .then(statements => {
   *      // statements will have all `museums.` namespaces,
   *      // e.g. `'museums.moma.*'`, `'museums.tate.*'`, etc.
   *    })
   *
   * @param ns
   * @returns {Promise<Array<Statement>>}
   */
  getByNamespace (ns: string): Promise<Array<Statement>> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .join('Envelope', 'Statement.id', 'Envelope.id')
        .select('Statement.data')
        .whereRaw(namespaceCriteria('Envelope.namespace', ns))
    ).then(rows => rows.map(decodeStatementRow))
  }
}

function decodeStatementRow (row: {data: Buffer}): Statement {
  return Statement.fromBytes(row.data)
}

function namespaceCriteria (field: string, ns: string): string {
  if (ns === '*') {
    return `${field} != ''`
  }
  const starIndex = ns.indexOf('*')
  if (starIndex < 0) {
    return `${field} = '${ns}'`
  }
  const prefix = ns.substr(0, starIndex - 1)
  return `${field} LIKE '%${prefix}%%'`
}

module.exports = {
  StatementDB
}
