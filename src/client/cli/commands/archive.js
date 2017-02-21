// @flow

const fs = require('fs')
const zlib = require('zlib')
const tar = require('tar-stream')
const {subcommand} = require('../util')
const {Statement} = require('../../../model/statement')
import type {RestClient} from '../../api'

const OBJECT_BATCH_SIZE = 1024
const TAR_ENTRY_OPTS = {
  uid: 500,
  gid: 500,
  uname: 'mediachain',
  gname: 'staff'
}

module.exports = {
  command: 'archive <queryString>',
  description: 'Create a gzipped tar archive of the statements and data objects returned for the given `queryString`',
  builder: {
    output: {
      alias: 'o',
      type: 'string',
      description: 'Filename to output archive tarball to.  If not given archive will be written to stdout.',
      required: false,
      default: null
    }
  },
  handler: subcommand((opts: {client: RestClient, queryString: string, output?: ?string}) => {
    const {client, queryString} = opts
    let dataFetchPromises = []
    let outputStream
    let tarball

    return client.queryStream(queryString)
      .then(response => new Promise((resolve, reject) => {
        const {output} = opts
        const queryStream = response.stream()
        const outStreamName = output || 'standard output'
        outputStream = (output == null) ? process.stdout : fs.createWriteStream(output)

        tarball = tar.pack()
        const gzip = zlib.createGzip()
        tarball.pipe(gzip).pipe(outputStream)

        let objectIds = []
        function fetchBatch (force: boolean = false) {
          if (force || objectIds.length >= OBJECT_BATCH_SIZE) {
            const ids = objectIds
            objectIds = []
            dataFetchPromises.push(writeDataObjectsToTarball(client, tarball, ids))
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

          const name = `stmt/${stmt.id}`
          const content = Buffer.from(JSON.stringify(obj), 'utf-8')
          writeToTarball(tarball, name, content)

          for (const id of stmt.objectIds) {
            objectIds.push(id)
          }
          fetchBatch()
        })

        queryStream.on('end', () => {
          fetchBatch(true)
          resolve()
        })
      }))
      .then(() => Promise.all(dataFetchPromises))
      .then(() => new Promise(resolve => {
        outputStream.on('end', () => resolve())
        tarball.finalize()
      }))
  })
}

function writeToTarball (tarball: Object, filename: string, content: Buffer) {
  const header = Object.assign({}, {name: filename, size: content.length}, TAR_ENTRY_OPTS)
  tarball.entry(header, content)
}

function writeDataObjectsToTarball (client: RestClient, tarball: Object, objectIds: Array<string>): Promise<*> {
  if (objectIds.length < 1) return Promise.resolve()

  return client.batchGetDataStream(objectIds, false)
    .then(stream => new Promise((resolve, reject) => {
      stream.on('data', dataResult => {
        const key = objectIds.shift()
        if (dataResult == null || typeof dataResult !== 'object' || dataResult.data == null) return

        const bytes = Buffer.from(dataResult.data, 'base64')
        writeToTarball(tarball, `data/${key}`, bytes)
      })

      stream.on('error', err => {
        reject(new Error(`Error reading from data object stream: ${err.message}`))
      })

      stream.on('end', () => resolve())
    }))
}
