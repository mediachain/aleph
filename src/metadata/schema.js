// @flow

const Ajv = require('ajv')
const ajv = new Ajv()
const SchemaVer = require('./schemaver')

// a "self-describing" record contains a `data` payload, and a reference to a schema
export type SelfDescribingRecord = {
  schema: SchemaReference,
  data: Object
}

// human-readable identifiers for a schema, including semantic version
// this will be contained in the schema itself (under the `self` field),
// as well as in references to the schema in each self-describing data record
export type SchemaDescription = {
  vendor: string,
  name: string,
  version: string,
  format: string,
}

export type SchemaReference = SchemaDescription & {
  links: {
    // records require a link to a mediachain object containing the schema
    mediachain: string,

    // optional links via http, iglu (snowplow's schema repo), and ipfs
    http?: string,
    iglu?: string,
    ipfs?: {'/': string},
  }
}

export type SelfDescribingSchema = {
  self: SchemaDescription,
  description: string,
  type: 'object',
  properties: Object
}

function isObject (o: ?mixed): boolean {
  return (o != null && typeof (o) === 'object')
}

function isSchemaDescription (obj: Object): boolean {
  if (!isObject(obj)) return false
  if (typeof (obj.vendor) !== 'string' ||
    typeof (obj.name) !== 'string' ||
    typeof (obj.version) !== 'string' ||
    typeof (obj.format) !== 'string') {
    return false
  }
  return true
}

function isSchemaReference (obj: Object): boolean {
  return isSchemaDescription(obj) && isObject(obj.links)
}

function isSelfDescribingRecord (obj: Object): boolean {
  if (!isObject(obj)) return false
  if (!isObject(obj.schema)) return false
  if (!isObject(obj.data)) return false

  return isSchemaReference(obj.schema)
}

function schemaDescriptionIsSameSchema (a: SchemaDescription, b: SchemaDescription): boolean {
  return a.name === b.name && a.vendor === b.vendor && a.format === b.format
}

function schemaDescriptionIsEqual (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    a.version === b.version
}

function schemaDescriptionIsCompatible (a: SchemaDescription, b: SchemaDescription): boolean {
  return schemaDescriptionIsSameSchema(a, b) &&
    SchemaVer.isCompatible(a.version, b.version)
}

function validate (schema: SelfDescribingSchema, payload: Object): boolean {
  let data = payload
  if (isSelfDescribingRecord(payload)) {
    data = (payload.data: Object)

    if (!schemaDescriptionIsCompatible(schema.self, payload.schema)) {
      console.warn('schema description in payload does not match given schema')
      return false
    }
  }

  if (schema.self.format !== 'jsonschema') {
    throw new Error('schema validation is only supported where schema format === "jsonschema"')
  }

  return ajv.validate(schema, data)
}

module.exports = {
  validate,
  isSelfDescribingRecord,
  isSchemaDescription,
  isSchemaReference,
  schemaDescriptionIsSameSchema,
  schemaDescriptionIsEqual,
  schemaDescriptionIsCompatible
}
