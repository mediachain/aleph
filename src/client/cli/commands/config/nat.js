// @flow

const RestClient = require('../../../api/RestClient')

module.exports = {
  command: 'nat [natConfig]',
  description: `get or set the NAT configuration. Valid settings are 'none', 'auto', '*', '*:port', 'ip:port' \n`,
  handler: (opts: {apiUrl: string, natConfig?: string}) => {
    const {apiUrl, natConfig} = opts
    const client = new RestClient({apiUrl})
    if (natConfig) {
      client.setNATConfig(natConfig)
        .then(() => {
          console.log(`set NAT configuration to "${natConfig}"`)
        })
        .catch(err => {
          console.error('Error setting NAT configuration: ', err.message)
        })
    } else {
      return client.getNATConfig()
        .then(
          console.log,
          err => console.error(err.message)
        )
    }
  }
}
