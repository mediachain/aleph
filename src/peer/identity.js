const thenifyAll = require('thenify-all')
const path = require('path')
const fs = thenifyAll(require('fs'), {}, ['readFile'])
const PeerId = thenifyAll(require('peer-id'), {}, ['createFromPrivKey', 'create'])
const PeerInfo = require('peer-info')
const Crypto = require('libp2p-crypto')
const Multiaddr = require('multiaddr')
const b58 = require('bs58')

const KEY_TYPE = 'RSA'
const KEY_BITS = 2048
const IPFS_CODE = 421

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

const PUBLISHER_KEY_TYPE = 'RSA' // change to Ed25519 once PR is merged
const PUBLISHER_KEY_BITS = 1024 // change to 512
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

module.exports = {
  generateIdentity,
  saveIdentity,
  loadIdentity,
  loadOrGenerateIdentity,
  inflateMultiaddr,
  generatePublisherId
}
