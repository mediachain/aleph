// @flow

function prettyPrint (obj: Object) {
  // for now, use console.dir to dump the object.
  // when we have a hard dependency on jq, we can just pipe through it instead :)
  console.dir(obj, {colors: true, depth: 1000})
}

module.exports = {
  prettyPrint
}
