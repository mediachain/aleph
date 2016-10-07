// @flow

const testConfig = {
  secureIOEnabled: false
}

if (process.env.ALEPH_TEST_USE_SECIO !== undefined) {
  testConfig.secureIOEnabled = true
}

module.exports = testConfig
