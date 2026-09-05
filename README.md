# dotfiles

Just my personal dotfiles. Move along...

I use these on zsh and bash on macOS and Linux. At one point they worked on windows, but I rarely use them there.

## Installation

I use `script/setup` copy everything to home directory (`~/`).

## Misc Notes

### Git: Signing git commits with ssh keys

I'm signing commits with ssh via [OnlyKey](https://onlykey.io/). I know I can use gpg but since we authenticate with ssh with git almost always, ssh seems even more appropriate.

#### How to

More on this embedded as comments alongside my .gitconfig file. See the comments on the following gitconfig entries. The TLDR:

```sh
git config --global gpg.format ssh
git config --global user.signingkey "key::$(onlykey-agent git@github.com)"
git config --global commit.gpgsign true
git config --global gpg.ssh.program ~/bin/onlykey-git-sign-commit
git config --global gpg.ssh.allowedSignersFile ~/.ssh/authorized_keys
```

The full commandn to sign commits is like this:
```
onlykey-agent git@github.com -- git commit -S -m "fix: testing gitconfig for signing commits with ssh2"
```
The reason this works is that `onlykey-agent git@github.com --` sets `SSH_AUTH_SOCK` environment variable so that git can reach it and sign as expected (I think).

#### References

- https://www.git-scm.com/docs/git-config#Documentation/git-config.txt-gpgformat
- https://www.git-scm.com/docs/git-config#Documentation/git-config.txt-usersigningKey
- https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key
- https://developer.1password.com/docs/ssh/git-commit-signing/

### opencode

User-scoped opencode config lives in `~/.config/opencode/` and is symlinked
from this repo's `.config/opencode/` directory by `script/setup`. It mirrors
the claude-code config in `.claude/`: same rules (via `AGENTS.md`), same MCP
servers (`tinkerbell-prod`, `grafana`), same TypeScript LSP, and a TypeScript
plugin that ports `confirm-before-run.sh` to opencode's `tool.execute.before`
hook. Skills are auto-discovered from `~/.claude/skills/`.

The source files live under `.config/opencode/` (not `.opencode/`) so this
repo isn't treated as an opencode project — opencode walks up from cwd
looking for `.opencode/` and would otherwise double-load the plugin.

#### One-time per machine

```sh
# Install caveman skill for opencode (token-saving prompt rules)
npx skills add JuliusBrussee/caveman --skill '*' -a opencode --yes

# Authenticate with Tinkerbell MCP
opencode mcp auth tinkerbell-prod

# Ensure mcp-grafana is on PATH (brew/npm/manual — your call)
```

## Thanks

I pick up so much from so many places over the years related to dotfiles and shell scripting generally but most recently here are some useful places I found tricks:

- https://github.com/MikeMcQuaid/dotfiles
