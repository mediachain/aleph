// @flow

const cmd = require('./data/get')

module.exports = Object.assign({}, cmd, {
  command: 'getData <objectId>',
  description: `${cmd.description.trim()} (alias for 'data get')\n`
})
