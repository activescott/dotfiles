---
name: objective-metrics-not-size-adjectives
description: "Scott wants line/file counts instead of \"small/tiny/easy\" in claims and docs"
metadata:
  type: feedback
---

In feedback entries, summaries, and claims about work: use objective measures (files touched, +lines/−lines, durations, commit SHAs) instead of subjective size words ("small", "tiny", "mechanical", "easy"). Scott rejected a "~5 small mechanical edits" characterization and asked for "a line count or some other objective metric".

**Why:** Subjective size words smuggle in a judgment the reader can't verify; counts let them judge.

**How to apply:** Before writing "small change", compute `git diff --stat`-style numbers and state those. Link evidence (SHAs, run IDs) in anything shared beyond the session — see [[answer-questions-before-tools]].
