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

IS_WINDOWS=$FALSE
IS_MAC=$FALSE

if [ "$(uname)" == "Darwin" ]
then
	echo running under Mac OS X platform
	IS_MAC=$TRUE
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]
then
	echo running under Linux platform
elif [ -n "$COMSPEC" -a -x "$COMSPEC" ]
then 
	echo $0: running under Windows
	IS_WINDOWS=$TRUE
fi

#####

alias ls='ls -AlG'
alias rm='rm -i'
alias gdiff='git diff --color --cached'

if [ $IS_WINDOWS ]
then
	#echo "RUNNING UNDER WINDOWS!?"
	alias subl='/c/Program\ Files/Sublime\ Text\ 2/sublime_text.exe'
elif [ $IS_MAC ] && [ ! -f ~/bin/subl ]
then
	echo linking subl command
	ln -s "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl" ~/bin/subl
fi

if [ $IS_MAC ]
then
	alias nuget='mono /usr/local/bin/nuget.exe'
	export EDITOR='subl -w'
fi


export PATH=/Users/swilleke/bin/Sencha/Cmd/3.1.2.342:$PATH
export SENCHA_CMD_3_0_0="/Users/swilleke/bin/Sencha/Cmd/3.1.2.342"
export VAGRANT_LOG=INFO
export LATEST_PPM_PACKAGE=7.0.0.1897 #get it from http://teamcity.hq.daptiv.com/viewType.html?buildTypeId=bt1427
