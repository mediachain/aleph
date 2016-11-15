const thenifyAll = require('thenify-all')
const fs = thenifyAll(require('fs'), {}, ['readFile'])
const PeerId = thenifyAll(require('peer-id'), {}, ['createFromPrivKey', 'create'])
const PeerInfo = thenifyAll(require('peer-info'), {}, ['create'])
const Crypto = require('libp2p-crypto')
const Multiaddr = require('multiaddr')

const KEY_TYPE = 'RSA'  // change to ECC when possible
const KEY_BITS = 1024

function generateIdentity (): Promise<PeerId> {
  return PeerId.create({bits: KEY_BITS})
}

function saveIdentity (peerId: PeerId, filePath: string) {
  if (peerId.privKey == null) {
    throw new Error('PeerID has no private key, cannot persist')
  }

  const privKeyBytes = Crypto.marshalPrivateKey(peerId.privKey, KEY_TYPE)
  fs.writeFileSync(filePath, privKeyBytes)
}

function loadIdentity (filePath: string): Promise<PeerId> {
  return fs.readFile(filePath, [])
    .then(privKeyBytes => PeerId.createFromPrivKey(privKeyBytes))
}


function loadOrGenerateIdentity(filePath: string): Promise<PeerId> {
    return loadIdentity(filePath)
      .catch(err => {
        console.log(`Could not load from ${filePath}, generating new PeerId...`)
        return generateIdentity()
      })
      .then(id => {
        saveIdentity(id, filePath)
        return id
      })
}

function inflateMultiaddr(multiaddrString: string): Promise<PeerInfo> {
    const multiaddr = Multiaddr(multiaddrString)
    return PeerInfo.create().then(peerInfo => {
      peerInfo.multiaddr.add(multiaddr)
      return peerInfo
    })
}

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr
}
