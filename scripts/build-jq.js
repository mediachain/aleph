#!/usr/bin/env node

const os = require('os')
const fs = require('fs')
const path = require('path')
const BinBuild = require('bin-build')
const mkdirp = require('mkdirp')
const { get } = require('lodash')
const fetch = require('node-fetch')

const JQ_INFO = {
  name: 'jq',
  url: 'https://github.com/stedolan/jq/releases/download/',
  version: 'jq-1.5'
}

const BINARY_NAMES = {
  linux: {
    x86: 'jq-linux32',
    x64: 'jq-linux64'
  },
  darwin: {
    x64: 'jq-osx-amd64'
  },
  win32: {
    x86: 'jq-win32.exe',
    x64: 'jq-win64.exe'
  }
}

const outputDir = path.join(__dirname, '..', 'bin')
const outputPath = path.join(outputDir, 'jq')

try {
  fs.accessSync(outputPath, fs.F_OK)
  // already exists
  process.exit(0)
} catch (e) {}

const build = new BinBuild()
  .src(JQ_INFO.url + '/' + JQ_INFO.version + '/' + JQ_INFO.version + '.tar.gz')
  .cmd('./configure --disable-maintainer-mode')
  .cmd('make')
  .cmd(`cp ./jq ${outputPath}`)

function downloadBinary (destinationPath) {
  const platform = os.platform()
  const arch = os.arch()
  const binName = get(BINARY_NAMES, [platform, arch])
  if (binName == null) {
    throw new Error(`No jq binary for ${platform}/${arch}`)
  }

  const binUrl = [JQ_INFO.url, JQ_INFO.version, binName].join('/')
  console.log('Downloading jq binary from ', binUrl)
  return fetch(binUrl)
    .then(response => new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destinationPath)
      response.body.on('error', reject)
      output.on('error', reject)
      output.on('close', resolve)
      response.body.pipe(output)
    }))
    .then(() => {
      if (platform !== 'win32') {
        fs.chmodSync(destinationPath, '755')
      }
    })
}

mkdirp.sync(outputDir)

downloadBinary(outputPath)
  .catch(err => {
    console.log('Error downloading jq binary: ', err.message)
    console.log('building jq...')

    build.run((err) => {
      if (err) {
        console.log('err', err)
        process.exit(1)
      } else {
        console.log(`jq compiled to ${outputPath}`)
      }
    })
  })

