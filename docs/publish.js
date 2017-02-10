#!/usr/bin/env node

const ghpages = require('gh-pages')
const path = require('path')

ghpages.publish(path.join(__dirname, 'dist'), (err) => {
  if (err) {
    console.error('Error updating gh-pages branch:', err)
    process.exit(1)
  }

  console.log('Done updating gh-pages branch')
})
