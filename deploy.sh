#!/bin/bash

DATE=`date "+%Y-%m-%dT%H_%M_%S"`

function cpsafe() {
 SRC=$1
 DST=$2
 printf "Copying '$SRC' to $DST..."
 if [[ -f "$SRC" ]]; then 
  [[ -f "$DST" ]] && mv "$DST" "$DST.old-$DATE"
  cp "$SRC" "$DST"
  printf " Copied.\n"
 else
  printf "\n *ERROR*: $SRC doesn't exist!\n\n"
  return 1
 fi
}

cpsafe ./.bashrc ~/.bashrc
cpsafe ./.bash_profile ~/.bash_profile
cpsafe ./.gitconfig ~/.gitconfig
cpsafe ./.hgrc ~/.hgrc

