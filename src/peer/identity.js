// @flow

/**
 * @module aleph/peer/identity
 * @description Tools for working with libp2p PeerId, PeerInfo objects, cryptographic signatures, and mediachain PublisherId
 */

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
const P2P_CODE = 420
const IPFS_CODE = 421

/**
 * Create a new `PeerId` based on a newly-generated RSA keypair.
 * @return {Promise<PeerId>}
 *  Resolves to a new PeerId object (which includes both public and private keys).
 *  Rejects with an Error if key generation fails.
 */
function generateIdentity (): Promise<PeerId> {
  return PeerId.create({bits: NODE_KEY_BITS})
}

/**
 * Save `peerId` to a binary file at `filePath`.  Synchronous.
 * @param peerId
 *  A `PeerId` object; must contain a private key.
 * @param filePath
 *  Filesystem path to save the PeerId bytes to.
 * @throws if `peerId` does not contain a private key, or the file can't be written.
 */
function saveIdentity (peerId: PeerId, filePath: string) {
  if (peerId.privKey == null) {
    throw new Error('PeerID has no private key, cannot persist')
  }

  const privKeyBytes = Crypto.marshalPrivateKey(peerId.privKey, NODE_KEY_TYPE)
  fs.writeFileSync(filePath, privKeyBytes)
}

/**
 * Load a `PeerId` from a binary file (see {@link saveIdentity})
 * @param filePath
 *  Filesystem path to load the PeerId from.
 *
 * @return {Promise<PeerId>}
 *  Resolves to the loaded PeerId object on success.
 *  Rejects with an Error if the file is unreadable or doesn't contain a valid PeerId.
 */
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

/**
 * Attempt to load a `PeerId` from the given `filePath`.
 * If that fails, but the parent directory exists and is writable,
 * generate a new PeerId and save it to `filePath`.
 *
 * @param filePath
 *  Path to load/save the PeerId from/to.
 * @returns {Promise<PeerId>}
 *  The loaded or generated PeerId object.
 */
