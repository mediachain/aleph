#!/usr/bin/env node

const BinBuild = require('bin-build')

const JQ_INFO = {
  name: 'jq',
  url: 'https://github.com/stedolan/jq/releases/download/',
  version: 'jq-1.5'
}

const path = require('path')
const outputPath = path.join(__dirname, '..', 'node_modules', '.bin', 'jq')

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
build.run((err) => {
  if (err) {
    console.log('err', err)
    process.exit(1)
  } else {
    console.log(`jq compiled to ${outputPath}`)
  }
})
