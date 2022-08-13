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
eval "$(rbenv init - zsh)"

##########
# Prompt
# https://voracious.dev/blog/a-guide-to-customizing-the-zsh-shell-prompt
# https://zsh.sourceforge.io/Doc/Release/Prompt-Expansion.html
setopt PROMPT_SUBST

#autoload -Uz vcs_info # enable vcs_infoprecmd () { vcs_info } # always load before displaying the prompt
#PS1='%n@%m %~ $ '
autoload -Uz vcs_info # enable vcs_info
precmd () { vcs_info } # always load before displaying the prompt
zstyle ':vcs_info:*' formats '(%F{red}%b%f)' # git(main)
#zstyle ':vcs_info:*' formats ' (%b)' # git(main)
PS1='%F{magenta}%n@%m%f %F{green}%~%f ${vcs_info_msg_0_} $ ' # david@macbook /tmp/repo (main) $

##########