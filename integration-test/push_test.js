// @flow
/* eslint-env mocha */

const assert = require('assert')
const { describe, it, before } = require('mocha')

const { loadTestNodeIds } = require('../test/util')
const { MediachainNode: AlephNode } = require('../src/peer/node')
const { concatNodeClient, concatNodePeerInfo } = require('./util')
const { generatePublisherId } = require('../src/peer/identity')
const { signStatement } = require('../src/metadata/signatures')

import type { PublisherId } from '../src/peer/identity'

const seedObjects = [
  {id: 'foo:1', foo: 'bar'},
  {id: 'foo:2', foo: 'baz'}
]

// TODO: write "publish" method for aleph nodes, use instead of this hack
function seedStatementsToAleph (publisherId: PublisherId, alephNode: AlephNode): Promise<*> {
  return alephNode.putData(...seedObjects)
    .then(keys => Promise.all(keys.map((key, idx) => {
      const alephId = alephNode.peerInfo.id.toB58String()
      const timestamp = Date.now()
      const statementId = `${alephId}:${timestamp}:${idx}`
      const stmt = {
        id: statementId,
        publisher: publisherId.id58,
        namespace: 'scratch.test',
        body: {
          simple: {
            object: key,
            refs: [`foo:${idx}`],
            deps: [],
            tags: []
          }
        },
        timestamp,
        signature: Buffer.from('')
      }
      return signStatement(stmt, publisherId)
        .then(signed => alephNode.db.put(signed))
        .then(() => statementId)
    })))
}

describe('Push', () => {
  let alephNode
  let alephPeerIdB58
  let statementIds

  before(() => loadTestNodeIds().then(nodeIds => {
    const peerId = nodeIds.pop()
    alephPeerIdB58 = peerId.toB58String()
    alephNode = new AlephNode({peerId})
  })
    .then(() => generatePublisherId())
    .then(publisherId => seedStatementsToAleph(publisherId, alephNode))
    .then(_statementIds => { statementIds = _statementIds })
    .then(() => concatNodeClient())
    .then(concat => concat.authorize(alephPeerIdB58, ['scratch.*']))
  )

  it('pushes data to a concat node', () => {
    return alephNode.start()
      .then(() => concatNodePeerInfo())
      .then(pInfo => alephNode.pushStatementsById(pInfo, statementIds))
      .then(result => {
        assert(result != null)
        assert.equal(result.statements, seedObjects.length, 'peer did not accept all statements')
        assert.equal(result.objects, seedObjects.length, 'peer did not accept all objects')
        assert.equal(result.error, '', 'peer returned an error')
      })
  })
})
