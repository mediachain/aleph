// @flow

const chai = require('chai')
chai.use(require('chai-as-promised'))

const { expect } = chai
const { describe, it, before } = require('mocha')
const temp = require('temp').track()

const Id = require('../../src/peer/identity')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')

describe('Peer Identity tools', () => {
  let peerId
  before(() => Id.generateIdentity()
    .then(id => { peerId = id })
    .then(() => expect(peerId).to.be.an.instanceof(PeerId))
  )

  it('loads and saves a PeerId to disk', () => {
    const tmpPath = temp.path()
    Id.saveIdentity(peerId, tmpPath)
    return expect(
        Id.loadIdentity(tmpPath).then(loadedId => loadedId.toB58String())
      ).to.eventually.be.eql(peerId.toB58String())
  })

  it('throws when saving a PeerId without a private key', () => {
    const id = PeerId.createFromB58String('QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Nw')
    expect(() => Id.saveIdentity(id), temp.path())
      .to.throw(Error)
  })

  it('loadOrGenerateIdentity', () => Promise.all([
    expect(Id.loadOrGenerateIdentity(temp.path()))
      .to.eventually.be.an.instanceof(PeerId),

    expect(Id.loadOrGenerateIdentity('/this-dir-probably-doesnt-exist/foo.id'))
      .to.eventually.be.rejectedWith('the containing directory does not exist')
  ]))

  it('inflateMultiaddr', () => {
    expect(Id.inflateMultiaddr('/ip4/127.0.0.1/tcp/1234/p2p/QmZvvcVA8t5qrM5DeQ8xM6PK18qzCYxseYNtaqauhSc4Nw'))
      .to.be.an.instanceof(PeerInfo)

    expect(() => { Id.inflateMultiaddr('/ip4/127.0.0.1/tcp/1234') })
      .to.throw('must contain /p2p/ or /ipfs/ protocol')
  })
})
