// @flow
// eslint-env mocha

const assert = require('assert')
const { before, describe, it } = require('mocha')
const ethereumUtils = require('ethereumjs-util')
const { EthereumPublisherId, PublicSigningKey } = require('../src/peer/identity')

const ETH_MESSAGE_FIXTURES = require('./resources/fixtures/ethereum-message-signature')

import type { EthSignRPCFunction } from '../src/peer/identity'

function genMockEthSign (privateKey: Buffer): EthSignRPCFunction {
  return (_account, message, callback) => {
    let rpcSig
    try {
      const msgBuffer = ethereumUtils.toBuffer(message)
      const {r, s, v} = ethereumUtils.ethSign(msgBuffer, privateKey)
      rpcSig = ethereumUtils.toRpcSig(v, r, s)
    } catch (err) {
      setImmediate(() => callback(err))
    }
    setImmediate(() => callback(null, rpcSig))
  }
}

describe('Ethereum interop', () => {
  const privateKey = Buffer.from('0e1df63c33fafd7fc523e1c94d1bf15cfb50e028acdd2df97dc671ba22b03842', 'hex')
  const address = '0xbf5e3d0aef5b3f1f2103d8322a8b49b52b11436b'
  const testMessage = Buffer.from('Hello world')
  const testSig = Buffer.from('0101341512822ae0d33bf2bf0c6cf27953ea0ab335938b9db65be82f1d1aa2f14771d2ba34c20e9e72529bac68661429eaf0c24210b480e488bc789c23913a3201', 'hex')
  const ethSign = genMockEthSign(privateKey)
  let publisherId

  before(() =>
    EthereumPublisherId.fromRPCMethod(address, ethSign)
      .then(_publisherId => { publisherId = _publisherId })
  )

  it('validates a message signed by a geth ethereum node', () => {
    const pubKey = PublicSigningKey.fromBytes(ETH_MESSAGE_FIXTURES.ethPubKey)
    return pubKey.verify(ETH_MESSAGE_FIXTURES.message, ETH_MESSAGE_FIXTURES.signature)
      .then(valid => {
        assert(valid, 'signature verification failed')
      })
  })

  it('recovers a PublicSigningKey from a signed ethereum message and account address', () => {
    const {message, signature, ethAccount, ethPubKey} = ETH_MESSAGE_FIXTURES
    const pubKey = PublicSigningKey.fromSignedEthereumMessage(message, signature, ethAccount)
    const keyFromHex = PublicSigningKey.fromBytes(ethPubKey)
    assert.deepEqual(pubKey.bytes, keyFromHex.bytes, 'public key recovery failed')
  })

  it('generates an EthereumPublisherId from an ethereum address + RPC eth_sign function', () => {
    assert(publisherId != null, 'publisher id generation failed')
    return publisherId.sign(testMessage)
      .then(sig => {
        assert.deepEqual(sig, testSig, 'signature from EthereumPublisherId did not match fixture')
      })
      .then(() => publisherId.verify(testMessage, testSig))
      .then(valid => {
        assert(valid, 'signature validation failed')
      })
  })

  it('fails to generate an EthereumPublisherId if eth address does not match signature', () => {
    const wrongAddress = '0xbf5e3d0aef5b3f1f2103d8322a8b49b52b114360'
    return EthereumPublisherId.fromRPCMethod(wrongAddress, ethSign)
      .catch(err => {
        assert(err instanceof Error, 'should throw if address is incorrect')
      })
  })
})
