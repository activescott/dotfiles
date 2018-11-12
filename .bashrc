#!/bin/bash

#NOTE: .bash_profile vs .bashrc: http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html

# Some apps reload ~/.bashrc eventhough it has already been run in a parent environment (incorrectly on mac IMHO!),
# This is a way to prevent it:
# Update: VSCode seems to import the var, but not the environment, so we allow it to load if one of the VSCODE_* vars are defined defined.
# Update: Gnome's terminal keeps the BASHRC_LOADED var around but doesn't import the rest. So we alos lod if GNOME_SHELL_SESSION_MODE is defined.
# Update: We set IS_MC in ~/.config/mc/bashrc to let this file know it's midnight commander's subshell.
if [[ (-z ${BASHRC_LOADED}) || (-n ${VSCODE_CLI}) || (-n ${VSCODE_PID}) || (-n ${VSCODE_IPC_HOOK}) || (-n ${IS_MC}) || (-n ${GNOME_SHELL_SESSION_MODE}) ]]
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
	IS_LINUX=$FALSE

	if [ "$(uname)" == "Darwin" ]
	then
		echo running under Mac OS X platform
		IS_MAC=$TRUE
	elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]
	then
		IS_LINUX=$TRUE
		echo running under Linux platform
	elif [ -n "$COMSPEC" -a -x "$COMSPEC" ]
	then
		echo $0: running under Windows
		IS_WINDOWS=$TRUE
	fi

	#####
	# aliases
	#####
	alias ls='ls -AlGFh'
	alias ll='ls -AlGFh'
	alias rm='rm -i'
	alias grep='grep --color=auto'
	alias gdiff='git diff --color --cached'
	alias sha256='shasum -a 256'
	alias top='top -o cpu'
	alias github='~/github.sh'
	alias json='python -m json.tool' # http://stackoverflow.com/a/1920585/51061
	alias lso="ls -alG | awk '{k=0;for(i=0;i<=8;i++)k+=((substr(\$1,i+2,1)~/[rwx]/)*2^(8-i));if(k)printf(\" %0o \",k);print}'" #http://agileadam.com/2011/02/755-style-permissions-with-ls/
	# code is a function to support passing the arguments; also use CODE_PATH to set EDITOR (which git uses for merge comments)
	if [ $IS_LINUX ]
	then
		CODE_PATH=/snap/bin/code
	elif [ $IS_MAC ]
	then
		CODE_PATH=/usr/local/bin/code
	else
		CODE_PATH=/usr/local/bin/code
	fi

	function code() {
		if [ $IS_LINUX ]
		then
			$CODE_PATH --disable-gpu $@ ;
		elif [ $IS_MAC ]
		then
			$CODE_PATH $@ ;
		else
			$CODE_PATH $@ ;
		fi
	}

		if [ $IS_LINUX ]
		then
			export EDITOR='$CODE_PATH --disable-gpu -w $@ ;'
		elif [ $IS_MAC ]
		then
			export EDITOR='$CODE_PATH -w $@ ;'
		else
			export EDITOR='$CODE_PATH -w $@ ;'
		fi

	#####
	# windows (cygwin) vs mac specific stuff
	#####
	# NOTE: Using /usr/LOCAL/bin per http://unix.stackexchange.com/questions/8656/usr-bin-vs-usr-local-bin-on-linux (not managed by distro)

	if [ $IS_MAC ]
	then
		alias nuget='mono /usr/local/bin/nuget.exe'
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
	# SIMPLE: PS1='\u@\h:\w \$ '
	# with color:
    BLACK=30
    BLUE=34
    CYAN=36
    GREEN=32
    PURPLE=35
    RED=31
    WHITE=37
    YELLOW=33
		DEFAULTCOLOR=00

    NORMAL=0
    BOLD=1 # (It depends on the terminal emulator.)
    DIM=2
    UNDERLINE=4
    BLINK=5 # (This does not work in most terminal emulators.)
    INVERSECOLOR=7 # (This inverts the foreground and background colors, so you’ll see black text on a white background if the current text is white text on a black background.)
    HIDDEN=8

	if [[ (-n ${IS_MC}) ]]
	then
		# if midnight commander's subshell we append (mc) to prompt
		PS1="\[\033[${DIM};${PURPLE}m\]\u@\h:\[\033[${DIM};${GREEN}m\]\w (mc) \$ \[\033[${NORMAL};${DEFAULTCOLOR}m\]"
	else
		PS1="\[\033[${DIM};${PURPLE}m\]\u@\h:\[\033[${DIM};${GREEN}m\]\w \$ \[\033[${NORMAL};${DEFAULTCOLOR}m\]"
	fi

	# Prevent some items from going into .bash_history: https://www.gnu.org/software/bash/manual/html_node/Bash-Variables.html
	export HISTSIZE=50
	export HISTFILESIZE=50
	export HISTIGNORE="bitcoind walletpassphrase*:./bitcoind walletpassphrase*:btc walletpassphrase*"

	#####
	# ss dev:
	if [ $IS_MAC ]
	then
		export JAVA_HOME=$(/System/Library/Frameworks/JavaVM.framework/Versions/Current/Commands/java_home)
	else
		# assuming linux
		export JAVA_HOME=~/apps/java
		export PATH="$PATH:$JAVA_HOME"

	fi
	export GIT_ROOT=~/git
	export GIT_APP_CORE=${GIT_ROOT}/app-core


	#####
	# PATH variable
	#####
	# NOTE: About paths: http://serverfault.com/a/146142/28798 (i.e. drop files /etc/paths.d $PATH only works in terminal )
	export PATH=~/.rbenv/shims:~/bin:/usr/local/bin:$PATH # standard path: (note rbenv shims in front as it needs to be in front: https://github.com/sstephenson/rbenv#understanding-shims)

	export PATH=$PATH:/opt/local/bin:/opt/local/sbin # for macports (macports owns /opt/local/, see http://guide.macports.org/#installing.shell)
	export MANPATH=/opt/local/share/man:$MANPATH # for macports+man
	export SCALA_HOME=/usr/local/share/scala # http://www.scala-lang.org/documentation/getting-started.html
	export PATH=$PATH:$SCALA_HOME/bin
	export GOROOT=/usr/local/go # http://golang.org/doc/install
	export PATH=$PATH:$GOROOT/bin
	export PATH=$PATH:/usr/local/opt/node/bin #node/npm
	export PATH=$PATH:~/.npm-global/bin # requires setting npm config set prefix '~/.npm-global'; See https://docs.npmjs.com/getting-started/fixing-npm-permissions
	export PATH="$JAVA_HOME/bin:$PATH"
	export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
	export PATH="$PATH:~/.config/yarn/global/node_modules/.bin" #yarn global installs
	# /PATH variable

	#####
	# other variables
	#####
	# JIRA Develpoment:
	ATLAS_HOME='/usr/local/Cellar/atlassian-plugin-sdk/6.2.2/libexec'

	##### DOCKER @ smartsheet
    export COMPOSE_PROJECT_NAME=smartsheet
    export GIT_ROOT=/home/${USER}/git
    export GIT_APP_CORE=${GIT_ROOT}/app-core
    export COMPOSE_FILE=${GIT_APP_CORE}/docker-compose.yml
else
	echo "Someone tried to load .bashrc again. Denied!"
fi
