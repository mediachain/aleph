// @flow

const Multiaddr = require('multiaddr')

const DEFAULT_LISTEN_ADDR = Multiaddr('/ip4/127.0.0.1/tcp/0')
const PROTOCOLS = {
  node: {
    id: '/mediachain/node/id',
    ping: '/mediachain/node/ping',
    query: '/mediachain/node/query',
    data: '/mediachain/node/data',
    push: '/mediachain/node/push'
  },
  dir: {
    list: '/mediachain/dir/list',
    listns: '/mediachain/dir/listns',
    lookup: '/mediachain/dir/lookup',
    register: '/mediachain/dir/register'
  }
}

module.exports = {
  DEFAULT_LISTEN_ADDR,
  PROTOCOLS
}
