#!/usr/bin/env node

const BinBuild = require('bin-build')
const mkdirp = require('mkdirp')

const JQ_INFO = {
  name: 'jq',
  url: 'https://github.com/stedolan/jq/releases/download/',
  version: 'jq-1.5'
}

const path = require('path')
const outputDir = path.join(__dirname, '..', 'bin')
const outputPath = path.join(outputDir, 'jq')

const fs = require('fs')
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

console.log('building jq...')
mkdirp.sync(outputDir)
build.run((err) => {
  if (err) {
    console.log('err', err)
    process.exit(1)
  } else {
    console.log(`jq compiled to ${outputPath}`)
  }
})
