#!/bin/bash

#NOTE: .bash_profile vs .bashrc: http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html
#NOTE: Some apps reload ~/.bashrc eventhough it has already been run in a parent environment (incorrectly on mac IMHO!),

# If not running interactively, don't do anything
[ -z "$PS1" ] && return

# source common .<shell>rc stuff for bash and zsh:
source ~/.shrc

##################################################
# Bash-specific customizations:
##################################################
##################################################
# PROMPT
##################################################
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
##################################################
# /PROMPT
##################################################
