// @flow

const rest = require('rest')
const errorCode = require('rest/interceptor/errorCode')

import type { StatementMsg, SimpleStatementMsg } from '../../protobuf/types'

export type NodeStatus = 'online' | 'offline' | 'public'

type RestResponse = { entity: string | Object }

class RestClient {
  peerUrl: string;
  client: Function;

  constructor (options: {peerUrl?: string}) {
    let {peerUrl} = options
    this.peerUrl = peerUrl || ''
    this.client = rest
      .wrap(errorCode)
  }

  _makeUrl (path: string): string {
    const absPath = path.startsWith('/') ? path : '/' + path
    return this.peerUrl + absPath
  }

  req (path: string, args: Object = {}): Promise<RestResponse> {
    args.path = this._makeUrl(path)
    return this.client(args)
      .catch(errorResponse => {
        const err = errorResponse.error || new Error(errorResponse.entity || 'unknown error')
        err.response = errorResponse
        throw err
      })
  }

  getRequest (path: string): Promise<RestResponse> {
    return this.req(path)
  }

  postRequest (path: string, body: Object | string, isJSON: boolean = true): Promise<RestResponse> {
    return this.req(path, {
      method: 'POST',
      headers: isJSON ? { 'Content-Type': 'application/json' } : {},
      entity: isJSON ? JSON.stringify(body) : body
    })
  }

  id (): Promise<string> {
    return this.getRequest('id')
      .then(r => r.entity)
  }

  ping (peerId: string): Promise<bool> {
    return this.getRequest(`ping/${peerId}`)
      .then(response => true)
  }

  publish (namespace: string, statement: SimpleStatementMsg): Promise<string> {
    console.log(`publishing ${JSON.stringify(statement)} to ${namespace}`)
    return this.postRequest(`publish/${namespace}`, statement)
      .then(r => r.entity)
  }

  statement (statementId: string): Promise<StatementMsg> {
    return this.getRequest(`stmt/${statementId}`)
      .then(r => r.entity)
      .then(JSON.parse)
  }

  query (queryString: string): Promise<Object> {
    return this.postRequest('query', queryString, false)
      .then(r => r.entity)
      .then(JSON.parse)
  }

  getStatus (): Promise<NodeStatus> {
    return this.getRequest('status')
      .then(r => r.entity)
      .then(validateStatus)
  }

  setStatus (status: NodeStatus): Promise<NodeStatus> {
    return this.postRequest(`status/${status}`, '', false)
      .then(r => r.entity)
      .then(validateStatus)
  }

  getDirectoryId (): Promise<string> {
    return this.getRequest('config/dir')
      .then(r => r.entity)
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
