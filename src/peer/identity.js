const thenifyAll = require('thenify-all')
const path = require('path')
const fs = thenifyAll(require('fs'), {}, ['readFile', 'writeFile'])
const PeerId = thenifyAll(require('peer-id'), {}, ['createFromPrivKey', 'create'])
const PeerInfo = require('peer-info')
const Crypto = thenifyAll(require('libp2p-crypto'), {}, ['unmarshalPrivateKey', 'generateKeyPair'])
const { Secp256k1PublicKey } = require('libp2p-crypto-secp256k1')
const Multiaddr = require('multiaddr')
const b58 = require('bs58')
const ethereumUtils = require('ethereumjs-util')
const secp256k1 = require('secp256k1')

const NODE_KEY_TYPE = 'RSA'
const NODE_KEY_BITS = 2048
const PUBLISHER_KEY_TYPE = 'Ed25519'
const PUBLISHER_KEY_BITS = 512
const P2P_CODE = 420
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
  const tuples = multiaddr.stringTuples().filter((tuple) => {
    if (tuple[0] === IPFS_CODE || tuple[0] === P2P_CODE) {
      return true
    }
  })
  if (tuples.length < 1) {
    throw new Error('multiaddr string must contain /p2p/ or /ipfs/ protocol')
  }
  const p2pIdB58String = tuples[0][1]

  const peerId = PeerId.createFromB58String(p2pIdB58String)
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

  static fromB58String (str: string): Promise<PrivateSigningKey> {
    const bytes = Buffer.from(b58.decode(str))
    return Crypto.unmarshalPrivateKey(bytes)
      .then(p2pKey => new PrivateSigningKey(p2pKey))
  }

  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  get bytes (): Buffer {
    return this._key.bytes
  }

  toB58String (): string {
    return b58.encode(this.bytes)
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

  static fromB58String (b58String: string): PublicSigningKey {
    const bytes = Buffer.from(b58.decode(b58String))
    return this.fromBytes(bytes)
  }

  static fromBytes (bytes: Buffer): PublicSigningKey {
    try {
      const p2pKey = Crypto.unmarshalPublicKey(bytes)
      return new PublicSigningKey(p2pKey)
    } catch (err) {
      const ethKey = decodeEthereumPubKey(bytes)
      const p2pKey = new Secp256k1PublicKey(ethKey)
      return new PublicSigningKey(p2pKey)
    }
  }

  static fromSignedEthereumMessage (message: Buffer, signature: Buffer, ethereumAddress: Buffer | string): PublicSigningKey {
    const pubKey = recoverEthereumPubKey(message, signature)
    const addrForSig = ethereumUtils.pubToAddress(pubKey, true)
    const expectedAddr = ethereumUtils.toBuffer(ethereumAddress)
    if (!expectedAddr.equals(addrForSig)) {
      throw new Error(`Public key for signature does not match expected ethereum address ${expectedAddr.toString('hex')}`)
    }
    const p2pKey = new Secp256k1PublicKey(pubKey)
    return new PublicSigningKey(p2pKey)
  }

  get isSecp256k1 () {
    return (this._key instanceof Secp256k1PublicKey)
  }

  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  get bytes (): Buffer {
    return this._key.bytes
  }

  toB58String (): string {
    return b58.encode(this.bytes)
  }

  verify (message: Buffer, signature: Buffer): Promise<boolean> {
    if (this.isSecp256k1 && signature.length === ETH_SIGNATURE_LENGTH) {
      return this.verifyEthereum(message, signature)
    }

    return new Promise((resolve, reject) => {
      this._key.verify(message, signature, (err, valid) => {
        if (err) return reject(err)
        resolve(valid)
      })
    })
  }

  verifyEthereum (message: Buffer, signature: Buffer): Promise<boolean> {
    return Promise.resolve().then(() => {
      if (!this.isSecp256k1) {
        throw new Error('Only secp256k1 public keys can verify ethereum signatures')
      }
      if (signature.length !== ETH_SIGNATURE_LENGTH) {
        throw new Error(`Invalid ethereum signature length ${signature.length}, expected ${ETH_SIGNATURE_LENGTH}`)
      }

      const pubKey = recoverEthereumPubKey(message, signature)
      const p2pKey = new Secp256k1PublicKey(pubKey)
      return p2pKey.bytes.equals(this.bytes)
    })
  }
}

class PublisherId {
  id58: string
  privateKey: PrivateSigningKey

  constructor (privateKey: PrivateSigningKey | P2PSigningPrivateKey) { // eslint-disable-line no-undef
    if (!(privateKey instanceof PrivateSigningKey)) {
      privateKey = new PrivateSigningKey(privateKey)
    }

    this.id58 = b58.encode(privateKey.publicKey.bytes)
    this.privateKey = privateKey
  }

  static generate (): Promise<PublisherId> {
    return Crypto.generateKeyPair(PUBLISHER_KEY_TYPE, PUBLISHER_KEY_BITS)
      .then(key => new PublisherId(key))
  }

  static load (filename: string): Promise<PublisherId> {
    return PrivateSigningKey.load(filename)
      .then(key => new PublisherId(key))
  }

  save (filename: string): Promise<void> {
    return this.privateKey.save(filename)
  }

  sign (message: Buffer): Promise<Buffer> {
    return this.privateKey.sign(message)
  }

  verify (message: Buffer, signature: Buffer): Promise<boolean> {
    return this.privateKey.publicKey.verify(message, signature)
  }
}

const ETH_SIGNATURE_LENGTH = 65

function ethereumPubKeyToStandardSecp (ethKey: Buffer): Buffer {
  return secp256k1.publicKeyConvert(Buffer.concat([Buffer.from([4]), ethKey]))
}

function decodeEthereumPubKey (key: Buffer): Buffer {
  if (key.length === 65 || key.length === 33) {
    key = secp256k1.publicKeyConvert(key)
  } else if (key.length === 64) {
    key = secp256k1.publicKeyConvert(ethereumPubKeyToStandardSecp(key))
  } else {
    throw new Error(`Invalid public key length ${key.length}`)
  }
  return key
}

function recoverEthereumPubKey (message: Buffer, signature: Buffer): Buffer {
  const prefixedMsg = Buffer.concat([
    Buffer.from('\u0019Ethereum Signed Message:\n', 'utf-8'),
    Buffer.from(message.length.toString(), 'utf-8'),
    message
  ])
  const msgHash = ethereumUtils.sha3(prefixedMsg)
  const { v, r, s } = ethereumUtils.fromRpcSig(signature)

  const ethereumPubKey = ethereumUtils.ecrecover(msgHash, v, r, s)
  return ethereumPubKeyToStandardSecp(ethereumPubKey)
}

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr,
  PublisherId,
  PublicSigningKey,
  PrivateSigningKey
}
