#!/usr/bin/env bash

# helper script to build the concat-dependencies image and push to docker hub
# you must be logged in to docker hub (with 'docker login') first, or the push will fail.
#
# accepts a tag for the image as the first argument, or will default to 'latest'
# if no tag is given

# set current directory to this dir, in case we're running from elsewhere
repo_root=$(git rev-parse --show-toplevel)
dir="${repo_root}/integration-test/concat-dependencies"

cd "${dir}"

image_tag=$1
if [ "$image_tag" == "" ]; then
    image_tag="latest"
fi

full_tag="mediachain/concat-dependencies:${image_tag}"

if [ "${concat_ref}" == "" ]; then
    concat_ref="master"
fi

docker build --build-arg concat_ref=${concat_ref} -t ${full_tag} .
status=$?
if [ ${status} -ne 0 ]; then
    echo "Error building image, not uploading to docker hub"
    exit ${status}
fi

echo "image \"${full_tag}\" built successfully, pushing to docker hub"
#docker push ${full_tag}

status=$?
if [ ${status} -ne 0 ]; then
    echo "Pushing to docker hub failed.  You may need to 'docker login' first."
fi
exit ${status}
