// @flow

const cmd = require('./net/addr')
module.exports = Object.assign({}, cmd, {
  command: 'netAddr [peerId]',
  description: `${cmd.description.trim()} (alias for 'net addr')\n`
})
