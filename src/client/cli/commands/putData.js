// @flow

const cmd = require('./data/put')

module.exports = Object.assign({}, cmd, {
  command: 'putData [filename]',
  description: `${cmd.description.trim()} (alias for 'data put')\n`
})
