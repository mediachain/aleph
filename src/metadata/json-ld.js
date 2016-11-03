// @flow

const fs = require('fs')
const path = require('path')
const _jsonld = require('jsonld')
const jsonld = _jsonld.promises
const jsonldRdfaParser = require('jsonld-rdfa-parser')
_jsonld.registerRDFParser('text/html', jsonldRdfaParser)

const schemaCache: Map<string, Object> = new Map()
let schemaOrgLoaded = false
function populateSchemaCache () {
  const schemaOrgPath = path.join(__dirname, 'schemas', 'org.schema-jsonld-3-1-0.jsonld')
  const schemaOrg = JSON.parse(fs.readFileSync(schemaOrgPath, {encoding: 'utf-8'}))

  for (const schema of schemaOrg['@graph']) {
    schemaCache.set(schema['@id'], schema)
  }
  schemaOrgLoaded = true
}

const htmlDocLoader = _jsonld.documentLoaders.node({
  acceptHeader: 'application/ld+json, application/json, text/html',
  usePromise: true
})

function docLoader (url: string, callback: Function) {
  console.log('loading document from ', url)

  if (!schemaOrgLoaded) {
    populateSchemaCache()
  }

  if (url.startsWith('http://schema.org')) {
    if (schemaCache.has(url)) {
      return callback(null, {
        contextUrl: null,
        document: schemaCache.get(url),
        documentUrl: url
      })
    }
  }

  return htmlDocLoader(url)
    .then(doc => {
      if (typeof doc.document === 'string') {
        try {
          return JSON.parse(doc.docment)
        } catch (err) {
        }

        return new Promise((resolve, reject) => {
          _jsonld.fromRDF(doc.document, {format: 'text/html'}, (err, rdfDoc) => {
            // console.log('rdfa parse complete: ', err, rdfDoc)
            if (err) return reject(err)

            for (const schema of rdfDoc) {
              if (schema['@id'] === url) {
                console.log('matching schema: ', schema)
                doc.document = schema
                return resolve(doc)
              }
            }

            reject(new Error(`RDFa document at ${url} did not contain a schema with the correct "@id"`))
          })
        })
      }
    }).then(doc => {
      if (doc.document != null) {
        schemaCache.set(url, doc.document)
      }
      return doc
    })
}

_jsonld.loadDocument = docLoader

module.exports = {
  jsonld
}
