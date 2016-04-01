#!/bin/bash

die () {
	echo >&2 "$@"
	exit 1
}

git rev-parse --is-inside-work-tree &> /dev/null || die 'Not a git repository.'  
tmp=`git remote -v | head -n1 | perl -p -e 's/^origin\s+git\@github.com\:([^\/]+)\/([^\.]+)\.git.*$/http:\/\/github.com\/$1\/$2/s'`
open $tmp
