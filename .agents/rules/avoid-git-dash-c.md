Avoid `git -C <path>`. Use the bash tool's `workdir` parameter to run git
commands in a non-default directory.

**Why:** `git -C` and `cd <path> && git ...` are workarounds that pre-date the
bash tool's `workdir` parameter. Using `workdir` keeps the command itself
focused on the git operation (no path prefix to read past) and is consistent
with how every other bash tool command is invoked. The `workdir` parameter is
the supported way to scope a command to a directory; `git -C` is a
double-application of cwd handling.

**How to apply:** Pass `workdir` on the bash tool when targeting a directory
other than the default. For example, prefer `bash({command: "git status",
workdir: "/Users/foo/bar"})` over `git -C /Users/foo/bar status` or
`(cd /Users/foo/bar && git status)`. The same applies to short git chains
(`git fetch && git status` in another repo) and to git commands inside
multi-command sequences where a different cwd is needed.