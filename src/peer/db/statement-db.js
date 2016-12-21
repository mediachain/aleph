// @flow

const path = require('path')
const Knex = require('knex')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

type StatementDBOptions = {
  filename: string,
}

const DefaultOptions: StatementDBOptions = {
  filename: ':memory:'
}

class StatementDB {
  db: Knex$Knex
  _migrated: boolean = false

  constructor (options: StatementDBOptions = DefaultOptions) {
    this.db = Knex({
      client: 'sqlite3',
      connection: {
        filename: options.filename
      }
    })
  }

  migrate (): Promise<void> {
    if (this._migrated) return Promise.resolve()

    return this.db.migrate.latest({directory: MIGRATIONS_DIR})
      .then(() => {
        this._migrated = true
      })
  }
}

module.exports = {
  StatementDB
}
