#!/bin/bash

# check for nvm (node version manager) and make sure it's enabled
# helpful if running commmit hook from outside your shell env
# e.g. from a GUI like gitup

if [ -e "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
fi

# stash un-staged changes
git stash -q --keep-index

# run standard (code style enforcer), flow, and tests
npm run check && npm run test

RESULT=$?

# un-stash
git stash pop -q

# abort commit if anything failed
[ $RESULT -ne 0 ] && exit 1

exit 0
