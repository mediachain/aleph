const path = require('path')
const mkdirp = require('mkdirp')
const {PublisherId} = require('../../lib/peer/identity')

const NUM_IDS = 20
const outputDir = path.join(__dirname, 'publisher_ids')
mkdirp.sync(outputDir)

const promises = []
for (let i = 0; i < NUM_IDS; i++) {
  promises.push(
    PublisherId.generate().then(id =>
      id.save(path.join(outputDir, `${id.id58}.id`)))
  )
}

Promise.all(promises).then(ids => {
  console.log(`wrote ${ids.length} ids to ${outputDir}`)
})
