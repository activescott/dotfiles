Maintain a single `handoff.md` in the repo's spec root (same directory convention
as [[specs-and-summaries]], e.g. `docs/specs/handoff.md`) listing in-progress,
unfinished work.

**Why:** A fresh session — agent or human — needs one place to see what's in
flight without spelunking spec directories or git history.

**How to apply:**

- Scope: only spec-worthy work — tasks that get (or should get) a
  `docs/specs/<ticket>-<name>/` directory per [[specs-and-summaries]]. Do not
  add quick one-off fixes.
- When you start work on such a task, add one line item under "In progress":
  `- <concise description> — [plan](NNN-name/plan.md)` (link to the task's
  plan.md or summary.md in its spec directory, markdown-style like the
  CLAUDE.md rule links).
- One line per item. Detail lives in the linked spec doc, never in handoff.md.
- When a task completes with no further work remaining, remove its line. There
  is no "Completed" section — finished work is recorded in the spec dirs and
  git history.
- Optional "Next up" section: if upcoming work is known (an ordered backlog of
  future spec-worthy tasks), list it the same one-line-with-link way. If not
  known, omit the section.
- If handoff.md doesn't exist, create it starting with this self-describing
  header:

  ```markdown
  # Handoff — in-progress work index

  Each line below is one unfinished task, linking to its detailed plan/summary
  under this directory. When you start work, add a line; when work fully
  completes, remove the line. Keep entries to one line — detail belongs in the
  linked spec doc. An optional "Next up" section lists known upcoming work in
  order.

  ## In progress

  ## Next up
  ```

- Whether to commit handoff.md follows the repo's existing practice for spec
  docs (same rule as [[specs-and-summaries]]): if docs/specs files are
  committed in the repo, commit handoff.md updates alongside the work. If not
  (e.g. open-source or client repos), keep it local and uncommitted, and add
  `docs/specs/handoff.md` to `.git/info/exclude` so it stays out of
  `git status` without touching any committed file.
