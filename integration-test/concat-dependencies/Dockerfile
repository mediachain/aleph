FROM golang:1.7.3

ARG concat_ref=master

# Fetch package.json so the setup script can find gx dependencies
WORKDIR /go/src/github.com/mediachain/concat
RUN curl -O -L https://raw.githubusercontent.com/mediachain/concat/${concat_ref}/package.json

# Fetch the setup script and run it
RUN curl -O -L https://raw.githubusercontent.com/mediachain/concat/${concat_ref}/setup.sh
RUN bash ./setup.sh

# remove the mediachain dir from the go source root, so we can clone into it in a child image
RUN rm -rf /go/src/github.com/mediachain/concat
