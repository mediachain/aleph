// @flow

const fetch: (url: string, opts?: Object) => Promise<FetchResponse> = require('node-fetch')
const ndjson = require('ndjson')
const byline = require('byline')
const serialize = require('../../metadata/serialize')

import type { Transform as TransformStream, Duplex as DuplexStream } from 'stream'
import type { StatementMsg, SimpleStatementMsg } from '../../protobuf/types'
export type NodeStatus = 'online' | 'offline' | 'public'

const DEFAULT_REQUEST_TIMEOUT = 15000

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
  constructor (response, responseBody) {
    super(response.statusText + '\n' + responseBody)
    this.statusCode = response.status
    this.response = response
  }
}

class RestClient {
  apiUrl: string;
  client: Function;
  requestTimeout: number;

  constructor (options: {apiUrl?: string, requestTimeout?: number}) {
    this.apiUrl = options.apiUrl || ''
    this.requestTimeout = (options.requestTimeout != null)
      ? options.requestTimeout
      : DEFAULT_REQUEST_TIMEOUT
  }

  _makeUrl (path: string): string {
    const absPath = path.startsWith('/') ? path : '/' + path
    return this.apiUrl + absPath
  }

  req (path: string, args: Object = {}): Promise<FetchResponse> {
    const fullUrl = this._makeUrl(path)
    args = Object.assign({timeout: this.requestTimeout}, args)
    return fetch(fullUrl, args)
      .then(response => {
        if (!response.ok) {
          return response.text().then(responseBody => {
            throw new RestError(response, responseBody)
          })
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

  id (peerId?: string): Promise<Object> {
    let path = 'id'
    if (peerId != null) {
      path += '/' + peerId
    }
    return this.getRequest(path)
      .then(r => r.json())
  }

  ping (peerId: string): Promise<boolean> {
    return this.getRequest(`ping/${peerId}`)
      .then(response => true)
  }

  publish (opts: {namespace: string, compound?: number}, ...statements: Array<SimpleStatementMsg>): Promise<Array<string>> {
    const { namespace, compound } = opts
    const statementNDJSON = statements.map(s => JSON.stringify(s)).join('\n')

    let path = `publish/${namespace}`
    if (compound != null) {
      path += '/' + compound.toString()
    }

    return this.postRequest(path, statementNDJSON, false)
      .then(parseStringArrayResponse)
  }

  statement (statementId: string): Promise<StatementMsg> {
    return this.getRequest(`stmt/${statementId}`)
      .then(r => r.json())
  }

  query (queryString: string, remotePeer?: string): Promise<Array<Object>> {
    return this.queryStream(queryString, remotePeer)
      .then(r => r.values())
  }

  queryStream (queryString: string, remotePeer?: string): Promise<NDJsonResponse> {
    let path = 'query'
    if (remotePeer != null) {
      path += '/' + remotePeer
    }
    return this.postRequest(path, queryString, false)
      .then(r => new NDJsonResponse(r))
  }

  merge (queryString: string, remotePeer: string): Promise<{statementCount: number, objectCount: number}> {
    return this.postRequest(`merge/${remotePeer}`, queryString, false)
      .then(parseMergeResponse)
  }

  push (queryString: string, remotePeer: string): Promise<{statementCount: number, objectCount: number}> {
    return this.postRequest(`push/${remotePeer}`, queryString, false)
      .then(parseMergeResponse)
  }

  delete (queryString: string): Promise<number> {
    return this.postRequest('delete', queryString, false)
      .then(parseIntResponse)
  }

  putData (...objects: Array<Object | Buffer>): Promise<Array<string>> {
    const body: string =
      objects.filter(o => o != null)
        .map(o => {
          if (o instanceof Buffer) return o
          try {
            return serialize.encode(o)
          } catch (err) {
            console.error('Serialization error: ' + err.message)
            console.error('Failed Object: ' + JSON.stringify(o, null, 2))
            throw err
          }
        })
        .filter(buf => buf.length > 0)
        .map(buf => ({data: buf.toString('base64')}))
        .map(obj => JSON.stringify(obj))
        .join('\n')

    return this.postRequest('data/put', body, false)
      .then(parseStringArrayResponse)
  }

  getData (objectId: string): Promise<Object | Buffer> {
    return this.getRequest(`data/get/${objectId}`)
      .then(r => r.json())
      .then(o => Buffer.from(o.data, 'base64'))
      .then(bytes => {
        try {
          return serialize.decode(bytes)
        } catch (err) {
          return bytes
        }
      })
  }

  getDatastoreKeys (): Promise<Array<string>> {
    return this.getRequest('data/keys')
      .then(parseStringArrayResponse)
  }

  getDatastoreKeyStream (): Promise<TransformStream> {
    return this.getRequest('data/keys')
      .then(r => byline(r.body))
  }

  garbageCollectDatastore (): Promise<number> {
    return this.postRequest('data/gc', '', false)
      .then(parseIntResponse)
  }

  compactDatastore (): Promise<boolean> {
    return this.postRequest('data/compact', '', false)
      .then(parseBoolResponse)
  }

  syncDatastore (): Promise<boolean> {
    return this.postRequest('data/sync', '', false)
      .then(parseBoolResponse)
  }

  listPeers (): Promise<Array<string>> {
    return this.getRequest('dir/list')
      .then(parseStringArrayResponse)
  }

  getAuthorizations (): Promise<Object> {
    return this.getRequest('auth')
      .then(r => r.json())
  }

  authorize (peerId: string, namespaces: Array<string>): Promise<boolean> {
    return this.postRequest(`auth/${peerId}`, namespaces.join(','), false)
      .then(parseBoolResponse)
  }

  revokeAuthorization (peerId: string): Promise<boolean> {
    return this.authorize(peerId, [])
  }

  getStatus (): Promise<NodeStatus> {
    return this.getRequest('status')
      .then(trimTextResponse)
      .then(validateStatus)
  }

  setStatus (status: NodeStatus): Promise<NodeStatus> {
    return this.postRequest(`status/${status}`, '', false)
      .then(trimTextResponse)
      .then(validateStatus)
  }

  getDirectoryId (): Promise<string> {
    return this.getRequest('config/dir')
      .then(trimTextResponse)
  }

  setDirectoryId (id: string): Promise<boolean> {
    return this.postRequest('config/dir', id, false)
      .then(() => true)
  }

  getInfo (): Promise<string> {
    return this.getRequest('config/info')
      .then(trimTextResponse)
  }

  setInfo (info: string): Promise<string> {
    return this.postRequest('config/info', info, false)
      .then(trimTextResponse)
  }

  getNATConfig (): Promise<string> {
    return this.getRequest('config/nat')
      .then(trimTextResponse)
  }

  setNATConfig (config: string): Promise<boolean> {
    return this.postRequest('config/nat', config, false)
      .then(parseBoolResponse)
  }

  getNetAddresses (peerId: ?string = null): Promise<Array<string>> {
    if (peerId != null) {
      return this.getRequest(`net/addr/${peerId}`)
        .then(parseStringArrayResponse)
    }

    return this.getRequest('net/addr')
      .then(parseStringArrayResponse)
  }

  getNetConnections (): Promise<Array<string>> {
    return this.getRequest('net/conns')
      .then(parseStringArrayResponse)
  }

  netLookup (peerId: string): Promise<Array<string>> {
    return this.getRequest(`net/lookup/${peerId}`)
      .then(parseStringArrayResponse)
  }

  shutdown (): Promise<boolean> {
    return this.postRequest('shutdown', '', false)
      .then(() => true)
      .catch(err => {
        if (err.errno === 'ECONNRESET') {
          return true // shutting down the node kills the request socket :)
        }
        throw err
      })
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

function trimTextResponse (response: FetchResponse): Promise<string> {
  return response.text()
    .then(s => s.trim())
}

function parseStringArrayResponse (response: FetchResponse): Promise<Array<string>> {
  return trimTextResponse(response)
    .then(body => body.split('\n').filter(s => s.length > 0))
}

function parseBoolResponse (response: FetchResponse): Promise<boolean> {
  return trimTextResponse(response)
    .then(s => s === 'OK')
}

function parseIntResponse (response: FetchResponse): Promise<number> {
  return trimTextResponse(response)
    .then(s => Number.parseInt(s))
}

function parseIntArrayResponse (response: FetchResponse): Promise<Array<number>> {
  return parseStringArrayResponse(response)
    .then(strings => strings.map(s => Number.parseInt(s)))
}

function parseMergeResponse (response: FetchResponse): Promise<{objectCount: number, statementCount: number}> {
  return parseIntArrayResponse(response)
    .then(counts => {
      const [statementCount, objectCount] = counts
      return {
        statementCount,
        objectCount
      }
    })
}

module.exports = RestClient
