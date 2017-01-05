// @flow
// eslint-env mocha

const assert = require('assert')
const { before, describe, it } = require('mocha')

const { generatePublisherId, signBuffer, verifyBuffer } = require('../src/peer/identity')

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
})
