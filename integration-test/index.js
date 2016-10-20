// @flow

const { describe, it } = require('mocha')
const assert = require('assert')

const RestClient = require('../src/client/api/RestClient')

describe('crazy docker integration setup', () => {
  it('can contact a node using a docker-compose service name as hostname', () => {
    const client = new RestClient({apiUrl: 'http://mcnode:9002'})
    return client.id().then(id => {
      assert(id != null, 'should be able to get node id')
    })
  })
})
