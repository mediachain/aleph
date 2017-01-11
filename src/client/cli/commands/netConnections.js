// @flow

const cmd = require('./net/connections')
module.exports = Object.assign({}, cmd, {
  command: 'netConnections',
  description: `${cmd.description.trim()} (alias for 'net connections')\n`
})
