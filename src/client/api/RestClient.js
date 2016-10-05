// @flow

const fetch: (url: string, opts?: Object) => Promise<FetchResponse> = require('node-fetch')

import type { Transform as TransformStream } from 'stream'
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

  id (): Promise<string> {
    return this.getRequest('id')
      .then(r => r.text())
  }

  ping (peerId: string): Promise<boolean> {
    return this.getRequest(`ping/${peerId}`)
      .then(response => true)
  }

  publish (namespace: string, statement: SimpleStatementMsg): Promise<string> {
    console.log(`publishing ${JSON.stringify(statement)} to ${namespace}`)
    return this.postRequest(`publish/${namespace}`, statement)
      .then(r => r.text())
  }

  statement (statementId: string): Promise<StatementMsg> {
    return this.getRequest(`stmt/${statementId}`)
      .then(r => r.json())
  }

  query (queryString: string): Promise<Object> {
    return this.postRequest('query', queryString, false)
      .then(r => r.json())
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
