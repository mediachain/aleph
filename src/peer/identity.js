const fs = require('fs')
const PeerId = require('peer-id')
const crypto = require('libp2p-crypto')

const KEY_TYPE = 'RSA'  // change to ECC when possible
const KEY_BITS = 1024

function generateIdentity (): PeerId {
  const key = crypto.generateKeyPair(KEY_TYPE, KEY_BITS)
  return new PeerId(key.public.hash(), key)
}

function saveIdentity (peerId: PeerId, filePath: string) {
  if (peerId.privKey == null) {
    throw new Error('PeerID has no private key, cannot persist')
  }

  const privKeyBytes = crypto.marshalPrivateKey(peerId.privKey, KEY_TYPE)
  fs.writeFileSync(filePath, privKeyBytes)
}

function loadIdentity (filePath: string): PeerId {
  const privKeyBytes = fs.readFileSync(filePath)
  return PeerId.createFromPrivKey(privKeyBytes)
}

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity
}
