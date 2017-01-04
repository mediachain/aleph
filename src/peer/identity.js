const thenifyAll = require('thenify-all')
const path = require('path')
const fs = thenifyAll(require('fs'), {}, ['readFile'])
const PeerId = thenifyAll(require('peer-id'), {}, ['createFromPrivKey', 'create'])
const PeerInfo = require('peer-info')
const Crypto = require('libp2p-crypto')
const Multiaddr = require('multiaddr')
const b58 = require('bs58')
const { b58MultihashForBuffer } = require('../common/util')

const NODE_KEY_TYPE = 'RSA'
const NODE_KEY_BITS = 2048
const PUBLISHER_KEY_TYPE = 'Ed25519'
const PUBLISHER_KEY_BITS = 512
const IPFS_CODE = 421

function generateIdentity (): Promise<PeerId> {
  return PeerId.create({bits: NODE_KEY_BITS})
}

function saveIdentity (peerId: PeerId, filePath: string) {
  if (peerId.privKey == null) {
    throw new Error('PeerID has no private key, cannot persist')
  }

  const privKeyBytes = Crypto.marshalPrivateKey(peerId.privKey, NODE_KEY_TYPE)
  fs.writeFileSync(filePath, privKeyBytes)
}

function loadIdentity (filePath: string): Promise<PeerId> {
  return fs.readFile(filePath, [])
    .then(privKeyBytes => PeerId.createFromPrivKey(privKeyBytes))
}

function dirExists (filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory()
  } catch (err) {
    return false
  }
}

function loadOrGenerateIdentity (filePath: string): Promise<PeerId> {
  return loadIdentity(filePath)
    .catch(err => {
      if (err.code === 'ENOENT') {
        if (!dirExists(path.dirname(filePath))) {
          const e = new Error(
            `Unable to access file at ${filePath} because the containing directory ` +
            `does not exist.`)
          e.cause = err
          throw e
        }
      }
      if (err.code === 'EACCES') {
        const e = new Error(
          `Unable to access file at ${filePath} - permission denied.`
        )
        e.cause = err
        throw e
      }
      console.log(`Could not load from ${filePath}, generating new PeerId...`)
      return generateIdentity()
    })
    .then(id => {
      saveIdentity(id, filePath)
      return id
    })
}

function inflateMultiaddr (multiaddrString: string): PeerInfo {
  // total hack to patch in support for /p2p/ multiaddrs, which should
  // be supported upstream soon
  multiaddrString = multiaddrString.replace('/p2p/', '/ipfs/')

  const multiaddr = Multiaddr(multiaddrString)
  const ipfsIdB58String = multiaddr.stringTuples().filter((tuple) => {
    if (tuple[0] === IPFS_CODE) {
      return true
    }
  })[0][1]
  if (ipfsIdB58String == null) {
    throw new Error('multiaddr string must contain /p2p/ or /ipfs/ protocol')
  }

  const peerId = PeerId.createFromB58String(ipfsIdB58String)
  const peerInfo = new PeerInfo(peerId)
  peerInfo.multiaddr.add(multiaddr)
  return peerInfo
}

// eslint (and thus standard.js) doesn't like flow interfaces,
// so we need to temporarily disable the no-undef rule
/* eslint-disable no-undef */
interface PrivateSigningKey {
  sign: (message: Buffer, callback: (err: ?Error, sig: Buffer) => void) => void,
  public: PublicSigningKey,
  bytes: Buffer
}

interface PublicSigningKey {
  verify: (message: Buffer, signature: Buffer, callback: (err: ?Error, valid: boolean) => void) => void,
  bytes: Buffer
}

export type PublisherId = {
  id58: string,
  privateKey: PrivateSigningKey
}
/* eslint-enable no-undef */

function generatePublisherId (): Promise<PublisherId> {
  return new Promise((resolve, reject) => {
    Crypto.generateKeyPair(PUBLISHER_KEY_TYPE, PUBLISHER_KEY_BITS,
      (err: ?Error, privateKey: PrivateSigningKey) => { // eslint-disable-line no-undef
        if (err) return reject(err)
        const id58 = b58.encode(privateKey.public.bytes)
        resolve({
          id58,
          privateKey
        })
      })
  })
}

function publisherKeyFromB58String (key58: string): PublicSigningKey { // eslint-disable-line no-undef
  const bytes = Buffer.from(b58.decode(key58))
  return Crypto.unmarshalPublicKey(bytes)
}

function publisherKeyToB58String (key: PublicSigningKey): string { // eslint-disable-line no-undef
  return b58MultihashForBuffer(key.bytes)
}

function signBuffer (
  key: PrivateSigningKey, // eslint-disable-line no-undef
  message: Buffer)
: Promise<Buffer> {
  return new Promise((resolve, reject) => {
    key.sign(message, (err, sig) => {
      if (err) return reject(err)
      resolve(sig)
    })
  })
}

function verifyBuffer (
  key: PublicSigningKey, // eslint-disable-line no-undef
  message: Buffer,
  sig: Buffer)
: Promise<boolean> {
  return new Promise((resolve, reject) => {
    key.verify(message, sig, (err, valid) => {
      if (err) return reject(err)
      resolve(valid)
    })
  })
}

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr,
  generatePublisherId,
  publisherKeyFromB58String,
  publisherKeyToB58String,
  signBuffer,
  verifyBuffer
}
