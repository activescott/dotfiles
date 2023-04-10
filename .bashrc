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
# with color
# ref: https://unix.stackexchange.com/a/720213/1862
# Escape codes
ESC_SEQ="\033["
COL_RESET=$ESC_SEQ"0m"

FG=$ESC_SEQ"38;5;"
BG=$ESC_SEQ"48;5;"

# standard colors
BLACK=$FG"0m"
RED=$FG"1m"
GREEN=$FG"2m"
YELLOW=$FG"3m"
BLUE=$FG"4m"
MAGENTA=$FG"5m"
CYAN=$FG"6m"
WHITE=$FG"7m"

# high intensity colors
BRIGHT_BLACK=$FG"8m"; GRAY=$BRIGHT_BLACK; GREY=$GRAY
BRIGHT_RED=$FG"9m"
BRIGHT_GREEN=$FG"10m"
BRIGHT_YELLOW=$FG"11m"
BRIGHT_BLUE=$FG"12m"
BRIGHT_MAGENTA=$FG"13m"
BRIGHT_CYAN=$FG"14m"
BRIGHT_WHITE=$FG"15m"

# background standard colors
BG_BLACK=$BG"0m"
BG_RED=$BG"1m"
BG_GREEN=$BG"2m"
BG_YELLOW=$BG"3m"
BG_BLUE=$BG"4m"
BG_MAGENTA=$BG"5m"
BG_CYAN=$BG"6m"
BG_WHITE=$BG"7m"

# background high intensity colors
BG_BRIGHT_BLACK=$BG"8m"; BG_GRAY=$BG_BRIGHT_BLACK; BG_GREY=$BG_GRAY
BG_BRIGHT_RED=$BG"9m"
BG_BRIGHT_GREEN=$BG"10m"
BG_BRIGHT_YELLOW=$BG"11m"
BG_BRIGHT_BLUE=$BG"12m"
BG_BRIGHT_MAGENTA=$BG"13m"
BG_BRIGHT_CYAN=$BG"14m"
BG_BRIGHT_WHITE=$BG"15m"

##########
# Prompt
# https://github.com/git/git/blob/master/contrib/completion/git-prompt.sh
# https://digitalfortress.tech/tutorial/setting-up-git-prompt-step-by-step/
# https://voracious.dev/blog/a-guide-to-customizing-the-zsh-shell-prompt
# https://zsh.sourceforge.io/Doc/Release/Prompt-Expansion.html
if [ -f ~/lib/git-prompt.sh ]; then
  GIT_PS1_SHOWDIRTYSTATE=true
  #GIT_PS1_SHOWSTASHSTATE=true
  #GIT_PS1_SHOWUNTRACKEDFILES=true
  #GIT_PS1_SHOWUPSTREAM="auto"
  #GIT_PS1_HIDE_IF_PWD_IGNORED=true
  GIT_PS1_SHOWCOLORHINTS=true
  . ~/lib/git-prompt.sh
fi

P_GIT_BRANCH=`__git_ps1 "${RED}(%s)${COL_RESET}"`

P_USER='\u'
P_HOST='\h'
P_PATH='\w'

PROMPT_COMMAND='__git_ps1 "${MAGENTA}\u@\h${COL_RESET}" ": \w$ " " (%s)"'

##################################################
# /PROMPT
##################################################
