#!/bin/bash

DATE=`date "+%Y-%m-%dT%H_%M_%S"`

function cpsafe() {
 SRC=$1
 DST=$2
 echo "Copying '$SRC' to $DST"
 [[ -f "$SRC" ]] || echo "$SRC doesn't exist!" && return 1
 [[ -f "$DST" ]] && mv "$DST" "$DST.old-$DATE"
 cp "$SRC" "$DST"
}

cpsafe ./.bashrc ~/.bashrc
cpsafe ./.bash_profile ~/.bash_profile
cpsafe ./.gitconfig ~/.gitconfig
cpsafe ./.hgrc ~/.hgrc

