#!/bin/bash

NAMESPACE='foo.bar'
CONTENT_SELECTOR='_source'
ID_SELECTOR='native_id'

mcclient publish --contentSelector $CONTENT_SELECTOR --idSelector $ID_SELECTOR $NAMESPACE $1 > /dev/null

