const fs = require('fs')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const Crypto = require('libp2p-crypto')
const Multiaddr = require('multiaddr')

const KEY_TYPE = 'RSA'  // change to ECC when possible
const KEY_BITS = 1024

function generateIdentity (): PeerId {
  const key = Crypto.generateKeyPair(KEY_TYPE, KEY_BITS)
  return new PeerId(key.public.hash(), key)
}

function saveIdentity (peerId: PeerId, filePath: string) {
  if (peerId.privKey == null) {
    throw new Error('PeerID has no private key, cannot persist')
  }

  const privKeyBytes = Crypto.marshalPrivateKey(peerId.privKey, KEY_TYPE)
  fs.writeFileSync(filePath, privKeyBytes)
}

function loadIdentity (filePath: string): PeerId {
  const privKeyBytes = fs.readFileSync(filePath)
  return PeerId.createFromPrivKey(privKeyBytes)
}

function loadOrGenerateIdentity (filePath: string): PeerId {
  let peerId
  try {
    loadIdentity(filePath)
  } catch (err) {
    console.log(`Could not load from ${filePath}, generating new PeerId...`)
    peerId = generateIdentity()
    saveIdentity(peerId, filePath)
  }

  return peerId
}

function inflateMultiaddr (multiaddrString: string): PeerInfo {
  const multiaddr = Multiaddr(multiaddrString)
  const peerInfo = new PeerInfo()
  peerInfo.multiaddr.add(multiaddr)

  return peerInfo
}

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr
}
