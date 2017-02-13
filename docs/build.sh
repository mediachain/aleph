#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
THIS_DIR="${REPO_ROOT}/docs"
NODE_MODULES="${REPO_ROOT}/node_modules"
JSDOC="${NODE_MODULES}/.bin/jsdoc"
TEMPLATE="${NODE_MODULES}/ink-docstrap/template"
SOURCE="${REPO_ROOT}/src"
README="${REPO_ROOT}/README.md"
OUTPUT_DIR="${THIS_DIR}/dist"
CONFIG="${THIS_DIR}/jsdoc-conf.json"

cd ${REPO_ROOT} && ${JSDOC} -c ${CONFIG} -r ${SOURCE} -d ${OUTPUT_DIR} -t ${TEMPLATE} -R ${README}
