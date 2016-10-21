// @flow

function prettyPrint (obj: Object) {
  // for now, use console.dir to dump the object.
  // when we have a hard dependency on jq, we can just pipe through it instead :)
  console.dir(obj, {colors: true, depth: 1000})
}

function pluralizeCount (count: number, word: string): string {
  let plural = word
  if (count !== 1) plural += 's'
  return count.toString() + ' ' + plural
}

module.exports = {
  prettyPrint,
  pluralizeCount
}
