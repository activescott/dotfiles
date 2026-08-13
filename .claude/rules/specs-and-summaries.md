---
name: specs-and-summaries
description: Save plans/specs/summaries under docs/specs/NNN-<name>/; save plan.md before ExitPlanMode; keep summary.md updated at milestones
metadata:
  type: feedback
---

For ongoing work that produces a plan, spec, or post-implementation summary
(multi-day investigations, feature implementations, debugging sessions
worth preserving), save the documents under:

```
docs/specs/NNN-<short-descriptive-name>/
  plan.md       # implementation plan, written before starting work
  spec.md       # design/specification details
  summary.md    # what was done, what was learned, where work left off
```

Directory naming: always prefix with `NNN` — a zero-padded 3-digit sequence
number (`001`, `002`, …), next number = highest existing + 1. It gives every
spec dir a unique ID and keeps directory listings in chronological order
(ticket IDs alone sort badly and not every task has one). If the work has a
natural ticket, insert its ID after the sequence number:
`docs/specs/NNN-<ticket-id>-<short-descriptive-name>/`.

If the repository has a convention of using specs/ or doc/specs use that to follow the repo's conventions.
Follow the repository's conventions on whether or not to commit these files. If existing files are there and committed, commit any new files you add or changes you make. If they are not committed in the current repo, do not commit them unless asked to by the user.

Always include enough context that someone resuming the work cold can pick up without re-deriving what was already learned.

A useful summary includes:

- **Quick commands to resume work**: the exact `git checkout`, deploy, test-run, and log-tail commands you used most often. Paste-ready, not paraphrased.
- **Current task state**: a snapshot of open/in-progress items in plain text. The Claude Code task tracker doesn't survive a full context reset, so capture it here.
- **Non-obvious gotchas about the environment**: things you spent time discovering that aren't documented elsewhere (e.g., two-pod dedup patterns, name-format inconsistencies between systems, async persistence in apparently-synchronous APIs).
- **Tools used and what to look for in their output**: not just "use kubectl logs," but "use kubectl logs with this filter, and these are the log lines that mean X vs Y."
- **Concrete grep/curl/kubectl commands** that proved useful during investigation, with enough context for a reader to know when to reach for each.

Other key things to do in your workflow:

- **When authoring a plan, make the plan's own first task "save this plan to `docs/specs/<ticket>-<name>/plan.md`"**. Whoever executes the plan — this session, a fresh session, or another agent — then persists it before touching code, even if every other safeguard was missed.
- **BEFORE calling ExitPlanMode**, save the plan to `plan.md`. Context is lost after exiting plan mode, so the plan must be written to disk while still in plan mode.
- **When starting implementation of a plan** (e.g. the user pastes a plan into a fresh session after clearing context), save the plan to `plan.md` as the FIRST step before making any code changes. This is critical because the plan may only exist in the user's prompt and will be lost if not persisted.
- **While working, keep a running log** Upon every commit or upon key milestones, consider if you need to update `summary.md` with progress including key insights discovered (e.g. a particular utility found or created or command to run, a potential root cause of a bug, etc.), milestones (e.g. a test created that reproduces something, initial feature implementation, etc.) etc.
- **After a compaction event**, if actively working on implementing a plan, re-read the plan file from `specs/<feature-name>/plan.md` to restore context.
- **After finishing implementation of a plan, save a summary** of what was done to `specs/<feature-name>/summary.md` alongside the plan file.
