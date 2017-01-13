// @flow
// eslint-env mocha

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { PublisherId } = require('../src/peer/identity')
const { makeSimpleStatement } = require('../src/metadata/statement')
const { signStatement, verifyStatement } = require('../src/metadata/signatures')

describe('Signature verification', () => {
  let publisherId

  before(() =>
    PublisherId.generate()
      .then(_pubId => { publisherId = _pubId })
  )

  it('signs and validates a buffer', () => {
    const msg = Buffer.from(`You can get anything you want, at Alice's Restaurant`)
    return publisherId.sign(msg)
      .then(sig => publisherId.verify(msg, sig))
      .then(result => {
        assert(result === true, 'signature did not validate')
      })
  })

  it('does not validate a modified buffer', () => {
    const msg = Buffer.from(`Launch code: 0000`)
    return publisherId.sign(msg)
      .then(sig => publisherId.verify(Buffer.from('Launch code: 0001'), sig))
      .then(result => {
        assert(result === false, 'signature validated an invalid message')
      })
  })

  it('validates a statement made with makeSimpleStatement helper', () => {
    return makeSimpleStatement(publisherId, 'scratch.sig-test', {object: 'QmF00123', refs: []})
      .then(stmt => verifyStatement(stmt))
      .then(valid => {
        assert(valid, 'statement did not validate')
      })
  })

  it('signs and validates a manually-constructed statement', () => {
    const stmtNoSig = {
      id: 'foo',
      publisher: publisherId.id58,
      namespace: 'scratch.sig-test',
      timestamp: Date.now(),
      body: {simple: {object: 'QmF00123', refs: [], deps: [], tags: []}},
      signature: Buffer.from('')
    }
    return signStatement(stmtNoSig, publisherId)
      .then(signed => verifyStatement(signed))
      .then(valid => {
        assert(valid, 'statement did not validate')
      })
  })

  it('does not validate an altered statement', () => {
    makeSimpleStatement(publisherId, 'scratch.sig-test', {object: 'QmF00123', refs: []})
      .then(stmt => {
        stmt.namespace = 'scratch.new-namespace'
        return stmt
      })
      .then(altered => verifyStatement(altered))
      .then(valid => {
        assert(!valid, 'incorrectly validated an altered statement')
      })
  })
})
