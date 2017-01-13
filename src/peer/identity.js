const thenifyAll = require('thenify-all')
const path = require('path')
const fs = thenifyAll(require('fs'), {}, ['readFile', 'writeFile'])
const PeerId = thenifyAll(require('peer-id'), {}, ['createFromPrivKey', 'create'])
const PeerInfo = require('peer-info')
const Crypto = thenifyAll(require('libp2p-crypto'), {}, ['unmarshalPrivateKey', 'generateKeyPair'])
const Multiaddr = require('multiaddr')
const b58 = require('bs58')

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
interface P2PSigningPrivateKey {
  sign: (message: Buffer, callback: (err: ?Error, sig: Buffer) => void) => void,
  public: P2PSigningPublicKey,
  bytes: Buffer
}

interface P2PSigningPublicKey {
  verify: (message: Buffer, signature: Buffer, callback: (err: ?Error, valid: boolean) => void) => void,
  bytes: Buffer
}
/* eslint-enable no-undef */

// wrapper classes for the above to expose a Promise-based interface
class PrivateSigningKey {
  publicKey: PublicSigningKey
  _key: P2PSigningPrivateKey // eslint-disable-line no-undef

  constructor (p2pKey: P2PSigningPrivateKey) { // eslint-disable-line no-undef
    this._key = p2pKey
    this.publicKey = new PublicSigningKey(p2pKey.public)
  }

  static load (filename: string): Promise<PrivateSigningKey> {
    return fs.readFile(filename)
      .then(bytes => Crypto.unmarshalPrivateKey(bytes))
      .then(p2pKey => new PrivateSigningKey(p2pKey))
  }

  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  get bytes (): Buffer {
    return this._key.bytes
  }

  sign (message: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this._key.sign(message, (err, sig) => {
        if (err) return reject(err)
        resolve(sig)
      })
    })
  }
}

class PublicSigningKey {
  _key: P2PSigningPublicKey // eslint-disable-line no-undef

  constructor (p2pKey: P2PSigningPublicKey) { // eslint-disable-line no-undef
    this._key = p2pKey
  }

  static load (filename: string): Promise<PublicSigningKey> {
    return fs.readFile(filename)
      .then(bytes => Crypto.unmarshalPublicKey(bytes))
      .then(p2pKey => new PublicSigningKey(p2pKey))
  }

  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  get bytes (): Buffer {
    return this._key.bytes
  }

  verify (message: Buffer, signature: Buffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._key.verify(message, signature, (err, valid) => {
        if (err) return reject(err)
        resolve(valid)
      })
    })
  }
}

export type PublisherId = {
  id58: string,
  privateKey: PrivateSigningKey
}

function generatePublisherId (): Promise<PublisherId> {
  return Crypto.generateKeyPair(PUBLISHER_KEY_TYPE, PUBLISHER_KEY_BITS)
      .then(privateP2PKey => {
        const privateKey = new PrivateSigningKey(privateP2PKey)
        const id58 = b58.encode(privateKey.publicKey.bytes)
        return { id58, privateKey }
      })
}

function publisherKeyFromB58String (key58: string): PublicSigningKey {
  const bytes = Buffer.from(b58.decode(key58))
  const p2pKey = Crypto.unmarshalPublicKey(bytes)
  return new PublicSigningKey(p2pKey)
}

function publisherKeyToB58String (key: PublicSigningKey): string { // eslint-disable-line no-undef
  return b58.encode(key.bytes)
}

function loadPublisherId (filename: string): Promise<PublisherId> {
  return fs.readFile(filename)
    .then(bytes => Crypto.unmarshalPrivateKey(bytes))
    .then(privateKey => ({
      id58: b58.encode(privateKey.public.bytes),
      privateKey
    }))
}

function savePublisherId (publisherId: PublisherId, filename: string): Promise<void> {
  return fs.writeFile(filename, publisherId.privateKey.bytes)
}


module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr,
  generatePublisherId,
  loadPublisherId,
  savePublisherId,
  publisherKeyFromB58String,
  publisherKeyToB58String,
  PublicSigningKey,
  PrivateSigningKey
}
