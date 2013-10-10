#NOTE: .bash_profile vs .bashrc: http://www.joshstaiger.org/archives/2005/07/bash_profile_vs.html

source ~/.bashrc

if [ -f ~/.bash_secrets ]
then
	source ~/.bash_secrets
fi