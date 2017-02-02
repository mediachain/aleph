// @flow

const { assert, expect } = require('chai')
const { describe, it } = require('mocha')
const {
  unpackQueryResultProtobuf,
  unpackQueryResultValueProtobuf,
  CompoundQueryResultValue
} = require('../../src/model/query_result')

const { Statement, StatementBody } = require('../../src/model/statement')

const statementFixtures = require('../resources/fixtures/test-statements')

describe('Query Result unpacking', () => {
  it('Unpacks simple values', () => {
    expect(unpackQueryResultValueProtobuf({simple: {stringValue: 'hello'}}))
      .to.be.eql('hello')

    expect(unpackQueryResultValueProtobuf({simple: {intValue: 42}}))
      .to.be.eql(42)

    const stmt = statementFixtures.statements.simple[0]
    const unpackedStmt = unpackQueryResultValueProtobuf({simple: {stmt}})
    if (!(unpackedStmt instanceof Statement)) {
      assert(false, 'statement query result should unpack to Statement object')
      return
    }
    expect(unpackedStmt.toProtobuf()).to.deep.eql(stmt)

    const stmtBody = stmt.body
    const unpackedBody = unpackQueryResultValueProtobuf({simple: {stmtBody}})
    if (!(unpackedBody instanceof StatementBody)) {
      assert(false, 'statement body query result should unpack to StatementBody object')
    }

    let invalid: any = {simple: {fooValue: 42}}
    expect(() => unpackQueryResultValueProtobuf(invalid))
      .to.throw('Unexpected query result value')

    invalid = {amazing: {intValue: 42}}
    expect(() => unpackQueryResultValueProtobuf(invalid))
      .to.throw('Unexpected query result value')
  })

  it('Unpacks compound values and query errors', () => {
    const err: any = unpackQueryResultProtobuf({error: {error: 'Oh no!'}})
    expect(err).to.be.an.instanceof(Error)
    expect(err.message).to.be.eql('Oh no!')

    const errNoMessage: any = unpackQueryResultProtobuf(({error: {}}: any))
    expect(errNoMessage).to.be.an.instanceof(Error)
    expect(errNoMessage.message).to.be.eql('Unknown error')
  })

  const stmt = statementFixtures.statements.simple[0]
  const compoundResult = {
    value: {
      compound: {
        body: [
          {key: 'foo', value: {stringValue: 'bar'}},
          {key: 'The Answer', value: {intValue: 42}},
          {key: 'statement', value: {stmt}}
        ]
      }
    }
  }

  const unpackedCompound = unpackQueryResultProtobuf(compoundResult)
  if (!(unpackedCompound instanceof CompoundQueryResultValue)) {
    assert(false, 'compound query results should unpack to CompoundQueryResultValue objects')
    return
  }
  expect(unpackedCompound.statements()).to.have.length(1)
  expect(unpackedCompound.keys()).to.deep.eql(['foo', 'The Answer', 'statement'])
  expect(unpackedCompound.values()).to.include('bar', 42)

  const invalid: any = {foo: 'bar'}
  expect(() => unpackQueryResultProtobuf(invalid))
    .to.throw('Unexpected query result')
})
