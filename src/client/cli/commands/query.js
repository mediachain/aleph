// @flow

const RestClient = require('../../api/RestClient')
const { prettyPrint } = require('../util')
const objectPath = require('object-path')
import type { Readable as ReadableStream } from 'stream'

module.exports = {
  command: 'query <queryString>',
  builder: {
    remotePeer: {
      description: 'the id of a remote peer to route the query to',
      alias: 'r'
    },
    fetchData: {
      alias: 'd',
      description: 'also fetch the metadata associated with each statement',
      type: 'boolean',
      default: false
    }
  },
  description: 'send a mediachain query to the node for evaluation.\n',
  handler: (opts: {apiUrl: string, queryString: string, remotePeer?: string, fetchData: boolean}) => {
    const {apiUrl, queryString, remotePeer, fetchData} = opts

    const client = new RestClient({apiUrl})
    client.queryStream(queryString, remotePeer)
      .then(response => {
        if (fetchData) {
          fetchDataForResultStream(client, response.stream())
        } else {
          response.stream().on('data', prettyPrint)
        }
      })
      .catch(err => console.error(err.message))
  }
}

function fetchDataForResultStream (client: RestClient, resultStream: ReadableStream) {
  let promises = []
  resultStream.on('data', stmt => {
    const objectRef = objectPath.get(stmt, 'body.Body.Simple.object')
    let p: Promise<Object>
    if (objectRef == null) {
      // If we can't get an object reference, just print the statement envelope
      p = Promise.resolve(stmt)
    } else {
      p = client.getData(objectRef)
        .then(data => {
          if (data instanceof Buffer) {
            data = data.toString('base64')
          }

          // replace the reference with the returned data
          objectPath.set(stmt, 'body.Body.Simple.object', data)
          return stmt
        })
        .catch(err => {
          objectPath.set(stmt, 'body.Body.Simple.object', `Error fetching object ${objectRef}: ${err.message}`)
        })
    }
    promises.push(p)
  })

  resultStream.on('error', err => console.error(`Error reading query results: ${err.message}`))
  resultStream.on('end', () => {
    Promise.all(promises)
      .then(statements => {
        for (const stmt of statements) {
          prettyPrint(stmt)
        }
      })
  })
}
