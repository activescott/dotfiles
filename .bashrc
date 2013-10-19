#!/bin/bash

#NOTE: .bash_profile vs .bashrc: http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html

####
# constants
####
FALSE=
TRUE=0

#####
# detect host OS
#####
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
# aliases
#####
alias ls='ls -AlG'
alias rm='rm -i'
alias gdiff='git diff --color --cached'
alias sha256='shasum -a 256'

#####
# windows (cygwin) vs mac specific stuff
#####
if [ $IS_WINDOWS ]
then
	#echo "RUNNING UNDER WINDOWS!?"
	alias subl='/c/Program\ Files/Sublime\ Text\ 2/sublime_text.exe'
elif [ $IS_MAC ] && [ ! -f /usr/local/bin/subl ]
then
	echo "linking subl command (enter password for sudo)..."
	sudo ln -s "/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl" /usr/local/bin/subl
fi

if [ $IS_MAC ]
then
	alias nuget='mono /usr/local/bin/nuget.exe'
	export EDITOR='subl -w'
fi

#####
# PATH variable
#####
# NOTE: About paths: http://serverfault.com/a/146142/28798 (i.e. drop files /etc/paths.d $PATH only works in terminal )
export PATH=~/.rbenv/shims:~/bin:/usr/local/bin:$PATH # standard path: (note rbenv shims in front as it needs to be in front: https://github.com/sstephenson/rbenv#understanding-shims)
#for macports (macports owns /opt/local/, see http://guide.macports.org/#installing.shell)
export PATH=/opt/local/bin:/opt/local/sbin:$PATH
export MANPATH=/opt/local/share/man:$MANPATH
export PATH=$PATH:/Users/swilleke/bin/Sencha/Cmd/3.1.2.342 # app-specific paths
#####
# other variables
#####
export SENCHA_CMD_3_0_0="/Users/swilleke/bin/Sencha/Cmd/3.1.2.342"
export VAGRANT_LOG=INFO
export LATEST_PPM_PACKAGE=7.0.0.1897 #get it from http://teamcity.hq.daptiv.com/viewType.html?buildTypeId=bt1427
export VAGRANT_LOG=warn # debug|info|warn|error http://docs.vagrantup.com/v2/debugging.html
