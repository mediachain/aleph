// @flow

const rest = require('rest')
const errorCode = require('rest/interceptor/errorCode')

import type { Statement, SimpleStatement } from '../../types/statement'

export type NodeStatus = 'online' | 'offline' | 'public'

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

  getRequest (path: string): Promise<Object> {
    return this.client(this._makeUrl(path))
  }

  postRequest (path: string, body: Object | string, isJSON: boolean = true): Promise<Object> {
    return this.client({
      path: this._makeUrl(path),
      method: 'POST',
      headers: isJSON ? { 'Content-Type': 'application/json' } : {},
      entity: isJSON ? JSON.stringify(body) : body
    })
  }

  id (): Promise<string> {
    return this.getRequest('id')
      .then(response => response.entity)
  }

  ping (peerId: string): Promise<bool> {
    return this.getRequest(`ping/${peerId}`)
      .then(response => true)
  }

  publish (namespace: string, statement: SimpleStatement): Promise<string> {
    console.log(`publishing ${JSON.stringify(statement)} to ${namespace}`)
    return this.postRequest(`publish/${namespace}`, statement)
      .then(response => response.entity)
  }

  statement (statementId: string): Promise<Statement> {
    return this.getRequest(`stmt/${statementId}`)
      .then(response => JSON.parse(response.entity))
  }

  getStatus (): Promise<NodeStatus> {
    return this.getRequest('/status')
      .then(response => response.entity)
  }

  setStatus (status: NodeStatus): Promise<NodeStatus> {
    return this.postRequest(`/status/${status}`, '', false)
      .then(response => response.entity)
  }

  getDirectoryId (): Promise<string> {
    return this.getRequest('/config/dir')
      .then(response => response.entity)
  }

  setDirectoryId (id: string): Promise<boolean> {
    return this.postRequest('/config/dir', id, false)
      .then(() => true)
  }
}

module.exports = RestClient
