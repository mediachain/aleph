FROM mediachain/concat-dependencies

# Clone concat repo
RUN mkdir -p /go/src/github.com/mediachain
RUN rm -rf /go/src/github.com/mediachain/concat
RUN git clone https://github.com/mediachain/concat /go/src/github.com/mediachain/concat
WORKDIR /go/src/github.com/mediachain/concat
ARG concat_ref=master
RUN git checkout ${concat_ref}

# Build the project
RUN /go/src/github.com/mediachain/concat/install.sh

# expose ports
EXPOSE 9000 9001 9002
