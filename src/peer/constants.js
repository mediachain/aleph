// @flow

const Multiaddr = require('multiaddr')

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/0')
const PROTOCOLS = {
  node: {
    ping: '/mediachain/node/ping',
    query: '/mediachain/node/query',
    data: '/mediachain/node/data'
  },
  dir: {
    list: '/mediachain/dir/list',
    lookup: '/mediachain/dir/lookup',
    register: '/mediachain/dir/register'
  }
}

module.exports = {
  DEFAULT_LISTEN_ADDR,
  PROTOCOLS
}
