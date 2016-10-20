#!/bin/bash

NAMESPACE="images.dpla"
CONTENT_SELECTOR="--contentSelector _source"
ID_SELECTOR="--idSelector native_id"
ID_REGEXP="--idRegex '(dpla_)http.*/(.*)'"
CONTENT_FILTERS="--contentFilters aesthetics"

mcclient publish --dryRun ${CONTENT_SELECTOR} ${ID_SELECTOR} ${ID_REGEXP} ${CONTENT_FILTERS} ${NAMESPACE} $1 > /dev/null

