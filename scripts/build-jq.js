#!/usr/bin/env node

const os = require('os')
const fs = require('fs')
const path = require('path')
const BinBuild = require('bin-build')
const mkdirp = require('mkdirp')
const { get } = require('lodash')
const fetch = require('node-fetch')
const digestStream = require('digest-stream')

const JQ_INFO = {
  name: 'jq',
  url: 'https://github.com/stedolan/jq/releases/download',
  version: 'jq-1.5'
}

const BINARY_INFO = {
  linux: {
    x86: {name: 'jq-linux32', sha256: 'ab440affb9e3f546cf0d794c0058543eeac920b0cd5dff660a2948b970beb632'},
    x64: {name: 'jq-linux64', sha256: 'c6b3a7d7d3e7b70c6f51b706a3b90bd01833846c54d32ca32f0027f00226ff6d'}
  },
  darwin: {
    x64: {name: 'jq-osx-amd64', sha256: '386e92c982a56fe4851468d7a931dfca29560cee306a0e66c6a1bd4065d3dac5'}
  },
  win32: {
    x86: {name: 'jq-win32.exe', sha256: '1860c77bc2816b74f91705b84c7fa0dad3a062b355f021aa8c8e427e388e23fc'},
    x64: {name: 'jq-win64.exe', sha256: 'ebecd840ba47efbf66822868178cc721a151060937f7ac406e3d31bd015bde94'}
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
  const binInfo = get(BINARY_INFO, [platform, arch])
  if (binInfo == null) {
    throw new Error(`No jq binary for ${platform}/${arch}`)
  }

  const {name, sha256} = binInfo
  const binUrl = [JQ_INFO.url, JQ_INFO.version, name].join('/')
  console.log(`Downloading jq binary from ${binUrl}`)
  return fetch(binUrl)
    .then(response => new Promise((resolve, reject) => {
      const hashStream = digestStream('sha256', 'hex', (digest) => {
        if (digest !== sha256) {
          return new Error(`Expected ${name} to have sha256 checksum of ${sha256}, actual: ${digest}`)
        }
      })
      const output = fs.createWriteStream(destinationPath)
      response.body.on('error', reject)
      hashStream.on('error', reject)
      output.on('error', reject)
      output.on('close', resolve)
      response.body
        .pipe(hashStream)
        .pipe(output)
    }))
    .then(() => {
      if (platform !== 'win32') {
        fs.chmodSync(destinationPath, '755')
      }
    })
    .catch(err => {
      // delete output file on download error
      try {
        fs.unlinkSync(destinationPath)
      } catch (e) {
        // ignore deletion errors, just re-throw the underlying error
      }
      throw err
    })
}

mkdirp.sync(outputDir)

downloadBinary(outputPath)
  .catch(err => {
    console.log(`Error downloading jq binary: ${err.message}`)
    console.log('building jq...')

    build.run((err) => {
      if (err) {
        console.log('Error building jq: ', err)
        process.exit(1)
      } else {
        console.log(`jq compiled to ${outputPath}`)
      }
    })
  })

