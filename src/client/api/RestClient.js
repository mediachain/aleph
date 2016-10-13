// @flow

const fetch: (url: string, opts?: Object) => Promise<FetchResponse> = require('node-fetch')
const ndjson = require('ndjson')
const ipld = require('ipld')

import type { Transform as TransformStream, Duplex as DuplexStream } from 'stream'
import type { StatementMsg, SimpleStatementMsg } from '../../protobuf/types'
export type NodeStatus = 'online' | 'offline' | 'public'

type FetchResponse = {
  text: () => Promise<string>,
  json: () => Promise<Object>,
  buffer: () => Promise<Buffer>,
  body: TransformStream,
  statusText: string,
  status: number,
  ok: boolean
}

class NDJsonResponse {
  fetchResponse: FetchResponse
  constructor (fetchResponse: FetchResponse) {
    this.fetchResponse = fetchResponse
  }

  stream (): DuplexStream {
    return this.fetchResponse.body.pipe(ndjson.parse())
  }

  values (): Promise<Array<Object>> {
    return new Promise((resolve, reject) => {
      const vals = []
      const stream = this.stream()
      stream.on('data', val => { vals.push(val) })
      stream.on('error', reject)
      stream.on('finish', () => { resolve(vals) })
    })
  }
}

class RestError extends Error {
  response: FetchResponse
  statusCode: number
  constructor (response) {
    super(response.statusText)
    this.statusCode = response.status
    this.response = response
  }
}

class RestClient {
  peerUrl: string;
  client: Function;

  constructor (options: {peerUrl?: string}) {
    this.peerUrl = options.peerUrl || ''
  }

  _makeUrl (path: string): string {
    const absPath = path.startsWith('/') ? path : '/' + path
    return this.peerUrl + absPath
  }

  req (path: string, args: Object = {}): Promise<FetchResponse> {
    const fullUrl = this._makeUrl(path)
    return fetch(fullUrl, args)
      .then(response => {
        if (!response.ok) {
          throw new RestError(response)
        }
        return response
      })
  }

  getRequest (path: string): Promise<FetchResponse> {
    return this.req(path)
  }

  postRequest (path: string, body: Object | string, isJSON: boolean = true): Promise<FetchResponse> {
    return this.req(path, {
      method: 'POST',
      headers: isJSON ? { 'Content-Type': 'application/json' } : {},
      body: isJSON ? JSON.stringify(body) : body
    })
  }

  id (): Promise<Object> {
    return this.getRequest('id')
      .then(r => r.json())
  }

  ping (peerId: string): Promise<boolean> {
    return this.getRequest(`ping/${peerId}`)
      .then(response => true)
  }

  publish (namespace: string, ...statements: Array<SimpleStatementMsg>): Promise<string> {
    const statementNDJSON = statements.map(s => JSON.stringify(s)).join('\n')
    return this.postRequest(`publish/${namespace}`, statementNDJSON, false)
      .then(r => r.text())
  }

  statement (statementId: string): Promise<StatementMsg> {
    return this.getRequest(`stmt/${statementId}`)
      .then(r => r.json())
  }

  query (queryString: string): Promise<Array<Object>> {
    return this.queryStream(queryString)
      .then(r => r.values())
  }

  queryStream (queryString: string): Promise<NDJsonResponse> {
    return this.postRequest('query', queryString, false)
      .then(r => new NDJsonResponse(r))
  }

  delete (queryString: string): Promise<number> {
    return this.postRequest('delete', queryString, false)
      .then(r => r.text())
      .then(Number.parseInt)
  }

  putData (...objects: Array<Object | Buffer>): Promise<Array<string>> {
    const body: string =
      objects.map(o => {
        if (o instanceof Buffer) return o
        return ipld.marshal(o)
      }).map(buf => ({data: buf.toString('base64')}))
        .map(obj => JSON.stringify(obj))
        .join('\n')

    return this.postRequest('data/put', body, false)
      .then(r => r.text())
      .then(response => response
        .split('\n')
        .filter(str => str.length > 0)
      )
  }

  getData (objectId: string): Promise<Object | Buffer> {
    return this.getRequest(`data/get/${objectId}`)
      .then(r => r.json())
      .then(o => Buffer.from(o.data, 'base64'))
      .then(bytes => {
        try {
          return ipld.unmarshal(bytes)
        } catch (err) {
          return bytes
        }
      })
  }

  getStatus (): Promise<NodeStatus> {
    return this.getRequest('status')
      .then(r => r.text())
      .then(validateStatus)
  }

  setStatus (status: NodeStatus): Promise<NodeStatus> {
    return this.postRequest(`status/${status}`, '', false)
      .then(r => r.text())
      .then(validateStatus)
  }

  getDirectoryId (): Promise<string> {
    return this.getRequest('config/dir')
      .then(r => r.text())
  }

  setDirectoryId (id: string): Promise<boolean> {
    return this.postRequest('config/dir', id, false)
      .then(() => true)
  }
}

function validateStatus (status: string): NodeStatus {
  status = status.trim()
  switch (status) {
    case 'online':
    case 'offline':
    case 'public':
      return status
  }
  throw new Error(`Unknown status: "${status}"`)
}

module.exports = RestClient
