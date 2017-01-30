// @flow

// tools for parsing and comparing SchemaVer semantic versions for data schemas
// see https://github.com/snowplow/iglu/wiki/SchemaVer
// and http://snowplowanalytics.com/blog/2014/05/13/introducing-schemaver-for-semantic-versioning-of-schemas/

export type SchemaVer = {
  model: number,
  revision: number,
  addition: number
}

function isSchemaVer (obj: mixed): boolean {
  if (obj == null || typeof (obj) !== 'object') return false
  if (obj.model == null || typeof (obj.model) !== 'number') return false
  if (obj.revision == null || typeof (obj.revision) !== 'number') return false
  if (obj.addition == null || typeof (obj.addition) !== 'number') return false
  return true
}

function parseSchemaVer (version: string | Object): ?SchemaVer {
  if (typeof (version) === 'string') {
    const components = version.split('-')
      .map(s => Number(s))
      .filter(n => !isNaN(n))

    if (components.length !== 3) return null
    const [model, revision, addition] = components
    return {model, revision, addition}
  }

  if (isSchemaVer(version)) return version

  return null
}

function isCompatible (a: SchemaVer | string, b: SchemaVer | string): boolean {
  const parsedA = parseSchemaVer(a)
  const parsedB = parseSchemaVer(b)
  if (parsedA == null || parsedB == null) return false

  return parsedA.model === parsedB.model &&
    parsedA.revision === parsedB.revision
}

module.exports = {
  parseSchemaVer,
  isCompatible
}
