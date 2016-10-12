// @flow

const dns = require('dns')
const Multiaddr = require('multiaddr')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const RestClient = require('../src/client/api/RestClient')
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

function concatNodeMultiaddr (): Promise<Multiaddr> {
  return lookupMultiaddr(NODE_HOSTNAME, NODE_P2P_PORT)
}

function concatNodeClient (): Promise<RestClient> {
  return dnsLookup(NODE_HOSTNAME)
    .then(ipAddr => new RestClient({peerUrl: `http://${ipAddr}:${NODE_API_PORT}`}))
}

function setConcatNodeStatus (status: NodeStatus): Promise<NodeStatus> {
  if (status === 'public') {
    // TODO: configure node with directory server address
    // needs persistent node id for directory, which probably needs docker volume mounting
  }

  return concatNodeClient()
    .then(client => client.setStatus(status))
}

function concatNodePeerId () {
  return concatNodeClient()
    .then(client => client.id())
    .then(ids => ids.peer)
    .then(PeerId.createFromB58String)
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
  concatNodeMultiaddr,
  concatNodeClient,
  setConcatNodeStatus,
  concatNodePeerId,
  concatNodePeerInfo
}
