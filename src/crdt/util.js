// @flow

module.exports = {
  mapEquals: function mapEquals<K, V>(a: Map<K, V>, b: Map<K, V>): boolean {
    let testVal: ?V
    if (a.size !== b.size) return false
    for (const [k, v] of a) {
      testVal = b.get(k)
      if (testVal !== v || (testVal === undefined && !b.has(k))) {
        return false
      }
    }
    return true
  }
}