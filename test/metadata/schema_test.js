const { assert, expect } = require('chai')
const { describe, it } = require('mocha')
const { cloneDeep } = require('lodash')
const temp = require('temp').track()
const fs = require('fs')
const SchemaVer = require('../../src/metadata/schemaver')
const {
  validate,
  validateSelfDescribingSchema,
  isSchemaDescription,
  isSelfDescribingRecord,
  schemaDescriptionIsEqual,
  schemaDescriptionIsCompatible,
  schemaDescriptionToWKI,
  loadSelfDescribingSchema
} = require('../../src/metadata/schema')

describe('Schema validation', () => {
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
    assert.equal(false, validate(fooSchema, {foo: 1}).success, 'schema should not validate invalid object')

    const invalidDescription = {
      vendor: 'io.mediachain.test',
      name: 'foo',
      version: '1-0-0',
      format: 'not-valid'
    }
    assert.equal(false, validate({self: invalidDescription, type: 'string'}, 'hello world').success)
  })

  it('isSchemaDescription works', () => {
    assert.equal(true, isSchemaDescription(fooSchemaDescription))
    assert.equal(false, isSchemaDescription('foo'))
    assert.equal(false, isSchemaDescription({vendor: 'foo', name: 'bar', format: 'jsonschema', version: 42}))
    assert.equal(false, isSchemaDescription({vendor: 'foo', name: 'bar', format: 'jsonschema', version: '1.2.3-not-a-SchemaVer'}))
  })

  it('isSelfDescribingRecord works', () => {
    assert.equal(true,
      isSelfDescribingRecord({schema: {'/': 'QmF001234'}, data: {foo: 'bar'}})
    )

    assert.equal(false,
      isSelfDescribingRecord('foo')
    )

    assert.equal(false,
      isSelfDescribingRecord({schema: fooSchema}),
      'self-describing record requires "data" object field'
    )
  })

  it('validateSelfDescribingSchema works', () => {
    const result = validateSelfDescribingSchema(fooSchema)
    assert.deepEqual(result, fooSchema)

    expect(() => {
      validateSelfDescribingSchema('foobar')
    }).to.throw(Error)

    expect(() => {
      validateSelfDescribingSchema({foo: 'bar'})
    }).to.throw(Error)

    expect(() => {
      validateSelfDescribingSchema({
        self: fooSchemaDescription,
        type: 42
      })
    }).to.throw(Error)
  })

  it('schemaDescriptionIsEqual works', () => {
    assert.equal(true, schemaDescriptionIsEqual(fooSchemaDescription, fooSchemaDescription))
    const barSchemaDescription = cloneDeep(fooSchemaDescription)
    barSchemaDescription.name = 'bar'
    assert.equal(false, schemaDescriptionIsEqual(fooSchemaDescription, barSchemaDescription))
  })

  it('schemaDescriptionIsCompatible works', () => {
    const bumpedAddition = cloneDeep(fooSchemaDescription)
    const bumpedRevision = cloneDeep(fooSchemaDescription)
    const bumpedModel = cloneDeep(fooSchemaDescription)
    bumpedAddition.version = '1-0-1'
    bumpedRevision.version = '1-1-0'
    bumpedModel.version = '2-0-0'
    assert.equal(true, schemaDescriptionIsCompatible(fooSchemaDescription, bumpedAddition))
    assert.equal(false, schemaDescriptionIsCompatible(fooSchemaDescription, bumpedRevision))
    assert.equal(false, schemaDescriptionIsCompatible(fooSchemaDescription, bumpedModel))
  })

  it('schemaDescriptionToWKI works', () => {
    const wki = schemaDescriptionToWKI(fooSchemaDescription)
    assert.equal(wki, 'schema:io.mediachain.test/foo/jsonschema/1-0-0')
  })

  it('loadSelfDescribingSchema loads a valid schema file', (done) => {
    temp.open('schema-test', (err, info) => {
      if (err) return done(err)
      fs.write(info.fd, JSON.stringify(fooSchema))
      fs.close(info.fd, (err) => {
        if (err) return done(err)
        const schema = loadSelfDescribingSchema(info.path)
        assert.deepEqual(schema, fooSchema)
        done()
      })
    })
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
    assert.equal(null, SchemaVer.parseSchemaVer(null))
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
    assert.equal(false, SchemaVer.isCompatible(null, '1-2-3'))
  })
})
