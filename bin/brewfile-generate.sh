#!/usr/bin/env sh
THISDIR=$(cd $(dirname "$0"); pwd) #this script's directory

TEMP_BREWFILE=/tmp/Brewfile.tmp

brew bundle dump -f --describe --all --file $TEMP_BREWFILE

cat << EOF > $THISDIR/../Brewfile
##################################################
# install with
# script/brewfile-install.sh (i.e. brew bundle install)
# 
# regen with:
# script/brewfile-generate.sh (i.e. brew bundle dump...)
#
# cleanup homebrew-installed shite with:
# script/brewfile-cleanup-apps.sh (i.e. brew bundle --cleanup)
##################################################
EOF

cat $TEMP_BREWFILE >> $THISDIR/../Brewfile
