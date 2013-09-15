#!/bin/bash

# if [ "$(uname)" == "Darwin" ]; then
#     # Do something under Mac OS X platform        
# elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
#     # Do something under Linux platform
# elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW32_NT" ]; then
#     # Do something under Windows NT platform
# fi
# IS_WINDOWS="$(expr substr $(uname -s) 1 10)" == "MINGW32_NT"
# IS_WINDOWS="$(expr substr $(uname -s) 1 6)" == "CYGWIN"

FALSE=
TRUE=0

if [ "$(uname)" == "Darwin" ]
then
	echo running under Mac OS X platform
	IS_WINDOWS=$FALSE
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]
then
	echo running under Linux platform
	IS_WINDOWS=$FALSE
elif [ -n "$COMSPEC" -a -x "$COMSPEC" ]
then 
	echo $0: running under Windows
	IS_WINDOWS=$TRUE
fi

#####

alias ls='ls -AlG'
alias rm='rm -i'

if [ $IS_WINDOWS ]
then
	#echo "RUNNING UNDER WINDOWS!?"
	alias subl='/c/Program\ Files/Sublime\ Text\ 2/sublime_text.exe'
fi
