# Shell Prompt Fixes - Summary

## What was done

### Fix 1: Git completion "obsolete" error in zsh
- Removed `git-completion.bash` sourcing from `.shrc` (was shared by both shells)
- Added it to `.bashrc` only (bash-specific), since zsh already gets git completion via `compinit`
- Updated `lib/git-prompt.sh` (599 -> 672 lines) and `lib/git-completion.bash` (4019 -> 4027 lines) to latest from official git repo

### Fix 2: Option+Backspace word deletion
- Added `bindkey '^[^?' backward-kill-word` to `.zshrc` for zsh
- Created new `.inputrc` with `"\e\C-?": backward-kill-word` for bash
- Added `.inputrc` symlink to `script/setup`
- Added PlistBuddy command to `script/setup` to enable "Use Option as Meta key" in macOS Terminal.app

### Fix 3: CTRL+R reverse search wrapping in bash
- Wrapped `${MAGENTA}` and `${COL_RESET}` in `\[...\]` non-printing markers in `.bashrc` PROMPT_COMMAND
- This tells readline which bytes are invisible so it calculates prompt width correctly

## Files changed
- `.shrc` - removed git-completion.bash block
- `.bashrc` - added git-completion sourcing + fixed `\[...\]` wrapping
- `.zshrc` - added backward-kill-word bindkey
- `.inputrc` - new file for bash readline config
- `script/setup` - added .inputrc symlink + macOS Terminal meta key setting
- `lib/git-prompt.sh` - updated to latest
- `lib/git-completion.bash` - updated to latest
