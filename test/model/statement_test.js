// @flow

const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai
const { describe, it, before } = require('mocha')
const { PublisherId, PrivateSigningKey } = require('../../src/peer/identity')
const { Statement, SignedStatement, UnsignedStatement, StatementBody, SimpleStatementBody, ExpandedSimpleStatementBody, CompoundStatementBody, EnvelopeStatementBody } = require('../../src/model/statement')
const pb = require('../../src/protobuf')
const { setEquals, stringifyNestedBuffers } = require('../../src/common/util')
const { inspect } = require('util')

const fixtures = require('../resources/fixtures/test-statements')
const STMT_TYPES = ['simple', 'compound', 'envelope', 'envelopeEmpty']

describe('Statements', () => {
  const publisherIds: Object = {}
  before(() =>
    PrivateSigningKey.fromB58String(fixtures.publisherIds.simple.privateKey58)
      .then(privKey => { publisherIds.simple = new PublisherId(privKey) })
      .then(() => PrivateSigningKey.fromB58String(fixtures.publisherIds.compound.privateKey58))
      .then(privKey => { publisherIds.compound = new PublisherId(privKey) })
      .then(() => PrivateSigningKey.fromB58String(fixtures.publisherIds.envelope.privateKey58))
      .then(privKey => { publisherIds.envelope = new PublisherId(privKey) })
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

        // JSON output should be equivalent to protobuf message, but with Buffers encoded to base64
        const expectedJSON = stringifyNestedBuffers(stmtMsg)
        expect(stmt.toJSON()).to.deep.eql(expectedJSON)
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

  it('returns the correct deps', () => {
    for (const type of STMT_TYPES) {
      for (let i = 0; i < fixtures.statements[type].length; i++) {
        const stmt = Statement.fromProtobuf(fixtures.statements[type][i])
        const expectedDeps = fixtures.expectedDeps[type][i]
        expect(setEquals(stmt.depsSet, expectedDeps)).to.be.true
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
      const stmt = new SignedStatement({
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

  describe('inspect', () => {
    const stmt = new SignedStatement({
      id: 'foo',
      publisher: 'bar',
      namespace: 'baz',
      timestamp: 1,
      body: new SimpleStatementBody({object: 'foo'}),
      signature: Buffer.from('Hello World')
    })

    it('includes a base64-encoded signature for SignedStatements', () => {
      const {id, publisher, namespace, timestamp, body, signature} = stmt
      const expectedOutput = {
        id,
        publisher,
        namespace,
        timestamp,
        body: body.inspect(),
        signature: signature.toString('base64')
      }

      expect(stmt.inspect())
        .to.deep.eql(expectedOutput)
    })

    it('does not include a signature for UnsignedStatements', () => {
      const unsigned = stmt.asUnsignedStatement()
      const {id, publisher, namespace, timestamp, body} = unsigned
      const expectedOutput = {
        id,
        publisher,
        namespace,
        timestamp,
        body: body.inspect()
      }

      expect(unsigned.inspect())
        .to.deep.eql(expectedOutput)
    })
  })

  describe('expandObjects()', () => {
    const stmt = Statement.fromProtobuf(fixtures.statements.envelope[0])
    if (!(stmt instanceof SignedStatement)) {
      // throwing here makes flow happy
      throw new Error('Fixture statement was not signed')
    }
    const dataObjects = new Map(
      stmt.objectIds.map(key => [key, {foo: 'bar'}])
    )

    it('returns a statement of the same type (signed vs unsigned)', () => {
      expect(stmt.expandObjects(dataObjects))
        .to.be.an.instanceof(SignedStatement)

      expect(stmt.asUnsignedStatement().expandObjects(dataObjects))
        .to.be.an.instanceof(UnsignedStatement)
    })
  })

  describe('SignedStatement.create()', () => {
    it('accepts a StatementBody object or StatementBodyMsg protobuf object', () => {
      const body = new SimpleStatementBody({object: 'foo'})
      let stmt1, stmt2
      return SignedStatement.create(publisherIds.simple, 'test.foo', body)
        .then(s => { stmt1 = s })
        .then(() => SignedStatement.create(publisherIds.simple, 'test.create', body.toProtobuf()))
        .then(s => { stmt2 = s })
        .then(() => {
          expect(stmt1).to.be.an.instanceof(SignedStatement)
          expect(stmt2).to.be.an.instanceof(SignedStatement)
          expect(stmt1.toProtobuf().body).to.deep.eql(stmt2.toProtobuf().body)
        })
    })
  })

  describe('SignedStatement.createSimple()', () => {
    it('accepts an object reference string', () => {
      const object = 'QmREZU7Pqv3ezGWnXQiHXCm2uipjdHkuXWRygx5gMt4Bwq'
      return SignedStatement.createSimple(publisherIds.simple, 'test.createSimple', {object})
        .then(stmt => {
          expect(stmt).to.be.an.instanceof(Statement)
          expect(stmt.body).to.be.an.instanceof(SimpleStatementBody)
          expect(stmt.objectIds).to.contain(object)
        })
    })

    it('accepts a JS object to create an statement with expanded body', () => {
      const object = {foo: 'bar'}
      const objectHash = 'QmREZU7Pqv3ezGWnXQiHXCm2uipjdHkuXWRygx5gMt4Bwq'
      return SignedStatement.createSimple(publisherIds.simple, 'test.createSimple.expandedBody', {object})
        .then(stmt => {
          expect(stmt).to.be.an.instanceof(Statement)
          expect(stmt.objectIds).to.contain(objectHash)
          expect(stmt.body).to.be.an.instanceof(ExpandedSimpleStatementBody)
          expect((stmt: any).body.object).to.deep.eql(object)
        })
    })
  })

  describe('SignedStatement.fromProtobuf()', () => {
    it('throws if protobuf message does not have a signature', () => {
      expect(() => SignedStatement.fromProtobuf({
        id: 'foo',
        namespace: 'bar',
        publisher: 'baz',
        timestamp: 1234,
        body: {simple: {object: 'foo', refs: [], deps: [], tags: []}}
      }))
        .to.throw('requires a non-null signature')
    })
  })

  describe('UnsignedStatement.sign()', () => {
    it('produces a correct signature when signed by the publishers key', () => {
      const promises = []

      for (const type of [ 'simple', 'compound', 'envelope' ]) {
        const statements = fixtures.statements[ type ]
        const publisherId = publisherIds[ type ]
        const publicKey = publisherId.privateKey.publicKey

        for (const stmtMsg of statements) {
          const stmt = SignedStatement.fromProtobuf(stmtMsg)
          const promise = stmt.verifySignature(publicKey)
            .then(() => {
              const unsigned = stmt.asUnsignedStatement()
              return unsigned.sign(publisherId)
                .then(signedStmt => {
                  expect(signedStmt).to.be.an.instanceof(SignedStatement)
                  expect(signedStmt.signature).to.deep.eql(stmt.signature)
                })
            })
          promises.push(promise)
        }
      }

      return Promise.all(promises)
    })

    it('fails when signing with a PublisherId that does not match the statement', () => {
      const stmt = Statement.fromProtobuf(fixtures.statements.simple[0]).asUnsignedStatement()
      return expect(stmt.sign(publisherIds.compound))
        .to.eventually.be.rejectedWith('publisher id of signer does not match statement publisher')
    })
  })
})

describe('StatementBody base class', () => {
  it('throws if you try to instantiate it directly', () => {
    expect(() => new StatementBody())
      .to.throw('abstract')
  })

  it('toProtobuf throws if you manage to instantiate one', () => {
    const stmt = Object.create(StatementBody.prototype)
    expect(() => stmt.toProtobuf())
      .to.throw('not implemented')
  })

  it('returns empty values for refSet, etc.', () => {
    const stmt = Object.create(StatementBody.prototype)
    expect(stmt.refSet.size).to.be.eql(0)
    expect(stmt.depsSet.size).to.be.eql(0)
    expect(stmt.objectIds.length).to.be.eql(0)
    expect(stmt.expandObjects(new Map())).to.be.eql(stmt)
    expect(stmt.inspect()).to.deep.eql({})
  })

  it('fromProtobuf throws on unrecognized body type', () => {
    expect(() => StatementBody.fromProtobuf({foo: {object: 'foo'}}))
      .to.throw('Unsupported')
  })
})

describe('StatementBody subclasses', () => {
  describe('SimpleStatementBody', () => {
    it('returns a js object from inspect()', () => {
      const body = new SimpleStatementBody({object: 'foo', refs: ['bar']})
      expect(body.inspect()).to.deep.eql({object: 'foo', refs: ['bar'], deps: [], tags: []})
    })

    it('can be expanded into an ExpandedSimpleStatementBody', () => {
      const body = new SimpleStatementBody({object: 'foo'})
      const expanded = body.expandObjects(new Map([['foo', {foo: 'bar'}]]))
      expect(expanded).to.be.an.instanceof(ExpandedSimpleStatementBody)
      expect(expanded.object).to.deep.eql({foo: 'bar'})
    })

    it('fails to expand if no match for object reference is found', () => {
      const body = new SimpleStatementBody({object: 'foo'})
      expect(() => body.expandObjects(new Map()))
        .to.throw(Error)
    })
  })

  describe('ExpandedSimpleStatementBody', () => {
    it('returns its full embedded object from toJSON()', () => {
      const object = {foo: 'bar'}
      const body = new ExpandedSimpleStatementBody({object})
      expect(body.toJSON()).to.deep.eql({object, refs: [], deps: [], tags: []})
    })

    it('returns a string representation of a JSON object from inspect()', () => {
      const object = {foo: 'bar'}
      const body = new ExpandedSimpleStatementBody({object})

      expect(inspect(body))
        .to.be.eql(inspect({object, refs: [], deps: [], tags: []}))
    })
  })

  describe('CompoundStatementBody', () => {
    it('returns an array of simple bodies from inspect', () => {
      const simples = [new SimpleStatementBody({object: 'foo'}), new SimpleStatementBody({object: 'bar'})]
      const compound = new CompoundStatementBody(simples)
      expect(inspect(compound))
        .to.eql(inspect(simples))
    })

    it('expands its contained simple bodies', () => {
      const simples = [new SimpleStatementBody({object: 'foo'}), new SimpleStatementBody({object: 'bar'})]
      const objectMap = new Map()
      objectMap.set('foo', {foo: 'bar'})
      objectMap.set('bar', {bar: 'baz'})
      const compound = new CompoundStatementBody(simples)
      const expanded: CompoundStatementBody = (compound.expandObjects(objectMap): any)
      expanded.simpleBodies.forEach(b =>
        expect(b).to.be.an.instanceof(ExpandedSimpleStatementBody)
      )
    })
  })

  describe('EnvelopeStatementBody', () => {
    const stmt = Statement.fromProtobuf(fixtures.statements.envelope[0])
    const envelope: EnvelopeStatementBody = (stmt.body: any)

    it('returns an array of Statements from inspect', () => {
      expect(inspect(envelope))
        .to.be.eql(inspect(envelope.statements))
    })

    it('expands the objects in its statements', () => {
      const m = new Map()
      for (const id of envelope.objectIds) {
        m.set(id, {foo: 'bar'})
      }
      const expanded: EnvelopeStatementBody = (envelope.expandObjects(m): any)
      expanded.statements.forEach(s => {
        expect(s.body).to.be.an.instanceof(ExpandedSimpleStatementBody)
      })
    })
  })
})
