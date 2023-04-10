# zsh shell: https://linuxhint.com/configure-setup-zshrc-zsh/
# The next file is .zshrc that contains the shell configurations and commands. 
# It is sourced in interactive shells and contains aliases, key bindings, 
# variables, and functions.

# If not running interactively, don't do anything
[ -z "$PS1" ] && return

# source common .<shell>rc stuff for bash and zsh:
source ~/.shrc

# zsh-specific stuff below here
autoload -Uz compinit
compinit
_comp_options+=(globdots)

# rbenv:
which -s rbenv && eval "$(rbenv init - zsh)"

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

precmd () { __git_ps1 "%F{magenta}%n@%m%f" ": %~$ " " (%s)" }

##########