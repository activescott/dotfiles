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

# Midnight Commander:
[[ -d "$DIR/.config/mc" ]] || mkdir -p "$DIR/.config/mc"
[[ -d "$DIR/.local/share/mc" ]] || mkdir -p "$DIR/.config/mc"

for filepath in $DIR/.config/mc/*; do
    filename=`basename $filepath`
    # echo "hi $filepath -> $filename"
    cpsafe "$filepath" ~/.config/mc/$filename
done 
for filepath in $DIR/.local/share/mc/*; do
    filename=`basename $filepath`
    # echo "hi $filepath -> $filename"
    cpsafe "$filepath" ~/.local/share/mc/$filename
done 

cpsafe "$DIR/.bashrc" ~/.bashrc
cpsafe "$DIR/.bash_profile" ~/.bash_profile
cpsafe "$DIR/.gitconfig" ~/.gitconfig
cpsafe "$DIR/.hgrc" ~/.hgrc
cpsafe "$DIR/.bash_secrets" ~/.bash_secrets
cpsafe "$DIR/github.sh" ~/github.sh
