// @flow

const RestClient = require('../../api/RestClient')
const { subcommand } = require('../util')

module.exports = {
  command: 'listNamespaces',
  description: `Fetch a list of namespaces published by all known peers.\n`,
  handler: subcommand((opts: {client: RestClient}) => {
    const {client} = opts
    return client.listNamespaces().then(
      namespaces => {
        namespaces.sort().forEach(ns => console.log(ns))
      }
    )
  })
}
