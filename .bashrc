#!/bin/bash

#NOTE: .bash_profile vs .bashrc: http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html

# Boxen at Daptiv edits /etc/profile to reload ~/.bashrc (incorrectly on mac IMHO!), I 
#  and load ~/.bashrc from ~/.bash_profile, which caused .bashrc to load twice. This is a way to prevent it:
if [[ -z "$BASHRC_LOADED" ]]
then
	export BASHRC_LOADED=1 

	# If not running interactively, don't do anything
	[ -z "$PS1" ] && return

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
	alias ls='ls -AlGF'
	alias ll='ls -AlGF'
	alias rm='rm -i'
	alias grep='grep --color=auto'
	alias gdiff='git diff --color --cached'
	alias sha256='shasum -a 256'
	#####
	# windows (cygwin) vs mac specific stuff
	#####
	# NOTE: Using /usr/LOCAL/bin per http://unix.stackexchange.com/questions/8656/usr-bin-vs-usr-local-bin-on-linux (not managed by distro)
	SUBL_LINK=/usr/local/bin/subl

	if [ $IS_WINDOWS ] && [ -f '/c/Program\ Files/Sublime\ Text\ 2/sublime_text.exe' ]
	then
		#echo "RUNNING UNDER WINDOWS!?"
		alias subl='/c/Program\ Files/Sublime\ Text\ 2/sublime_text.exe'
	elif [ $IS_MAC ] && [ ! -f $SUBL_LINK ]
	then
		echo "No \`subl\` link. Looking for sublime text..."
		SUBL2="/Applications/Sublime Text 2.app/Contents/SharedSupport/bin/subl"
		SUBL3="/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl"
		
		# On a fresh mac, /usr/local doesn't exist.
		[ -d "/usr/local/bin" ] || sudo mkdir -pv "/usr/local/bin"

		if [ -f "$SUBL3" ]
		then
			echo "linking subl command to Sublime Text 3 (enter password for sudo)..."
			sudo ln -fs "$SUBL3" $SUBL_LINK
		elif [ -f "$SUBL2" ]
		then
			echo "linking subl command to Sublime Text 2 (enter password for sudo)..."
			sudo ln -fs "$SUBL2" $SUBL_LINK
		else
			echo "No Sublime Text install found. \`subl\` won't work!"
		fi

	fi

	if [ $IS_MAC ]
	then
		alias nuget='mono /usr/local/bin/nuget.exe'
		export EDITOR='subl -w'
		alias shred='rm -P' # mac doesn't include gnu shred, but uses -P with rm
	fi

	#####
	# rvm NONONONOO RVM!!! Use rbenv!
	#####
	# [[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm" # Load RVM into a shell session *as a function*
	# /rvm 


	#####
	# Bash Customization:
	#####
	# Prevent some items from going into .bash_history: https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html
	export HISTSIZE=50
	export HISTFILESIZE=50
	export HISTIGNORE="bitcoind walletpassphrase*:./bitcoind walletpassphrase*:btc walletpassphrase*"


	#####
	# PATH variable
	#####
	# NOTE: About paths: http://serverfault.com/a/146142/28798 (i.e. drop files /etc/paths.d $PATH only works in terminal )
	export PATH=~/.rbenv/shims:~/bin:/usr/local/bin:$PATH # standard path: (note rbenv shims in front as it needs to be in front: https://github.com/sstephenson/rbenv#understanding-shims)

	export PATH=/opt/local/bin:/opt/local/sbin:$PATH # for macports (macports owns /opt/local/, see http://guide.macports.org/#installing.shell)
	export MANPATH=/opt/local/share/man:$MANPATH # for macports+man
	export SCALA_HOME=/usr/local/share/scala # http://www.scala-lang.org/documentation/getting-started.html
	export PATH=$PATH:$SCALA_HOME/bin
	export GOROOT=/usr/local/go # http://golang.org/doc/install
	export PATH=$PATH:$GOROOT/bin
	export PATH=$PATH:/opt/chef/embedded/bin:$PATH
	export PATH=$PATH:/Users/swilleke/bin/Sencha/Cmd/3.1.2.342 # app-specific paths
	# /PATH variable

	#####
	# other variables
	#####
	export SENCHA_CMD_3_0_0="/Users/swilleke/bin/Sencha/Cmd/3.1.2.342"
	export VAGRANT_LOG=INFO
	export LATEST_PPM_PACKAGE=7.0.0.1897 #get it from http://teamcity.hq.daptiv.com/viewType.html?buildTypeId=bt1427
	export VAGRANT_LOG=warn # debug|info|warn|error http://docs.vagrantup.com/v2/debugging.html

	#####
	# Ruby versions
	#  Nothing in ruby ecosystem works together, so using the below vars just to track versions that I happen to find worked at some point:
	#
	#  As of 2013-11-16 this was working. To switch run:
	#	`rbenv rehash; rbenv install $RUBY_FOR_CHEF; rbenv shell $RUBY_FOR_CHEF; rbenv global $RUBY_FOR_CHEF; gem install chef; rbenv rehash`
	#
	export RUBY_FOR_CHEF=1.9.3-p385 
	# /Ruby versions

	if [ $IS_MAC ] && [ -f /opt/boxen/env.sh ]
	then
		echo "Boxen alert!"
		source /opt/boxen/env.sh
	fi
else
	echo "Someone tried to load .bashrc again. Denied!"
fi
