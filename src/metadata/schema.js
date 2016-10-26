// @flow

const Ajv = require('ajv')
const ajv = new Ajv()
const SchemaVer = require('./schemaver')

const SCHEMA_WKI_PREFIX = 'schema:'

// a "self-describing" record contains a `data` payload, and a reference to a schema
export type SelfDescribingRecord = {
  schema: SchemaReference,
  data: Object
}

// human-readable identifiers for a schema, including semantic version
// this will be contained in the schema itself (under the `self` field)
export type SchemaDescription = {
  vendor: string,
  name: string,
  version: string,
  format: string,
}

// A SchemaReference is an IPLD-style link object, whose string value is the b58-encoded multihash of a schema
export type SchemaReference = {'/': string}

export type JsonSchema = {

}

/**
 * The fields we require a self-describing schema to have.
 */
export type SelfDescribingSchema = {
  self: SchemaDescription,
  description: string,
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

  if (SchemaVer.parseSchemaVer(obj.version) == null) {
    return false
  }
  return true
}

function isSchemaReference (obj: Object): boolean {
  return isObject(obj) && typeof obj['/'] === 'string'
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

function schemaDescriptionToWKI (desc: SchemaDescription): string {
  const { vendor, name, format, version } = desc
  return SCHEMA_WKI_PREFIX + [vendor, name, format, version].join('/')
}

function validate (schema: SelfDescribingSchema, payload: Object): boolean {
  let data = payload
  if (isSelfDescribingRecord(payload)) {
    data = (payload.data: Object)
  }

  if (schema.self.format !== 'jsonschema') {
    throw new Error('schema validation is only supported where schema format === "jsonschema"')
  }

  return ajv.validate(schema, data)
}

/**
 * Validate that the given `schemaObject` is in fact a valid json-schema, with a SchemaDescription.
 * @param schemaObject - a self-describing json schema object
 * @returns the original object, with a flow typecast for fuzzy good feelings
 * @throws if schemaObject is not a valid json-schema, or if it lacks required self-description properties
 */
function validateSelfDescribingSchema (schemaObject: Object): SelfDescribingSchema {
  if (!isObject(schemaObject)) {
    throw new Error('Self-describing schema must be an object, but you gave me ' + typeof schemaObject)
  }

  if (schemaObject.self == null || !isSchemaDescription(schemaObject.self)) {
    throw new Error('Self-describing schema must have a "self" field with "vendor", "name", "version" and "format"')
  }

  if (schemaObject.description == null || typeof schemaObject.description !== 'string') {
    throw new Error('Self-describing schema must have a "description" string field')
  }

  if (!ajv.validateSchema(schemaObject)) {
    throw new Error(`Self-describing schema object is not a valid json-schema: ${ajv.errorsText()}`)
  }

  return (schemaObject: SelfDescribingSchema) // promote the flow type, now that we know it's valid
}

module.exports = {
  validate,
  validateSelfDescribingSchema,
  schemaDescriptionToWKI,
  isSelfDescribingRecord,
  isSchemaDescription,
  isSchemaReference,
  schemaDescriptionIsSameSchema,
  schemaDescriptionIsEqual,
  schemaDescriptionIsCompatible
}
