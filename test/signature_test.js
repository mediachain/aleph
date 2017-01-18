// @flow
// eslint-env mocha

const assert = require('assert')
const { before, describe, it } = require('mocha')
const path = require('path')

const { generatePublisherId, loadPublisherId, signBuffer, verifyBuffer } = require('../src/peer/identity')
const { makeSimpleStatement } = require('../src/metadata/statement')
const { calculateSignature, signStatement, verifyStatement } = require('../src/metadata/signatures')

describe('Signing', () => {
  let publisherId
  before(() =>
    loadPublisherId(path.join(__dirname, 'resources', 'publisher_ids', '4XTTM2UhNoDF1EfwonksnNN1zRGcZCMFutDRMtXYgciwiLzCf.id'))
      .then(_pubId => { publisherId = _pubId })
  )

  it('calculates a signature for arbitrary statement with a Ed25519 key', () => {
    const stmt = {
      id: 'foo',
      publisher: publisherId.id58,
      namespace: 'scratch.sig-test',
      timestamp: new Date("October 13, 2014 11:13:00"),
      body: {simple: {object: 'QmF00123', refs: [], deps: [], tags: []}},
      signature: Buffer.from('')
    }
    const expected = '8784a5d18f1200f8d01b602db745a329d2ed4a992c645588104dad1135edc1c99a827600852ae379e160dcdf7b1499f815a2794486267eaa19eaeee82f8ae002'
    return calculateSignature(stmt, publisherId.privateKey)
      .then(signature => assert.equal(signature.toString('hex'), expected, 'signature not as expected'))
  })
})

describe('Signature verification', () => {
  let publisherId

  before(() =>
    generatePublisherId()
      .then(_pubId => { publisherId = _pubId })
  )

  it('signs and validates a buffer', () => {
    const msg = Buffer.from(`You can get anything you want, at Alice's Restaurant`)
    return signBuffer(publisherId.privateKey, msg)
      .then(sig => verifyBuffer(publisherId.privateKey.public, msg, sig))
      .then(result => {
        assert(result === true, 'signature did not validate')
      })
  })

  it('does not validate a modified buffer', () => {
    const msg = Buffer.from(`Launch code: 0000`)
    return signBuffer(publisherId.privateKey, msg)
      .then(sig => verifyBuffer(publisherId.privateKey.public, Buffer.from('Launch code: 0001'), sig))
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
