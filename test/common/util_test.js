const {assert, expect} = require('chai')
const { before, after, describe, it } = require('mocha')
const util = require('../../src/common/util')
const stdMocks = require('std-mocks')
const { PassThrough } = require('stream')

describe('Multihash helpers', () => {
  it('isB58Multihash returns true for valid multihash', () => {
    assert(util.isB58Multihash('QmNLftPEMzsadpbTsGaVP3haETYJb4GfnCgQiaFj5Red9G') === true)
  })

  it('isB58Multihash returns false for non-multihash', () => {
    assert(util.isB58Multihash('QmF00123456789') === false)
    assert(util.isB58Multihash('foo') === false)
  })
})

describe('Stream functions', () => {
  before(() => {
    stdMocks.use()
  })

  after(() => {
    stdMocks.restore()
  })

  it('println and friends', () => {
    util.println('Hello world')
    util.printlnErr('Oh no!')
    const output = stdMocks.flush()
    assert.deepEqual(output.stdout, ['Hello world\n'])
    assert.deepEqual(output.stderr, ['Oh no!\n'])
  })

  it('consumeStream', () => {
    const stream = new PassThrough()
    util.writeln('Line 1', stream)
    util.writeln('Line 2', stream)
    stream.end()
    return util.consumeStream(stream)
      .then(contents => {
        assert.equal(contents, 'Line 1\nLine 2\n')
      })
  })

  it('consumeStream error', () => {
    const stream = new PassThrough()
    // need to call consumeStream before emitting the error, or it won't be caught
    const promise = util.consumeStream(stream)
      .catch(err => {
        assert.equal(err.message, 'Something went wrong')
      })
    util.writeln('Hello', stream)
    stream.emit('error', new Error('Something went wrong'))
    return promise
  })
})

describe('Misc utils', () => {
  it('setEquals', () => {
    const {setEquals} = util
    expect(setEquals(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'a'])))
      .to.be.true

    expect(setEquals(new Set(['a', 'b', 'c']), new Set(['a', 'b'])))
      .to.be.false

    expect(setEquals(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'z'])))
      .to.be.false
  })

  it('stringifyNestedBuffers', () => {
    const obj = {
      foo: {
        bar: Buffer.from('Hello World')
      }
    }

    const expected = {
      foo: {
        bar: Buffer.from('Hello World').toString('base64')
      }
    }

    expect(util.stringifyNestedBuffers(obj)).to.deep.eql(expected)
  })
})
