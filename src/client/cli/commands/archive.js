// @flow

const fs = require('fs')
const zlib = require('zlib')
const tar = require('tar-stream')
const {subcommand, printlnErr} = require('../util')
const {Statement} = require('../../../model/statement')
import type {RestClient} from '../../api'

const STMT_BATCH_SIZE = 1024
const OBJECT_BATCH_SIZE = 1024
const TAR_ENTRY_OPTS = {
  uid: 500,
  gid: 500,
  uname: 'mediachain',
  gname: 'staff'
}

function leftpad (str, length, char = '0') {
  return char.repeat(Math.max(0, length - str.length)) + str
}

module.exports = {
  command: 'archive <queryString>',
  description: 'Create a gzipped tar archive of the statements and data objects returned for the given `queryString`\n',
  builder: {
    output: {
      alias: 'o',
      type: 'string',
      description: 'Filename to output archive tarball to.  If not given archive will be written to stdout.\n',
      required: false,
      default: null
    },
    allowErrors: {
      alias: ['warn', 'w'],
      description: 'Warn if an error occurs when fetching data instead of aborting the archive generation.\n',
      type: 'boolean',
      default: false
    }
  },
  handler: subcommand((opts: {client: RestClient, queryString: string, output?: ?string, allowErrors: boolean}) => {
    const {client, queryString, allowErrors, output} = opts
    let outputStream
    const tarball = tar.pack()
    const gzip = zlib.createGzip()
    const objectIds: Set<string> = new Set()

    return client.queryStream(queryString)
      .then(response => new Promise((resolve, reject) => {
        const queryStream = response.stream()
        const outStreamName = output || 'standard output'
        outputStream = (output == null) ? process.stdout : fs.createWriteStream(output)
        tarball.pipe(gzip).pipe(outputStream)

        let stmtBatch: Array<string> = []
        let stmtBatchNumber = 0
        function writeStatementBatch (force: boolean = false) {
          if (force || stmtBatch.length >= STMT_BATCH_SIZE) {
            const content = Buffer.from(stmtBatch.join('\n'), 'utf-8')
            const filename = `stmt/${leftpad(stmtBatchNumber.toString(), 8)}.ndjson`
            writeToTarball(tarball, filename, content)
            stmtBatchNumber += 1
            stmtBatch = []
          }
        }

        outputStream.on('error', err => {
          reject(new Error(`Error writing to ${outStreamName}: ${err.message}`))
        })

        queryStream.on('error', err => {
          reject(new Error(`Error reading from query result stream: ${err.message}`))
        })

        queryStream.on('data', obj => {
          let stmt
          try {
            stmt = Statement.fromProtobuf(obj)
          } catch (err) {
            // ignore non-statement results
            return
          }

          stmtBatch.push(JSON.stringify(obj))
          writeStatementBatch()

          for (const id of stmt.objectIds) {
            objectIds.add(id)
          }
          for (const id of stmt.depsSet) {
            objectIds.add(id)
          }
        })

        queryStream.on('end', () => {
          writeStatementBatch(true)
          resolve()
        })
      }))
      .then(() => writeDataObjectsToTarball(client, tarball, objectIds, allowErrors))
      .then(() => new Promise(resolve => {
        outputStream.on('end', () => resolve())
        tarball.finalize()
      }))
      .catch(err => {
        // if we're not allowing errors, and are writing to a file, try to delete it on failure
        if (!allowErrors && output != null) {
          try {
            fs.unlinkSync(output)
          } catch (err) {
            // ignore deletion failures
          }
        }
        throw err
      })
  })
}

function writeToTarball (tarball: Object, filename: string, content: Buffer) {
  const header = Object.assign({}, {name: filename, size: content.length}, TAR_ENTRY_OPTS)
  tarball.entry(header, content)
}

function writeDataObjectsToTarball (client: RestClient, tarball: Object, objectIds: Set<string>, allowErrors: boolean): Promise<*> {
  if (objectIds.size < 1) return Promise.resolve()

  const batchPromises = []
  let batch = []
  for (const id of objectIds) {
    batch.push(id)
    if (batch.length >= OBJECT_BATCH_SIZE) {
      const ids = batch
      batch = []
      batchPromises.push(fetchObjectBatch(client, tarball, ids, allowErrors))
    }
  }

  batchPromises.push(fetchObjectBatch(client, tarball, batch, allowErrors))
  return Promise.all(batchPromises)
}

function fetchObjectBatch (client: RestClient, tarball: Object, objectIds: Array<string>, allowErrors: boolean): Promise<*> {
  if (objectIds.length < 1) return Promise.resolve()

  return client.batchGetDataStream(objectIds, false)
    .then(stream => new Promise((resolve, reject) => {
      stream.on('data', dataResult => {
        const key = objectIds.shift()
        if (dataResult == null || typeof dataResult !== 'object' || dataResult.data == null) {
          const msg = (dataResult && dataResult.error) ? dataResult.error : 'Unknown error'
          if (allowErrors) {
            printlnErr(`Error fetching object for ${key}: ${msg}`)
            return
          } else {
            return reject(new Error(`Error fetching object for ${key}: ${msg}`))
          }
        }

        const bytes = Buffer.from(dataResult.data, 'base64')
        writeToTarball(tarball, `data/${key}`, bytes)
      })

      stream.on('error', err => {
        reject(new Error(`Error reading from data object stream: ${err.message}`))
      })

      stream.on('end', () => resolve())
    }))
}
