---
name: independent-review
description: Get unbiased review feedback by shelling out to an independent Claude Code run (fresh harness, no shared context). Use when asked to independently review local work (staged files, branch diff, specific files, working tree) or a published PR, or to review a plan before implementing it.
---

# Independent review via Claude Code

Shell out to a **fresh, independent** `claude` run to review work the current
agent produced (or is about to produce). The point is independence: the
reviewer starts with no memory of this session's reasoning, so it gives
unbiased feedback instead of rationalizing prior choices. It also runs in its
own harness, which may have different tools/MCP servers available.

## Base command

```sh
claude --model opus --print "<review prompt>"
```

Why these flags (see `claude --help`):

- `--print` / `-p` — non-interactive: print the response and exit. Required;
  without it `claude` starts an interactive session that hangs the agent.
- `--model opus` — strongest reasoning for review work. Reviews are
  read-mostly and infrequent, so the extra cost is worth it. (Sonnet is fine
  for trivial diffs; default to opus unless the user asks otherwise.)
- Run from the repo root so relative paths in the prompt resolve. If the code
  under review lives outside the current directory, add
  `--add-dir <path>` to grant the reviewer access.

Useful extras:

- `--output-format json` — machine-readable result (use when piping the
  review into further processing). Default `text` is right for most cases.
- `--max-budget-usd <amount>` — cap spend on large reviews.
- Do **not** pass `--continue` / `--resume` / `--from-pr` — those reattach to
  an existing session and destroy independence. Every review is a fresh run.

## What every review prompt must contain

A reviewer with no shared context needs two things, stated explicitly:

1. **Requirements (or a pointer to them).** Paste the original requirements
   into the prompt, or link a plan file that contains them (e.g.
   `docs/specs/001-foo/plan.md`). Never assume the reviewer knows the goal.
   `review current plan at ...` works only because the plan file holds the
   requirements.
2. **Scope: what exactly is under review.** One of:
   - local code — say precisely which: staged files (`git diff --cached`),
     branch diff vs base, named files, or the whole working tree.
   - a published PR — give the repo + PR number or URL.
   - a plan/design doc — give the file path, no code review expected.

Also state the **expected output shape** (verdict + findings ordered by
severity + what was checked). Without it you get essay-style feedback.

## Independence hygiene

- Fresh session every time (no resume/continue, as above).
- Do not paste your own conclusions, justifications, or summaries into the
  prompt. State facts (requirements, scope, constraints) and let the reviewer
  reach its own verdict. Pasting "I think this is correct because…" biases
  the review toward agreement.
- Give the reviewer read-only framing: ask it to *report findings*, not to
  edit code or push commits.

## Prompt templates

Replace the bracketed parts. Keep the requirements pointer — it is the most
commonly omitted piece and the one that makes reviews useless without it.

### Local work: staged files

```sh
git diff --cached --stat   # confirm what is staged first
claude --model opus --print "Review the staged changes in this repo ('git diff --cached') against these requirements: <paste requirements or path to plan file>. Scope: only staged files. Report: (1) verdict (approve / needs changes), (2) findings ordered by severity with file:line refs, (3) requirements coverage — which requirements are met, unmet, or unverifiable from this diff, (4) edge cases, error handling, security, and test gaps you noticed. Do not modify anything."
```

### Local work: branch vs base

```sh
claude --model opus --print "Review the diff of the current branch against <base, e.g. main> ('git diff <base>...HEAD') in this repo against these requirements: <paste requirements or path to plan file>. Scope: branch diff only, not the whole tree. Report: (1) verdict (approve / needs changes), (2) findings ordered by severity with file:line refs, (3) requirements coverage, (4) edge cases, error handling, security, and test gaps. Do not modify anything."
```

### Local work: specific files

```sh
claude --model opus --print "Review these files: <path1, path2> in this repo against these requirements: <paste requirements or path to plan file>. Scope: listed files only; read surrounding code only for context. Report: (1) verdict, (2) findings ordered by severity with file:line refs, (3) requirements coverage, (4) edge cases and test gaps. Do not modify anything."
```

### Published PR

```sh
claude --model opus --print "Review PR <owner/repo#N or full URL> using 'gh pr diff <N>' and 'gh pr view <N>' for context. Requirements: <paste requirements or path to plan file, or the PR description if that is the requirements source — say which>. Scope: the PR diff. Report: (1) verdict (approve / needs changes), (2) findings ordered by severity with file:line refs, (3) requirements coverage, (4) edge cases, error handling, security, and test gaps. Do not modify anything, do not comment on the PR."
```

### Plan review (no code yet)

```sh
claude --model opus --print "Review current plan at <path, e.g. docs/specs/001-foo/plan.md>. Requirements are in the plan itself <or: at <path>>. No code exists yet — review the design only. Report: (1) verdict (sound / needs changes), (2) findings ordered by severity: missing requirements, wrong assumptions, simpler alternatives, risks, testability gaps, (3) specific questions the plan leaves unanswered. Do not implement anything."
```

## After the review returns

1. Triage the findings yourself — the reviewer has no stake in the code and
   can flag non-issues; verify each finding against the actual code before
   acting.
2. Fix what holds up, then re-run a fresh review only if the changes were
   substantial (a re-review of a 3-line fix wastes an opus run — say so).
3. Report back to the user: verdict, which findings you accepted/fixed, which
   you rejected and why. Never silently drop reviewer findings.
