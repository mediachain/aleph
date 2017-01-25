// @flow

const assert = require('assert')
const { describe, it } = require('mocha')

const SchemaVer = require('../../src/metadata/schemaver')
const { validate, validateSelfDescribingSchema } = require('../../src/metadata/schema')

describe('schema validation', () => {
  const fooSchemaDescription = {
    vendor: 'io.mediachain.test',
    name: 'foo',
    version: '1-0-0',
    format: 'jsonschema'
  }

  const fooSchema = {
    self: fooSchemaDescription,

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

  it('validates a self-describing schema', () => {
    const result = validateSelfDescribingSchema(fooSchema)
    assert.deepEqual(result, fooSchema)

    try {
      validateSelfDescribingSchema({randomObject: 'yep'})
      assert(false, 'validation should fail for bad input')
    } catch (err) {
      assert(err instanceof Error)
    }
  })

})

describe('SchemaVer helpers', () => {
  it('parses a valid SchemaVer string', () => {
    const str = '1-0-0'
    const parsed = SchemaVer.parseSchemaVer(str)
    if (parsed == null) { // flow doesn't know assert will exit scope, so add explicit null check
      assert(false, 'SchemaVer parsing failed')
      return
    }
    assert.equal(parsed.model, 1, 'SchemaVer model parsed incorrectly')
    assert.equal(parsed.revision, 0, 'SchemaVer revision parsed incorrectly')
    assert.equal(parsed.addition, 0, 'SchemaVer addition parsed incorrectly')
  })

  it('returns a valid SchemaVer object unchanged from parse fn', () => {
    const ver = {model: 1, revision: 0, addition: 0}
    assert.deepEqual(ver, SchemaVer.parseSchemaVer(ver))
  })

  it('fails to parse invalid inputs', () => {
    assert.equal(null, SchemaVer.parseSchemaVer('1'))
    assert.equal(null, SchemaVer.parseSchemaVer('foo'))
    assert.equal(null, SchemaVer.parseSchemaVer('foo-bar-baz'))
    assert.equal(null, SchemaVer.parseSchemaVer({model: null, revision: 3, addition: 'blah'}))
    assert.equal(null, SchemaVer.parseSchemaVer({model: 1, revision: null, addition: 'blah'}))
    assert.equal(null, SchemaVer.parseSchemaVer({model: 1, revision: 3}))
  })

  it('considers schemas compatible if model and revision are equal', () => {
    assert.equal(true, SchemaVer.isCompatible('1-1-0', '1-1-3'))
    assert.equal(false, SchemaVer.isCompatible('1-1-0', '1-2-0'))
  })
})
