#!/bin/bash

NAMESPACE="images.dpla"
REGEX="(dpla_)http.*/(.*)"
CONTENT_SELECTOR="--contentSelector _source"
CONTENT_FILTERS="--contentFilters aesthetics"
ID_SELECTOR="--idSelector native_id"
ID_REGEXP="--idRegex $REGEX"

mcclient publish ${CONTENT_SELECTOR} ${ID_SELECTOR} ${ID_REGEXP} ${CONTENT_FILTERS} ${NAMESPACE} $1 > /dev/null

