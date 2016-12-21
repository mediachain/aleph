
exports.up = function (knex, Promise) {
  return knex.schema.raw('CREATE TABLE Statement (id VARCHAR(128) PRIMARY KEY, data VARBINARY)')
    .then(() => knex.schema.raw('CREATE TABLE Envelope (counter INTEGER PRIMARY KEY AUTOINCREMENT, id VARCHAR(128), namespace VARCHAR, publisher VARCHAR, source VARCHAR, timestamp INTEGER)'))
    .then(() => knex.schema.raw('CREATE UNIQUE INDEX EnvelopeId ON Envelope (id)'))
    .then(() => knex.schema.raw('CREATE INDEX EnvelopeNS ON Envelope (namespace)'))
    .then(() => knex.schema.raw('CREATE TABLE Refs (id VARCHAR(128), wki VARCHAR)'))
    .then(() => knex.schema.raw('CREATE INDEX RefsId ON Refs (id)'))
    .then(() => knex.schema.raw('CREATE INDEX RefsWki ON Refs (wki)'))
}

exports.down = function (knex, Promise) {
  return knex.schema.raw('DROP INDEX RefsId')
    .then(() => knex.schema.raw('DROP INDEX RefsWki'))
    .then(() => knex.schema.raw('DROP INDEX EnvelopeNS'))
    .then(() => knex.schema.raw('DROP INDEX EnvelopeId'))
    .then(() => knex.schema.raw('DROP TABLE Refs'))
    .then(() => knex.schema.raw('DROP TABLE Envelope'))
    .then(() => knex.schema.raw('DROP TABLE Statement'))
}
