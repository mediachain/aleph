// @flow

const path = require('path')
const Knex = require('knex')
const locks = require('locks')
const pb = require('../../protobuf')

import type { StatementMsg, SimpleStatementMsg, EnvelopeStatementMsg, CompoundStatementMsg } from '../../protobuf/types'
import type { Mutex } from 'locks'

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

type StatementDBOptions = {
  filename: string,
}

const DefaultOptions: StatementDBOptions = {
  filename: ':memory:'
}

class StatementDB {
  _db: Object
  _migrated: boolean
  _migrationLock: Mutex

  constructor (options: ?StatementDBOptions = DefaultOptions) {
    if (options == null) options = DefaultOptions

    this._db = Knex({
      client: 'sqlite3',
      connection: {
        filename: options.filename
      },
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
      if (this._migrated) return resolve(this._db)
      this._db.migrate.latest({directory: MIGRATIONS_DIR})
        .then(() => {
          this._migrated = true
          this._migrationLock.unlock()
          resolve(this._db)
        })
    }))
  }

  put (stmt: StatementMsg): Promise<void> {
    return this.sqlDB().then(db => {
      const data = pb.stmt.Statement.encode(stmt)
      const {id, namespace, publisher, timestamp} = stmt
      const refs = Array.from(statementRefs(stmt))
      return db.transaction(
        // insert statement data
        tx => tx.insert({id, data}).into('Statement')
          // insert envelope
          .then(() => tx.insert({id, namespace, publisher, source: statementSource(stmt), timestamp}).into('Envelope'))
          // insert all refs
          .then(() => Promise.all(refs.map(
            wki => tx.insert({id, wki}).into('Refs')
          )))
      )
    })
  }

  get (id: string): Promise<StatementMsg> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .first('data')
        .where('id', id)
    ).then(decodeStatementRow)
  }

  getByWKI (wki: string): Promise<Array<StatementMsg>> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .join('Refs', 'Statement.id', 'Refs.id')
        .select('Statement.data')
        .where('Refs.wki', wki)
    ).then(rows => rows.map(decodeStatementRow))
  }

  getByNamespace (ns: string): Promise<Array<StatementMsg>> {
    return this.sqlDB().then(db =>
      db.table('Statement')
        .join('Envelope', 'Statement.id', 'Envelope.id')
        .select('Statement.data')
        .whereRaw(namespaceCriteria('Envelope.namespace', ns))
    ).then(rows => rows.map(decodeStatementRow))
  }
}

function decodeStatementRow (row: {data: Buffer}): StatementMsg {
  return pb.stmt.Statement.decode(row.data)
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

// TODO: move these helpers elsewhere

function statementSource (stmt: StatementMsg): string {
  if (stmt.body.envelope !== undefined) {
    const envelopeStatement: EnvelopeStatementMsg = (stmt.body.envelope: any)  // stupid flow typecast
    if (envelopeStatement.body.length > 0) {
      return statementSource(envelopeStatement.body[0])
    }
  }
  return stmt.publisher
}

function statementRefs (stmt: StatementMsg): Set<string> {
  if (stmt.body.simple !== undefined) {
    return simpleStmtRefs((stmt.body.simple: any))
  }
  if (stmt.body.compound !== undefined) {
    return compoundStmtRefs((stmt.body.compound: any))
  }
  if (stmt.body.envelope !== undefined) {
    return envelopeStmtRefs((stmt.body.envelope: any))
  }
  throw new Error('Invalid statement type (expected simple, compound, or envelope)')
}

function simpleStmtRefs (stmt: SimpleStatementMsg): Set<string> {
  return new Set(stmt.refs)
}

function compoundStmtRefs (stmt: CompoundStatementMsg): Set<string> {
  let allRefs: Set<string> = new Set()
  for (const simpleStmt of stmt.body) {
    allRefs = union(allRefs, simpleStmtRefs(simpleStmt))
  }
  return allRefs
}

function envelopeStmtRefs (stmt: EnvelopeStatementMsg): Set<string> {
  let allRefs: Set<string> = new Set()
  for (const innerStmt of stmt.body) {
    allRefs = union(allRefs, statementRefs(innerStmt))
  }
  return allRefs
}

function union<T> (a: Set<T>, b: Set<T>): Set<T> {
  const u = new Set(a)
  for (const elem of b) {
    u.add(elem)
  }
  return u
}

module.exports = {
  StatementDB
}
