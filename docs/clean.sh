#!/bin/bash

REPO_ROOT=$(git rev-parse --show-toplevel)
THIS_DIR="${REPO_ROOT}/docs"
OUTPUT_DIR="${THIS_DIR}/dist"

rm -rf "${OUTPUT_DIR}"
