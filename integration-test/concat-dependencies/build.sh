#!/usr/bin/env bash

# helper script to build the concat-dependencies image.
#

OPTIND=1
image_tag="latest"
push_to_docker_hub=0

while getopts "hpt:" opt; do
    case "$opt" in
    h)
        echo "usage: $0 [-t <image_tag>] [-p]"
        echo "-t <image_tag> tag for docker image, defaults to 'latest'"
        echo "-p if present, will push to docker hub after successful build."
        echo "   pushing requires prior docker hub login"
        exit 0
        ;;
    p)
        push_to_docker_hub=1
        ;;
    t)
        image_tag=$OPTARG
        ;;
    esac
done

# set current directory to this dir, in case we're running from elsewhere
repo_root=$(git rev-parse --show-toplevel)
dir="${repo_root}/integration-test/concat-dependencies"

cd "${dir}"

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

echo "image \"${full_tag}\" built successfully"

if [ ${push_to_docker_hub} -ne 0 ]; then
    docker push ${full_tag}

    status=$?
    if [ ${status} -ne 0 ]; then
        echo "Pushing to docker hub failed.  You may need to 'docker login' first."
    fi
    exit ${status}
fi
