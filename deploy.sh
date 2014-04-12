#!/bin/bash

DATE=`date "+%Y-%m-%dT%H_%M_%S"`

function cpsafe() {
 SRC=$1
 DST=$2
 if [[ -f "$DST" ]]; then
  mv -v "$DST" "$DST.old-$DATE"
 fi
 cp -v "$SRC" "$DST" 
}

cpsafe ./.bashrc ~/.bashrc
cpsafe ./.bash_profile ~/.bash_profile
cpsafe ./.gitconfig ~/.gitconfig
#cpsafe ~/.hgconfig ~/.hgconfig

