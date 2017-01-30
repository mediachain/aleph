// @flow

const { expect } = require('chai')
const { describe, it } = require('mocha')
const { statementSource, statementRefs } = require('../../src/metadata/statement')

const fixtures = require('../resources/fixtures/test-statements')

describe('Statement source/refs helpers', () => {
  it('statementSource returns the publisher field for simple and compound statements and empty envelope statements', () => {
    const simplePublisher = fixtures.publisherIds.simple.id58
    const compoundPublisher = fixtures.publisherIds.compound.id58
    const envelopePublisher = fixtures.publisherIds.envelope.id58

    for (let i = 0; i < fixtures.statements.simple.length; i++) {
      const stmt = fixtures.statements.simple[i]
      expect(statementSource(stmt)).to.be.eql(simplePublisher)
    }

    for (let i = 0; i < fixtures.statements.compound.length; i++) {
      const stmt = fixtures.statements.compound[i]
      expect(statementSource(stmt)).to.be.eql(compoundPublisher)
    }

    expect(statementSource(fixtures.statements.envelopeEmpty[0]))
      .to.be.eql(envelopePublisher)
  })

  it('statementSource returns the publisher of the first contained statement for envelope statements', () => {
    for (let i = 0; i < fixtures.statements.compound.length; i++) {
      const stmt = fixtures.statements.envelope[i]
      expect(statementSource(stmt)).to.be.eql(stmt.body.envelope.body[0].publisher)
    }
  })

  it('statementRefs gets all refs from simple, compound, and envelope statements', () => {
    const statementTypes = ['simple', 'compound', 'envelope', 'envelopeEmpty']
    for (const type of statementTypes) {
      const statements = fixtures.statements[type]
      const expectedRefs = fixtures.expectedRefs[type]
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        const refs = Array.from(statementRefs(stmt))
        expect(refs.length).to.be.eql(expectedRefs[i].length)
        for (const r of expectedRefs[i]) {
          expect(refs).to.include(r)
        }
      }
    }

    expect(() => {
      const invalidStmt: any = {body: {foo: 'bar'}}
      statementRefs(invalidStmt)
    }).to.throw(/Invalid statement type/)
  })
})