function loadOrGenerateIdentity (filePath: string): Promise<PeerId> {
  return loadIdentity(filePath)
    .catch(err => {
      if (err.code === 'ENOENT') {
        if (!dirExists(path.dirname(filePath))) {
          const e: Object = new Error(
            `Unable to access file at ${filePath} because the containing directory ` +
            `does not exist.`)
          e.cause = err
          throw e
        }
      }
      if (err.code === 'EACCES') {
        const e: Object = new Error(
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

/**
 * Convert a multiaddr string to a `PeerInfo` object that can be used to locate a peer.
 * The `multiaddrString` must contain either the `/ipfs/` or `/p2p/` protocols, should
 * also include a valid network transport protocol.
 *
 * @param multiaddrString
 * @returns {PeerInfo}
 * @throws if `multiaddrString` is not a valid multiaddr, or if it does not include the `/ipfs/` or `/p2p/` protocols.
 * @example
 * const peerInfo = inflateMultiaddr('/ip4/10.0.1.2/tcp/9000/p2p/QmTa5gGYN4rhHd3nfSRykGHS95835ym4ZgmwYWKmdDFBEm')
 *
 * // throws (no `/ipfs/` or `/p2p` component)
 * inflateMultiaddr('/ip4/10.0.1.2/tcp/9000')
 *
 * // throws (invalid multiaddr)
 * inflateMultiaddr('foo')
 */
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
// These interfaces match the API of the libp2p-crypto key classes
// that we wrap with PublicSigningKey and PrivateSigningKey classes
// below.
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

/**
 * An object that can sign binary messages, producing a cryptographic signature that
 * can be verified by its corresponding {@link peer/identity.PublicSigningKey}
 */
class PrivateSigningKey {
  publicKey: PublicSigningKey
  _key: P2PSigningPrivateKey // eslint-disable-line no-undef

  /**
   * Create a PrivateSigningKey from an object with the interface used by libp2p-crypto's private key classes.
   * @param p2pKey
   */
  constructor (p2pKey: P2PSigningPrivateKey) { // eslint-disable-line no-undef
    this._key = p2pKey
    this.publicKey = new PublicSigningKey(p2pKey.public)
  }

  /**
   * Load a `PrivateSigningKey` from a binary file.
   * @param filename
   * @returns {Promise<PrivateSigningKey>}
   *  Resolves to the loaded key, or rejects with an Error if the file can't be read or doesn't contain a valid key.
   */
  static load (filename: string): Promise<PrivateSigningKey> {
    return fs.readFile(filename)
      .then(bytes => Crypto.unmarshalPrivateKey(bytes))
      .then(p2pKey => new PrivateSigningKey(p2pKey))
  }

  /**
   * Convert a base58-encoded string private key to a `PrivateSigningKey` object.
   * @param str
   *  A base58-encoded string representation of a marshaled private key.
   * @returns {Promise<PrivateSigningKey>}
   *  Resolves to the decoded key, or rejects with an error if `str` is not
   *  a valid base58-encoded private key.
   */
  static fromB58String (str: string): Promise<PrivateSigningKey> {
    return Promise.resolve()
      .then(() => Buffer.from(b58.decode(str)))
      .then(bytes => Crypto.unmarshalPrivateKey(bytes))
      .then(p2pKey => new PrivateSigningKey(p2pKey))
  }

  /**
   * Save the key to a file at `filepath`
   * @param filename
   * @returns {Promise<void>}
   *  Resolves with no value on sucess, rejects with Error on failure.
   */
  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  /**
   * The marshaled binary representation of the key.
   * @returns {Buffer}
   */
  get bytes (): Buffer {
    return this._key.bytes
  }

  /**
   * Returns the base58-encoded form of {@link PrivateSigningKey#bytes}
   * @returns {Buffer}
   */
  toB58String (): string {
    return b58.encode(this.bytes)
  }

  /**
   * Sign a `message` and return (a promise of) the signature as a `Buffer`
   * @param message
   * @returns {Promise<Buffer>}
   *  Resolves to the message signature, or rejects with Error if signing fails.
   */
  sign (message: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this._key.sign(message, (err, sig) => {
        if (err) return reject(err)
        resolve(sig)
      })
    })
  }
}

/**
 * An object that can verify messages signed by its corresponding private key.
 */
class PublicSigningKey {
  _key: P2PSigningPublicKey // eslint-disable-line no-undef

  /**
   * Create a PublicSigningKey from an object with the interface used by libp2p-crypto's public key classes.
   * @param p2pKey
   */
  constructor (p2pKey: P2PSigningPublicKey) { // eslint-disable-line no-undef
    this._key = p2pKey
  }

  /**
   * Load a `PublicSigningKey` from a binary file.
   * @param filename
   * @returns {Promise<PublicSigningKey>}
   *  Resolves to the loaded key, or rejects with an Error if the file can't be read or doesn't contain a valid key.
   */
  static load (filename: string): Promise<PublicSigningKey> {
    return fs.readFile(filename)
      .then(bytes => Crypto.unmarshalPublicKey(bytes))
      .then(p2pKey => new PublicSigningKey(p2pKey))
  }

  /**
   * Convert a base58-encoded string public key to a `PublicSigningKey` object.
   * @param str
   *  A base58-encoded string representation of a marshaled public key.
   * @returns {Promise<PublicSigningKey>}
   *  Resolves to the decoded key, or rejects with an error if `str` is not
   *  a valid base58-encoded public key.
   */
  static fromB58String (b58String: string): PublicSigningKey {
    const bytes = Buffer.from(b58.decode(b58String))
    const p2pKey = Crypto.unmarshalPublicKey(bytes)
    return new PublicSigningKey(p2pKey)
  }

  /**
   * Save the key to a file at `filepath`
   * @param filename
   * @returns {Promise<void>}
   *  Resolves with no value on sucess, rejects with Error on failure.
   */
  save (filename: string): Promise<void> {
    return fs.writeFile(filename, this.bytes)
  }

  /**
   * The marshaled binary representation of the key.
   * @returns {Buffer}
   */
  get bytes (): Buffer {
    return this._key.bytes
  }

  /**
   * Returns the base58-encoded form of {@link PublicSigningKey#bytes}
   * @returns {Buffer}
   */
  toB58String (): string {
    return b58.encode(this.bytes)
  }

  /**
   * Verify a message signed with this key's private key.
   * @param message
   * @param signature
   * @returns {Promise<boolean>}
   *  Resolves to true if signature is valid, false if invalid.
   *  Rejects with an Error if validation completely.
   */
  verify (message: Buffer, signature: Buffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._key.verify(message, signature, (err, valid) => {
        if (err) return reject(err)
        resolve(valid)
      })
    })
  }
}

/**
 * An object used for signing mediachain Statements.
 */
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
