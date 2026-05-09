# Shell Prompt Fixes Plan

## Context

Three shell issues need fixing across the dotfiles (used with bash on Linux, zsh on macOS):

1. `git-completion.bash` prints "ERROR: this script is obsolete, please see git-completion.zsh" when sourced in zsh
2. Option+Backspace doesn't delete words in macOS Terminal (works in VSCode)
3. CTRL+R reverse search shows corrupted/wrapped text in bash on Linux

## Fix 1: Git Completion "Obsolete" Error in Zsh

**Root cause**: `.shrc:166-171` sources `~/lib/git-completion.bash` for both shells. The script detects zsh (`ZSH_VERSION`) at line 3969 and errors out. Zsh should use its own completion system instead.

**Changes**:

1. **`.shrc`** - Remove lines 166-171 (the git-completion.bash block)
2. **`.bashrc`** - Add git-completion sourcing after the git-prompt block (after line 84):
   ```bash
   if [ -f ~/lib/git-completion.bash ]; then
     source ~/lib/git-completion.bash
   fi
   ```
3. **Update `lib/git-completion.bash`** - Download latest from `https://raw.githubusercontent.com/git/git/master/contrib/completion/git-completion.bash`
4. **Update `lib/git-prompt.sh`** - Download latest from `https://raw.githubusercontent.com/git/git/master/contrib/completion/git-prompt.sh`

Zsh already gets git completion via `compinit` (`.zshrc:13-14`). `git-prompt.sh` supports both shells and stays in `.bashrc` and `.zshrc` as-is.

## Fix 2: Option+Backspace Word Deletion

**Root cause**: macOS Terminal sends `^[^?` (ESC+DEL) for Option+Backspace, but only when "Use Option as Meta key" is enabled. Neither zsh nor bash configs bind this sequence to backward-kill-word. VSCode handles it natively in its Electron terminal.

**Changes**:

1. **`.zshrc`** - Add after compinit block (after line 15):
   ```zsh
   bindkey '^[^?' backward-kill-word
   ```

2. **Create `.inputrc`** (new file in repo root):
   ```
   # Meta+Backspace deletes previous word (for bash on Linux/macOS)
   "\e\C-?": backward-kill-word
   ```

3. **`script/setup`** - Add after line 71 (near bash entries):
   ```sh
   cpsafe "$DOTFILESDIR/.inputrc" ~/.inputrc
   ```

4. **`script/setup`** - Add macOS Terminal meta key setting (in the macOS section or at end):
   ```sh
   if [ "$(uname)" = "Darwin" ]; then
     # Enable "Use Option as Meta key" in Terminal.app default profile
     current_profile=$(defaults read com.apple.Terminal "Default Window Settings" 2>/dev/null || echo "Basic")
     /usr/libexec/PlistBuddy -c "Set 'Window Settings:${current_profile}:useOptionAsMetaKey' true" ~/Library/Preferences/com.apple.Terminal.plist 2>/dev/null && echo "Enabled 'Use Option as Meta key' for Terminal profile: ${current_profile}" || echo "Note: Manually enable 'Use Option as Meta key' in Terminal > Preferences > Profiles > Keyboard"
   fi
   ```

## Fix 3: CTRL+R Reverse Search Wrapping in Bash

**Root cause**: `.bashrc:92` passes raw ANSI escape sequences (`${MAGENTA}`, `${COL_RESET}`) to `__git_ps1` without `\[...\]` wrappers. `__git_ps1` wraps its own internal colors but NOT the caller's pre/post arguments. Bash's readline counts invisible escape bytes as visible characters, miscalculating prompt width, causing corruption on wrap and during CTRL+R.

**Change**:

1. **`.bashrc` line 92** - Wrap color codes with `\[...\]`:
   ```bash
   # Before:
   PROMPT_COMMAND='__git_ps1 "${MAGENTA}\u@\h${COL_RESET}" ": \w$ " " (%s)"'
   # After:
   PROMPT_COMMAND='__git_ps1 "\[${MAGENTA}\]\u@\h\[${COL_RESET}\]" ": \w$ " " (%s)"'
   ```

Zsh's `.zshrc:36` already uses `%F{magenta}...%f` which ZLE handles correctly - no change needed.

## Files Modified

| File | Action |
|------|--------|
| `.shrc` | Remove git-completion.bash sourcing block (lines 166-171) |
| `.bashrc` | Add git-completion sourcing; fix `\[...\]` wrapping on line 92 |
| `.zshrc` | Add `bindkey '^[^?' backward-kill-word` |
| `.inputrc` | **New file** - readline backward-kill-word binding |
| `script/setup` | Add `.inputrc` symlink + macOS Terminal meta key setting |
| `lib/git-completion.bash` | Update to latest from git repo |
| `lib/git-prompt.sh` | Update to latest from git repo |

## Verification

1. **Fix 1**: Open new zsh session on macOS - no "obsolete" error. `git ch<TAB>` completes. Open bash on Linux - `git ch<TAB>` completes.
2. **Fix 2**: In macOS Terminal, Option+Backspace deletes previous word. In bash on Linux, Meta+Backspace deletes previous word.
3. **Fix 3**: In bash on Linux, type a long command, use CTRL+R - prompt wraps correctly without corruption.
4. Run `script/setup` and confirm `.inputrc` is symlinked and Terminal meta key setting applied.
