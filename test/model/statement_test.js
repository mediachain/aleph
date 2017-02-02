// @flow

const { expect } = require('chai')
const { describe, it, before } = require('mocha')
const { PublisherId, PrivateSigningKey } = require('../../src/peer/identity')
const { Statement, SimpleStatementBody } = require('../../src/model/statement')
const pb = require('../../src/protobuf')
const { setEquals } = require('../../src/common/util')

const fixtures = require('../resources/fixtures/test-statements')
const STMT_TYPES = ['simple', 'compound', 'envelope', 'envelopeEmpty']

describe('Statements', () => {
  let publisherId

  before(() => PrivateSigningKey.fromB58String(fixtures.publisherIds.simple.privateKey58)
    .then(privKey => { publisherId = new PublisherId(privKey) })
  )

  it('converts to/from protobuf representations', () => {
    for (const type of STMT_TYPES) {
      for (const stmtMsg of fixtures.statements[type]) {
        const stmt = Statement.fromProtobuf(stmtMsg)
        expect(stmt.toProtobuf()).to.deep.eql(stmtMsg)

        // convert to/from encoded protobuf bytes
        const bytes = stmt.toBytes()
        expect(bytes).to.deep.eql(pb.stmt.Statement.encode(stmtMsg))
        expect(Statement.fromBytes(bytes).toProtobuf()).to.deep.eql(stmtMsg)
      }
    }
  })

  it('returns the correct source', () => {
    for (const type of STMT_TYPES) {
      for (let i = 0; i < fixtures.statements[type].length; i++) {
        const stmt = Statement.fromProtobuf(fixtures.statements[type][i])
        const expectedSource = fixtures.expectedSources[type][i]
        expect(stmt.source).to.eql(expectedSource)
      }
    }
  })

  it('returns the correct refs', () => {
    for (const type of STMT_TYPES) {
      for (let i = 0; i < fixtures.statements[type].length; i++) {
        const stmt = Statement.fromProtobuf(fixtures.statements[type][i])
        const expectedRefs = fixtures.expectedRefs[type][i]
        expect(setEquals(stmt.refSet, expectedRefs)).to.be.true
      }
    }
  })

  it('returns the correct object ids', () => {
    for (const type of STMT_TYPES) {
      for (let i = 0; i < fixtures.statements[type].length; i++) {
        const stmt = Statement.fromProtobuf(fixtures.statements[type][i])
        const expectedIds = fixtures.objectIds[type][i]
        expect(stmt.objectIds).to.deep.eql(expectedIds)
      }
    }
  })

  describe('constructor', () => {
    it('accepts base64-encoded signatures', () => {
      const stmt = new Statement({
        id: 'foo',
        publisher: 'bar',
        namespace: 'baz',
        timestamp: 1,
        body: new SimpleStatementBody({object: 'foo'}),
        signature: 'SGVsbG8gV29ybGQ='
      })

      expect(stmt.signature).to.deep.eql(Buffer.from('Hello World'))
    })
  })

  describe('Statement.create()', () => {
    it('accepts a StatementBody object or StatementBodyMsg protobuf object', () => {
      const body = new SimpleStatementBody({object: 'foo'})
      let stmt1, stmt2
      return Statement.create(publisherId, 'test.foo', body)
        .then(s => { stmt1 = s })
        .then(() => Statement.create(publisherId, 'test.foo', {simple: body.toProtobuf()}))
        .then(s => { stmt2 = s })
        .then(() => {
          expect(stmt1).to.be.an.instanceof(Statement)
          expect(stmt2).to.be.an.instanceof(Statement)
          expect(stmt1.toProtobuf().body).to.deep.eql(stmt2.toProtobuf().body)
        })
    })
  })
})
