#!/bin/bash

DATE=`date "+%Y-%m-%dT%H_%M_%S"`

function cpsafe() {
 SRC=$1
 DST=$2
 if [[ -f "$SRC" ]]; then 
  [[ -L "$DST" ]] && echo "removing link $DST" && rm "$DST" #rm if link
  [[ -f "$DST" ]] && mv -v "$DST" "$DST.old-$DATE" #mv to "just in case" file
  ln -vs "$SRC" "$DST"
 else
  printf "\n *ERROR*: $SRC doesn't exist!\n\n"
  return 1
 fi
}
DIR=$(cd $(dirname "$0"); pwd) #this script's directory
cpsafe "$DIR/.bashrc" ~/.bashrc
cpsafe "$DIR/.bash_profile" ~/.bash_profile
cpsafe "$DIR/.gitconfig" ~/.gitconfig
cpsafe "$DIR/.hgrc" ~/.hgrc
