#!/bin/bash

die () {
	echo >&2 "$@"
	exit 1
}

git rev-parse --is-inside-work-tree &> /dev/null || die 'Not a git repository.'
# Some notes about why this so I don't forget:
#    `egrep ^origin` to only open github if it is an origin (default) remote and it may not be the first remote in the list
#    ` head -n1 is after the egrep so that we only output a single github http url 
tmp=`git remote -v | egrep ^origin | head -n1 | perl -p -e 's/^origin\s+git\@github.com\:([^\/]+)\/([^\.]+)\.git.*$/http:\/\/github.com\/$1\/$2/s'`
open $tmp

