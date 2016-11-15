FROM mhart/alpine-node:6.7
WORKDIR /integration

# install git, needed for npm install
RUN apk update
RUN apk add git

# we have native dependencies, we'll need extra tools
RUN apk add --no-cache make gcc g++ python

# npm install
COPY ./package.json .
COPY ./npm-shrinkwrap.json .
RUN npm install

# copy sources
ADD . .

# run integration test
CMD ["/integration/node_modules/.bin/mocha", "--compilers", "js:babel-register", "/integration/integration-test"]
