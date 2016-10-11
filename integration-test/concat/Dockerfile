FROM golang:1.7.1

# install gx and gx-go
RUN go get github.com/whyrusleeping/gx
RUN go get github.com/whyrusleeping/gx-go

# Clone concat repo
RUN mkdir -p /go/src/github.com/mediachain
RUN git clone https://github.com/mediachain/concat /go/src/github.com/mediachain/concat
WORKDIR /go/src/github.com/mediachain/concat

ARG concat_ref=master
RUN git checkout ${concat_ref}

# install gx dependencies
RUN gx install --global

# go get some of the bigger dependencies
RUN go get github.com/gorilla/mux
RUN go get github.com/mattn/go-sqlite3 

# install go-gettable deps
RUN gx-go rewrite && go get ./...

# Build the project
RUN /go/src/github.com/mediachain/concat/install.sh

# expose ports
EXPOSE 9000 9001 9002
