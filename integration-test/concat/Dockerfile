FROM mediachain/concat-dependencies

# Clone concat repo
RUN mkdir -p /go/src/github.com/mediachain
RUN rm -rf /go/src/github.com/mediachain/concat
ARG concat_ref=master
RUN echo "checking out concat at ${concat_ref}" && git clone https://github.com/mediachain/concat /go/src/github.com/mediachain/concat
WORKDIR /go/src/github.com/mediachain/concat
RUN git checkout ${concat_ref}

# Build the project
RUN /go/src/github.com/mediachain/concat/install.sh

# Copy the test identities to /integration-test/mcnode and /integration-test/mcdir 
VOLUME /integration-test
COPY ./test-identities/mcnode /integration-test/mcnode
COPY ./test-identities/mcdir /integration-test/mcdir

# expose ports
EXPOSE 9000 9001 9002
