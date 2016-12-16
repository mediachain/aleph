// @flow

const RestClient = require('../../../api/RestClient')
const { subcommand, println } = require('../../util')

module.exports = {
  command: 'nat [natConfig]',
  description: `Get or set the NAT configuration. Valid settings are 'none', 'auto', '*', '*:port', 'ip:port'. \n`,
  handler: subcommand((opts: {client: RestClient, natConfig?: string}) => {
    const {client, natConfig} = opts
    if (natConfig) {
      return client.setNATConfig(natConfig)
        .then(() => {
          println(`set NAT configuration to "${natConfig}"`)
        })
        .catch(err => {
          throw new Error(`Error setting NAT configuration: ${err.message}`)
        })
    } else {
      return client.getNATConfig()
        .then(println)
    }
  })
}
