// @flow

const dns = require('dns')
const path = require('path')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const RestClient = require('../src/client/api/RestClient')
const { loadIdentity } = require('../src/peer/identity')
import type { NodeStatus } from '../src/client/api/RestClient'

function dnsLookup (hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, 4, (err, address) => {
      if (err) return reject(err)
      resolve(address)
    })
  })
}

const DIRECTORY_HOSTNAME = 'mcdir'
const NODE_HOSTNAME = 'mcnode'
const DIRECTORY_PORT = 9000
const NODE_P2P_PORT = 9001
const NODE_API_PORT = 9002

function lookupMultiaddr (hostname: string, port: number): Promise<Multiaddr> {
  return dnsLookup(hostname).then(addr => Multiaddr(`/ip4/${addr}/tcp/${port}`))
}

function directoryMultiaddr (): Promise<Multiaddr> {
  return lookupMultiaddr(DIRECTORY_HOSTNAME, DIRECTORY_PORT)
}

function directoryPeerId (): Promise<PeerId> {
  return loadIdentity(path.join(__dirname, 'concat', 'test-identities', 'mcdir', 'identity.node'))
}

function directoryPeerInfo (): Promise<PeerInfo> {
  return Promise.all([directoryMultiaddr(), directoryPeerId()])
    .then(([maddr, peerId]) => {
      const peerInfo = new PeerInfo(peerId)
      peerInfo.multiaddr.add(maddr)
      return peerInfo
    })
}

function concatNodeMultiaddr (): Promise<Multiaddr> {
  return lookupMultiaddr(NODE_HOSTNAME, NODE_P2P_PORT)
}

function concatNodePeerId (): Promise<PeerId> {
  return loadIdentity(path.join(__dirname, 'concat', 'test-identities', 'mcnode', 'identity.node'))
}

function concatNodeClient (): Promise<RestClient> {
  return dnsLookup(NODE_HOSTNAME)
    .then(ipAddr => new RestClient({apiUrl: `http://${ipAddr}:${NODE_API_PORT}`}))
}

function setConcatNodeDirectoryInfo (): Promise<*> {
  return Promise.all([concatNodeClient(), directoryMultiaddr(), directoryPeerId()])
    .then(([client, dirAddr, dirId]) => {
      return client.setDirectoryIds(dirAddr.toString() + '/p2p/' + dirId.toB58String())
    })
}

function setConcatNodeStatus (status: NodeStatus): Promise<NodeStatus> {
  let setupPromise = Promise.resolve()
  if (status === 'public') {
    setupPromise = setConcatNodeDirectoryInfo()
  }

  return setupPromise
    .then(() => concatNodeClient())
    .then(client => client.setStatus(status))
}

function setConcatNodeInfoMessage (message: string): Promise<string> {
  return concatNodeClient()
    .then(client => client.setInfo(message))
}

function concatNodePeerInfo (): Promise<PeerInfo> {
  return Promise.all([concatNodeMultiaddr(), concatNodePeerId()])
    .then(([maddr, peerId]) => {
      const peerInfo = new PeerInfo(peerId)
      peerInfo.multiaddr.add(maddr)
      return peerInfo
    })
}

module.exports = {
  dnsLookup,
  lookupMultiaddr,
  directoryMultiaddr,
  directoryPeerId,
  directoryPeerInfo,
  concatNodeMultiaddr,
  concatNodeClient,
  setConcatNodeStatus,
  setConcatNodeInfoMessage,
  concatNodePeerId,
  concatNodePeerInfo
}
