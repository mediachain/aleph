const SIMPLE_STMT_1 = {
  id: '4XTTM81cjwraTF9FW33DyCz2PbdQ9peqCXWTz9rBhU3bwm4TE:1485446977027:0',
  publisher: '4XTTM81cjwraTF9FW33DyCz2PbdQ9peqCXWTz9rBhU3bwm4TE',
  namespace: 'scratch.test',
  timestamp: 1485446977027,
  body: { simple: { object: 'foo', refs: [ 'simple-1' ], deps: [], tags: [] } },
  signature: Buffer.from('rYo/HI3zfEO7JtlFzIF9r7bJbqV7p3SjLDoedYQgI3X8zutAUNwayhXJURHVB0Yz/CShfLn+7Mc94iLCCBtJDw==', 'base64')
}

const SIMPLE_STMT_2 = {
  id: '4XTTM81cjwraTF9FW33DyCz2PbdQ9peqCXWTz9rBhU3bwm4TE:1485447081587:1',
  publisher: '4XTTM81cjwraTF9FW33DyCz2PbdQ9peqCXWTz9rBhU3bwm4TE',
  namespace: 'scratch.test',
  timestamp: 1485447081587,
  body: { simple: { object: 'foo', refs: [ 'simple-2' ], deps: [], tags: [] } },
  signature: Buffer.from('6uuCL0zQSuSBuN2a7FeJGp75P5FBJUAwuBzIjC7nZrgVmHFqkiaVPUhO2lGikMh+DaU/Okgrf+thjfFDEFyxCQ==', 'base64')
}

const COMPOUND_STMT = {
  id: '4XTTMDah7ai6vqk6yzAhDtW9ATaEmTDJPNK3kcPT4bLKRuotG:1485447651564:0',
  publisher: '4XTTMDah7ai6vqk6yzAhDtW9ATaEmTDJPNK3kcPT4bLKRuotG',
  namespace: 'scratch.test.compound-stmt',
  timestamp: 1485447651564,
  body: {
    compound: {
      body: [
        { object: 'foo', refs: [ 'compound-1' ], deps: [], tags: [] },
        { object: 'foo', refs: [ 'compound-2' ], deps: [], tags: [] }
      ]
    }
  },
  signature: Buffer.from('eJlR+rsTdiZQ7Lt8oI7M+tvtQPshjOb50OyKtrNQBfZ2KDyTpBIZnTWlZ2CAIq15oYjHetzrfZBxj81Nfu1QCw==', 'base64')
}

const ENVELOPE_EMPTY = {
  id: '4XTTM2hkDuu73NXYakvw2uD6QfNAxB5emTd1P11uYt7YkmcXv:1485448028036:0',
  publisher: '4XTTM2hkDuu73NXYakvw2uD6QfNAxB5emTd1P11uYt7YkmcXv',
  namespace: 'scratch.test.envelope-stmt',
  timestamp: 1485448028036,
  body: { envelope: { body: [] } },
  signature: Buffer.from('2Gk0n6XgzeaY3SCxjXXqwYuZfVqPnulEwyTW3eYeCI1NTq1g8D1I57602ItxEgBfg1CYXr9TBCdkMWnYXWIbDw==', 'base64')
}

const ENVELOPE_STMT = {
  id: '4XTTM2hkDuu73NXYakvw2uD6QfNAxB5emTd1P11uYt7YkmcXv:1485448141505:1',
  publisher: '4XTTM2hkDuu73NXYakvw2uD6QfNAxB5emTd1P11uYt7YkmcXv',
  namespace: 'scratch.test.envelope-stmt',
  timestamp: 1485448141505,
  body: { envelope: { body: [ SIMPLE_STMT_1, SIMPLE_STMT_2 ] } },
  signature: Buffer.from('/94sZ6ETWTNCaHO78h+ifrqrViN4v95//Qx/+j3OmvLqJ3eLrK5damMqbQw06kstVC5II58udNR7zCJFqsYbDw==', 'base64')
}

module.exports = {
  publisherIds: {
    simple: {
      id58: '4XTTM81cjwraTF9FW33DyCz2PbdQ9peqCXWTz9rBhU3bwm4TE',
      privateKey58: 'K3TgUjU7LqKoaGET8vHzwVY33PEk95fU4goQHfBvEWR1bVCLxd2V1RQnLqaTVHXQ2h14EXGxqwtvSir8vBxLmQ43KEjWbbJTgKAKexSr3apeHtQL2scWeaAHShHwVLffX4BzMu9E'
    },
    compound: {
      id58: '4XTTMDah7ai6vqk6yzAhDtW9ATaEmTDJPNK3kcPT4bLKRuotG',
      privateKey58: 'K3TgUsAVZtKR71WG9jUrAt5GzXEVoDyjgDs2eiCaNuTcS8SzFjoBxvrKZ9c5btp4qByMLFrX7XXK9H5G4MEo2Z9hptfWAYK9iBnrWrdVPLLX7SbJz2CPZidrJxMTbF5xM7zX3edA'
    },
    envelope: {
      id58: '4XTTM2hkDuu73NXYakvw2uD6QfNAxB5emTd1P11uYt7YkmcXv',
      privateKey58: 'K3TgTjd6PriGenibzwXWkZcxSYWLPKqMejgFdP9BUjErgwSDPkgPL7AACkvzkXExcvEepo1ZbfoHbo79HJzfkchVFP42UzZ3pYdD2wsq1JHL1UrJ28rza43CqfVW29yYjC81NgJY'
    }
  },
  statements: {
    simple: [ SIMPLE_STMT_1, SIMPLE_STMT_2 ],
    compound: [ COMPOUND_STMT ],
    envelope: [ ENVELOPE_STMT ],
    envelopeEmpty: [ ENVELOPE_EMPTY ]
  },
  expectedRefs: {
    simple: [ new Set(['simple-1']), new Set(['simple-2']) ],
    compound: [ new Set(['compound-1', 'compound-2']) ],
    envelope: [ new Set(['simple-1', 'simple-2']) ],
    envelopeEmpty: [ new Set() ]
  },
  expectedSources: {
    simple: [ SIMPLE_STMT_1.publisher, SIMPLE_STMT_2.publisher ],
    compound: [ COMPOUND_STMT.publisher ],
    envelope: [ SIMPLE_STMT_1.publisher ],
    envelopeEmpty: [ ENVELOPE_STMT.publisher ]
  },
  objectIds: {
    simple: [ ['foo'], ['foo'] ],
    compound: [ ['foo', 'foo'] ],
    envelope: [ ['foo', 'foo'] ],
    envelopeEmpty: [ [] ]
  }
}
