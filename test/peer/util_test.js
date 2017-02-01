const { expect } = require('chai')
const { describe, it } = require('mocha')

const PeerInfo = require('peer-info')
const util = require('../../src/peer/util')

const statementFixtures = require('../resources/fixtures/test-statements')

describe('P2P utils', () => {
  it('lookupResponseToPeerInfo converts from directory lookup to PeerInfo object', () => {
    expect(util.lookupResponseToPeerInfo({})).to.be.null

    const noAddrs = {peer: {id: 'QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Nw'}}
    const noAddrsResult = util.lookupResponseToPeerInfo((noAddrs))
    expect(noAddrsResult).to.be.an.instanceof(PeerInfo)
    expect(noAddrsResult.multiaddrs).to.be.empty
  })

  it('statementsFromQueryResult', () => {
    const simpleStatements = statementFixtures.statements.simple
    const stmt = simpleStatements[0]
    const simpleStatementValue = { stmt }
    const simpleStatementResult = { simple: simpleStatementValue }
    const compoundQueryResult = { compound: { body: [ { key: '1', value: simpleStatementValue } ] } }
    expect(util.statementsFromQueryResult(simpleStatementResult)).to.deep.eql([stmt])
    expect(util.statementsFromQueryResult(compoundQueryResult)).to.deep.eql([stmt])
    expect(util.statementsFromQueryResult({compound: {}})).to.deep.eql([])
    expect(util.statementsFromQueryResult({simple: {intValue: 0}})).to.deep.eql([])
  })

  it('objectIdsFromStatement', () => {
    const statementTypes = ['simple', 'compound', 'envelope', 'envelopeEmpty']
    for (const type of statementTypes) {
      const statements = statementFixtures.statements[type]
      const expectedIds = statementFixtures.objectIds[type]
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        const ids = util.objectIdsFromStatement(stmt)
        expect(ids.length).to.be.eql(expectedIds[i].length)
        for (let id of expectedIds[i]) {
          expect(ids).to.include(id)
        }
      }
    }

    expect(() => {
      util.objectIdsFromStatement({body: {foo: 'bar'}})
    }).to.throw('Unknown statement type')
  })

  it('objectIdsFromQueryResult', () => {
    const stmt = statementFixtures.statements.simple[0]
    const simpleStatementResult = { simple: { stmt } }
    const expectedIds = statementFixtures.objectIds.simple[0]
    expect(util.objectIdsForQueryResult(simpleStatementResult)).to.deep.eql(expectedIds)
  })
})
