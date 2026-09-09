---
description: Generate the weekly work update for client invoice notes from GitHub, Jira, and Slack
---

Generate my weekly work update for the Invoice notes of my client work,
covering last Monday through Friday. State the exact date window at the top before
anything else; ask only if genuinely ambiguous — if today is Sat/Sun, default to the
workweek that just ended.

If an argument is supplied, treat it as the target window (e.g. a date, "week of Aug 24",
or an explicit range) instead of defaulting to the most recent workweek: $ARGUMENTS

## Gather

1. GitHub — PRs I authored across the **whole RapidSOS org**, not one repo
   (`--owner`, not `--repo`; I work in many repos there):

   ```bash
   gh search prs --author=activescott --owner=RapidSOS --updated=">=<mon>" \
     --limit 100 --json repository,number,title,state,isDraft,url,createdAt,updatedAt,closedAt --sort updated
   ```

   Then per PR, using the `repository` from that result — do not assume one repo:

   ```bash
   gh pr view <n> --repo RapidSOS/<repo> \
     --json number,state,additions,deletions,changedFiles,commits
   ```

   Also count PRs I reviewed for others:

   ```bash
   gh search prs --reviewed-by=activescott --owner=RapidSOS --updated=">=<mon>"
   ```

   Exclude from all counts any PR merged before the window that merely got touched inside it.

2. Jira — my tickets. Note JQL precedence: parenthesize the OR.

   ```
   (assignee = currentUser() OR reporter = currentUser())
     AND updated >= "<mon>" AND updated < "<sat>" ORDER BY updated DESC
   ```

   Then FETCH THE FULL DESCRIPTION of the 3-6 tickets central to each theme. The concrete
   numbers, root causes, and what-triggered-this details live in descriptions, not summaries —
   a run that only reads summaries will produce a vague update.

3. Slack — my posts across any channel for the window: weekly
   Production Error Triage reports, incident/live-debugging threads, proposals, team decisions
   I made or announced. Context only — do NOT count Slack posts as an output metric.

## Write

Open with one line: the date window, then source counts pulled (PRs, tickets, Slack posts).

Then 3-5 theme bullets, one sentence each (long sentences are fine), grouped by theme rather
than by PR/ticket — someone skimming gets "what mattered":

- State what shipped vs. what's in progress, and where shipped-but-undeployed work is stuck.
- For anything security- or incident-related, state what TRIGGERED it — external scanner
  change, customer report, who found it — not just "fixed X."
- Pull in concrete numbers wherever they exist (production rates, backlog deltas, error
  counts, incident volumes). Prefer numbers from ticket descriptions over my paraphrase.
- Skip routine noise (review pings, minor chores) unless it's a distinct theme on its own.
- No per-ticket listing.

Then always close with a final "By the numbers" bullet in this shape:

```
- By the numbers. <N> PRs merged (+<add> / −<del> lines, <F> files, <C> commits) and <N> open
  at week end (+<add> / −<del>, <F> files); <N> tickets filed and <N> closed (<N> delivered,
  <N> canceled/superseded), <N> awaiting deploy; <N> PRs reviewed for teammates; active across
  <N>/5 weekdays and <N> concurrent workstreams (distinct parent epics); <N> triage reports
  published.
```

Count canceled/superseded tickets separately from delivered — never fold them together.
Derive "active weekdays" from PR and Jira activity dates, not local git log (which only sees
the checked-out branch).

Never include an hours estimate or anything that reads as one. The metrics above work because
they are countable facts; an implied hours number is not.

Flag any judgment call that materially changed the counts (exclusions, how something was
categorized) in a line or two after the update.

This is for my private records, provided to the client only on request.

End by asking if I want any bullet expanded, reordered, or pulled out as a headline.
