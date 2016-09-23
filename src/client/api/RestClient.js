// @flow

const rest = require('rest')
const errorCode = require('rest/interceptor/errorCode')

import type { Statement, SimpleStatement } from '../../types/statement'

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

  getRequest (path: string): Promise<RestResponse> {
    return this.client(this._makeUrl(path))
  }

  postRequest (path: string, body: Object | string, isJSON: boolean = true): Promise<RestResponse> {
    return this.client({
      path: this._makeUrl(path),
      method: 'POST',
      headers: isJSON ? { 'Content-Type': 'application/json' } : {},
      entity: isJSON ? JSON.stringify(body) : body
    })
  }

  id (): Promise<string> {
    return unpack(this.getRequest('id'))
  }

  ping (peerId: string): Promise<bool> {
    return unpack(this.getRequest(`ping/${peerId}`))
      .then(response => true)
  }

  publish (namespace: string, statement: SimpleStatement): Promise<string> {
    console.log(`publishing ${JSON.stringify(statement)} to ${namespace}`)
    return unpack(this.postRequest(`publish/${namespace}`, statement))
  }

  statement (statementId: string): Promise<Statement> {
    return unpack(this.getRequest(`stmt/${statementId}`), true)
  }

  getStatus (): Promise<NodeStatus> {
    return unpack(this.getRequest('/status'))
  }

  setStatus (status: NodeStatus): Promise<NodeStatus> {
    return unpack(
      this.postRequest(`/status/${status}`, '', false)
    )
  }

  getDirectoryId (): Promise<string> {
    return unpack(this.getRequest('/config/dir'))
  }

  setDirectoryId (id: string): Promise<boolean> {
    return unpack(this.postRequest('/config/dir', id, false))
      .then(() => true)
  }
}

function unpack(responsePromise: Promise<RestResponse>, isJSON: boolean = false): Promise<string | Object> {
  return responsePromise.then(
    response => isJSON ? JSON.parse(response.entity) : response.entity,
    errorResponse => {
      const err = errorResponse.error || new Error(errorResponse.entity || 'unknown error')
      err.response = errorResponse
      return Promise.reject(err)
    }
  )
}

module.exports = RestClient
