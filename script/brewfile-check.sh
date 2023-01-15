#!/usr/bin/env sh
THISDIR=$(cd $(dirname "$0"); pwd) #this script's directory

brew bundle check --file $THISDIR/../Brewfile
