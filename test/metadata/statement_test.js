// @flow

const { expect } = require('chai')
const { before, describe, it } = require('mocha')
const { statementSource, statementRefs } = require('../../src/metadata/statement')

const SIMPLE_STMT_1 = {
  id: 'simple:1',
  namespace: 'scratch.test',
  publisher: 'simple-stmt-publisher',
  timestamp: 12345678,
  body: {
    simple: {
      object: 'foo',
      refs: ['simple-1'],
      deps: [],
      tags: []
    }
  },
  signature: Buffer.from('')
}

const SIMPLE_STMT_2 = {
  id: 'simple:2',
  namespace: 'scratch.test',
  publisher: 'simple-stmt-publisher',
  timestamp: 12345678,
  body: {
    simple: {
      object: 'bar',
      refs: ['simple-2'],
      deps: [],
      tags: []
    }
  },
  signature: Buffer.from('')
}

const COMPOUND_STMT = {
  id: 'compound:1',
  namespace: 'scratch.test',
  publisher: 'compound-stmt-publisher',
  timestamp: 12345678,
  body: {
    compound: {
      body: [
        SIMPLE_STMT_1.body.simple,
        SIMPLE_STMT_2.body.simple
      ]
    }
  },
  signature: Buffer.from('')
}

const ENVELOPE_STMT = {
  id: 'envelope:1',
  namespace: 'scratch.test',
  publisher: 'envelope-stmt-publisher',
  timestamp: 12345678,
  body: {
    envelope: {
      body: [
        SIMPLE_STMT_1,
        SIMPLE_STMT_2
      ]
    }
  },
  signature: Buffer.from('')
}

const EMPTY_ENVELOPE_STMT = {
  id: 'envelope:1',
  namespace: 'scratch.test',
  publisher: 'envelope-stmt-publisher',
  timestamp: 12345678,
  body: {
    envelope: {
      body: []
    }
  },
  signature: Buffer.from('')
}

describe('Statement source/refs helpers', () => {
  it('statementSource returns the publisher field for simple and compound statements and empty envelope statements', () => {
    expect(statementSource(SIMPLE_STMT_1))
      .to.be.eql(SIMPLE_STMT_1.publisher)

    expect(statementSource(COMPOUND_STMT))
      .to.be.eql(COMPOUND_STMT.publisher)

    expect(statementSource(EMPTY_ENVELOPE_STMT))
      .to.be.eql(EMPTY_ENVELOPE_STMT.publisher)
  })

  it('statmentSource returns the publisher of the first contained statement for envelope statements', () => {
    expect(statementSource(ENVELOPE_STMT))
      .to.be.eql(SIMPLE_STMT_1.publisher)
  })

  it('statementRefs gets all refs from simple, compound, and envelope statements', () => {
    expect(Array.from(statementRefs(SIMPLE_STMT_1)))
      .to.have.members(['simple-1'])
    expect(Array.from(statementRefs(COMPOUND_STMT)))
      .to.have.members(['simple-1', 'simple-2'])
    expect(Array.from(statementRefs(ENVELOPE_STMT)))
      .to.have.members(['simple-1', 'simple-2'])

    expect(() => {
      const invalidStmt: any = {body: {foo: 'bar'}}
      statementRefs(invalidStmt)
    }).to.throw(/Invalid statement type/)
  })
})
