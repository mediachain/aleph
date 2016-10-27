// @flow

const assert = require('assert')
const { describe, it } = require('mocha')

const { validate } = require('../src/metadata/schema')

describe('schema validation', () => {
  const fooSchemaDescription = {
    vendor: 'io.mediachain.test',
    name: 'foo',
    version: '1-0-0',
    format: 'jsonschema'
  }

  const fooSchema = {
    self: fooSchemaDescription,

    description: 'invalid foo will be rejected!',
    type: 'object',
    properties: {
      'foo': {
        type: 'string'
      }
    },
    required: ['foo'],
    additionalProperties: false
  }

  it('validates a correctly formatted object', () => {
    const result = validate(fooSchema, {foo: 'bar'})
    assert.equal(result.success, true, 'schema should validate a correct object')
  })

  it('validates a self-describing object', () => {
    const schemaRef = {'/': 'QmF001234'}
    const result = validate(fooSchema, {schema: schemaRef, data: {foo: 'self-describing-bar'}})
    assert.equal(result.success, true, 'schema should validate a self-describing record')
  })

  it('does not validate an invalid object', () => {
    const result = validate(fooSchema, {foo: 1})
    assert.equal(result.success, false, 'schema should not validate invalid object')
  })
})
