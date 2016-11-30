const fs = require('fs')
const path = require('path')
const {generateIdentity} = require('../../lib/peer/identity')

const NUM_IDS = 20
const outputPath = path.join(__dirname, 'test_node_ids.json')

const promises = []
for (let i = 0; i < NUM_IDS; i++) {
  promises.push(
    generateIdentity().then(i => i.toJSON())
  )
}

Promise.all(promises).then(ids => {
  fs.writeFileSync(outputPath, JSON.stringify(ids), {encoding: 'utf8'})
  console.log(`wrote ${ids.length} ids to ${outputPath}`)
})
