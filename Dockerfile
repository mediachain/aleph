FROM mhart/alpine-node:6.7
WORKDIR /integration

# install git, needed for npm install
RUN apk update
RUN apk add git

# npm install
COPY ./package.json .
RUN npm install

# copy sources
ADD . .

# run integration test
CMD ["/integration/node_modules/.bin/mocha", "--compilers", "js:babel-register", "/integration/integration-test"]
