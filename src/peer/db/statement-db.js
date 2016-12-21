// @flow

const knex = require('knex')

type StatementDBOptions = {
  filename: string,
}

const DefaultOptions: StatementDBOptions = {
  filename: ':memory:'
}

class StatementDB {
  knex: Knex$Knex

  constructor (options: StatementDBOptions = DefaultOptions) {
    this.knex = knex({
      client: 'sqlite3',
      connection: {
        filename: options.filename
      }
    })
  }
}

module.exports = {
  StatementDB
}
