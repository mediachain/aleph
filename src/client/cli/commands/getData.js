// @flow

const cmd = require('./data/get')

module.exports = Object.assign({}, cmd, {
  command: 'getData <objectIds..>',
  description: `${cmd.description.trim()} (alias for 'data get')\n`
})
