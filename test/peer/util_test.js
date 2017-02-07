const { expect } = require('chai')
const { describe, it } = require('mocha')

const PeerInfo = require('peer-info')
const util = require('../../src/peer/util')

describe('P2P utils', () => {
  it('lookupResponseToPeerInfo converts from directory lookup to PeerInfo object', () => {
    expect(util.lookupResponseToPeerInfo({})).to.be.null

    const noAddrs = {peer: {id: 'QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Nw'}}
    const noAddrsResult = util.lookupResponseToPeerInfo((noAddrs))
    expect(noAddrsResult).to.be.an.instanceof(PeerInfo)
    expect(noAddrsResult.multiaddrs).to.be.empty
  })
})
