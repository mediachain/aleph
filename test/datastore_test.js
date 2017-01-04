// @flow

const assert = require('assert')
const { before, describe, it } = require('mocha')
const { makeNode } = require('./util')
const { zip } = require('lodash')
const { encode } = require('../src/metadata/serialize')

const SEED_OBJECTS = [
  {'foo': 'bar'},
  {'hello': 'world'}
]

describe('Datastore', function () {
  let p1, p2

  let expectedMessages = []
  let expectedKeys = []
  before(() => makeNode().then(_p1 => { p1 = _p1 })
    .then(() => makeNode().then(_p2 => { p2 = _p2 }))
    .then(() => p1.putData(...SEED_OBJECTS))
    .then(keys => {
      expectedKeys = keys
      const kvs = zip(keys, SEED_OBJECTS.map(encode))
      expectedMessages = kvs.map(([key, data]) => ({
        key,
        data
      }))
    }))

  it(`fetches data from another node's datastore`, () => {
    return Promise.all([p1.start(), p2.start()])  // start both peers
      .then(() => p2.remoteData(p1.peerInfo, expectedKeys))
      .then(results => {
        assert.equal(results.length, expectedMessages.length)
        for (let i = 0; i < results.length; i++) {
          const res = results[i]
          const expected = expectedMessages[i]
          assert.equal(res.key, expected.key)
          assert(res.data.equals(expected.data))
        }
      })
  })

  it('returns an error for non-existent keys', () => {
    return Promise.all([p1.start(), p2.start()])
      .then(() => p2.remoteData(p1.peerInfo, ['QmNLftPEMzsadpbTsGaVP3haETYJb4GfnCgQiaFj5Red9G']))
      .catch(err => {
        assert(typeof err.message === 'string')
      })
  })
})
