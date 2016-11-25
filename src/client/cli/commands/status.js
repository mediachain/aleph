// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')
import type { NodeStatus } from '../../api/RestClient'

module.exports = {
  command: 'status [newStatus]',
  description: 'Get or set the status of the local node. ' +
    'If `newStatus` is not given, returns the current status. ' +
    '`newStatus` must be one of: online, offline, public\n',
  handler: subcommand((opts: {client: RestClient, newStatus?: string}) => {
    const {client, newStatus} = opts

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
        return Promise.resolve()
    }
    return client.setStatus(status)
      .then(
        returnedStatus => console.log(`status set to ${returnedStatus}`),
        err => console.error(err.message)
      )
  })
}
