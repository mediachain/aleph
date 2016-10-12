FROM mhart/alpine-node:6.7
WORKDIR /integration

# must run npm install outside container before building!
# copy sources
ADD . .

# run integration test
CMD ["/integration/node_modules/.bin/mocha", "--compilers", "js:babel-register", "/integration/integration-test"]
