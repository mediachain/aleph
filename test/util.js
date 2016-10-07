// @flow

const PeerId = require('peer-id')

function loadTestNodeIds (): Array<PeerId> {
  const ids = require('./resources/test_node_ids.json')
  return ids.map(PeerId.createFromJSON)
}

module.exports = {
  loadTestNodeIds
}
