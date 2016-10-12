FROM golang:1.7.1

ARG concat_ref=master

# install gx and gx-go
RUN go get github.com/whyrusleeping/gx
RUN go get github.com/whyrusleeping/gx-go

# Fetch package.json so we can gx install
WORKDIR /go/src/github.com/mediachain/concat
RUN curl -O https://raw.githubusercontent.com/mediachain/concat/${concat_ref}/package.json

# install gx dependencies
RUN gx install --global

# go get some of the bigger dependencies
RUN go get github.com/gorilla/mux
RUN go get github.com/mattn/go-sqlite3 
RUN go get -tags=embed github.com/tecbot/gorocksdb

# remove the mediachain dir from the go source root, so we can clone into it in a child image
RUN rm -rf /go/src/github.com/mediachain/concat
