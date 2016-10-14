// @flow

const RestClient = require('../../api/RestClient')
import type { NodeStatus } from '../../api/RestClient'

module.exports = {
  command: 'status [newStatus]',
  description: 'get or set the status of the node. ' +
    'if newStatus is not given, returns the current status. ' +
    'newStatus must be one of: online, offline, public\n',
  handler: (opts: {peerUrl: string, newStatus?: string}) => {
    const {peerUrl, newStatus} = opts
    const client = new RestClient({peerUrl})

    if (!newStatus) {
      return client.getStatus().then(console.log)
    }

    let status: NodeStatus
    switch (newStatus) {
      case 'online':
      case 'offline':
      case 'public':
        status = newStatus
        break
      default:
        console.error(`Cannot set status to ${newStatus}. Must be one of: online, offline, public`)
        return
    }
    client.setStatus(status)
      .then(
        returnedStatus => console.log(`status set to ${returnedStatus}`),
        err => console.error(err.message)
      )
  }
}
