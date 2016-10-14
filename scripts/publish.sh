#!/bin/bash

NAMESPACE='foo.bar'
ID_SELECTOR='_source.native_id'

mcclient publish $NAMESPACE $ID_SELECTOR $1 > /dev/null

