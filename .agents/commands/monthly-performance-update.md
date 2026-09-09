---
description: Draft my monthly RapidSOS continuous performance update, section by section, with my approval on every item
---

Help me write my monthly Continuous Performance update via the
`rsos-continuous-performance` MCP. Target month: $ARGUMENTS (if empty, the current
month; state which month you're working on before anything else).

**You are not writing this update. I am.** Your job is to gather evidence, propose
short options, and make me think. I approve every item before it is written, and I
approve the whole update before it is submitted.

## The app's own rubric (quoted verbatim — this is the bar)

> A short end-of-month note so your leader stays current - 1:1s stay focused, and the
> quarterly check-in has no surprises. This is your running record of the month.
>
> **Examples of good monthly updates**
>
> - Specific. "Cut search API latency by 40% and shipped it to production" beats
>   "worked on performance."
> - Honest about risks. Flagging a slip early is a strength. It gives your leader time
>   to help.
> - Short. A few bullets under each heading is plenty.
> - Tied to your goals. Show movement on the goals you set, not just activity. Goals
>   come in October.
>
> **AVOID**
>
> - Writing an essay. Length is not the point.
> - Listing every task. Focus on what mattered.
> - Hiding problems until the quarterly check-in. Nothing there should be a surprise.

Judge every bullet against that list before proposing it.

## The app's storage model — read this BEFORE any write

The MCP takes a **list** of bullet strings per heading. The CPP web UI renders each
heading as a **single rich-text box showing only element `[0]`**. Every item after
the first is stored, returned by `get_update`, and **invisible to my leader** — with
no error and no warning.

- **Write each heading as ONE item with the lines joined by `\n`.** Newlines survive
  and render as separate lines in the box. Never pass a multi-element list.
- **`proud_moment` holds exactly one item.** A second element is dropped at write
  time — `heading_counts` goes 2 → 1. Merge into one line before writing.
- **`get_update` is NOT verification.** It happily reports all 5 items present while
  the page shows 1. The only real check is the rendered page: ask me to reload and
  paste a screenshot, then diff it against what you sent.
- **Writes after submit go live immediately.** State stays `submitted`, so a fix does
  not need a resubmit to reach my leader. Resubmitting only restamps it as
  changed-since-reviewed.
- If I say the app looks broken or truncated, **check before reassuring me**. In
  August 2026 the update sat submitted showing 1 of 5 delivered bullets, 1 of 3
  focus_next, 1 of 3 needs, 1 of 2 at_risk.

## Rules that override everything below

- **Never call `submit_update`** unless I say the word "submit" in that turn.
  Submitting is what makes it visible to my leader. Saving a draft with
  `write_update` is fine once I've approved that section. "post", "both", "go",
  "ok", and a bare approval of some other question are **not** "submit" — ask which
  I meant rather than guessing.
- `needs`, `proud_moment`, and `for_leader` **must be my own words** — the MCP
  refuses `composed` text in those fields. Propose wording, but then ask me to give
  you the sentence I want, and write it with `text_origin: verbatim`. Do not
  reword what I say.
  - When my answer runs long (it will — I answer these in a paragraph, not a
    bullet), **cuts are safe, rewording is not**. Offer a trimmed version built only
    from my own words first.
  - If I then say tightening is fine, say plainly that anything you author is
    `composed` by the tool's definition and cannot be laundered as `verbatim` —
    then show the tightened text and have me **adopt it explicitly**. My selecting
    the exact wording is what makes `verbatim` honest. `AskUserQuestion` with the
    candidate texts in `preview` is the cleanest way to get that adoption.
  - Say which words you changed and which claims you preserved. Do not silently
    fix my typos in a `verbatim` field; ask.
- `delivered`, `focus_next`, `at_risk` may be `composed`, but still only after I
  approve the exact bullets.
- `write_update` overwrites every bullet under a heading you pass, with no undo. Only
  pass the headings I just approved. Call `get_update` first and echo the existing
  bullets before overwriting anything non-empty.

## Length — the hard part

Models write too much. Less is more here.

- **3-5 lines max per heading**, fewer is better. 2 strong lines beat 5 weak ones.
  ("Lines", not "bullets" — they all live inside one newline-joined item. See the
  storage model above.)
- **One sentence per line, ≤ 25 words.** No sub-bullets. No preamble sentence.
- `proud_moment` is **one line, and the cap does not apply** — it is a single-item
  heading, so a slightly longer sentence there beats losing half the meaning.
- Lead with the outcome and the number: "Cut search API latency 40%, shipped to prod"
  not "Worked on performance improvements for the search API, which resulted in..."
- Cut any bullet that is activity without a result, or that my leader would not act
  on or remember.
- Skip a heading entirely rather than padding it. `at_risk` and `for_leader` are
  optional — empty is a valid, common answer.

## 1. Gather evidence first

Read before drafting. Do this in parallel where you can.

1. `get_update` for the month — existing draft, `heading_counts`, and the weekly
   cards (`weeks`). Weekly cards I already wrote are the best raw material; mine them
   before going anywhere else. Expect them to be **empty** through August 2026. Say so
   in one line and move to GitHub and Jira; don't stall or treat the emptiness as an
   error. Also check the payload for a
   **goals** field: goals
   land in the app in October 2026, so before then there is nothing there and no
   goals framing to apply. If goals ARE present, they anchor the update — say which
   goal each `delivered` bullet moves, put goal movement above unrelated activity,
   and call out any goal with no movement this month as an `at_risk` candidate.
2. `list_my_actions` (`state: all`) — what I committed to and what closed.
3. `list_one_on_ones` for the month window, then `get_one_on_one` on any that look
   substantive — themes my leader already raised should not be a surprise here.
4. GitHub — PRs I authored/merged in the window across the **whole RapidSOS org**, not
   one repo (`--owner`, not `--repo`; I work in many repos there):
   ```bash
   gh search prs --author=activescott --owner=RapidSOS \
     --merged-at=">=<month-start>" --limit 100 \
     --json repository,number,title,url,closedAt --sort updated
   ```
   Group by repository in the digest — which repos I was in is itself signal about
   breadth of work. Also sweep open PRs still in flight at month end (swap
   `--merged-at` for `--updated` plus `--state=open`); those feed `focus_next` and
   `at_risk`, not `delivered`.
   `--merged-at=">=<month-start>"` has no upper bound, so it returns next month's
   merges too — filter on `closedAt` before counting anything.
5. Jira — tickets I moved in the window:
   ```
   (assignee = currentUser() OR reporter = currentUser())
     AND updated >= "<month-start>" AND updated < "<next-month-start>" ORDER BY updated DESC
   ```
   Fetch full descriptions for the 3-6 tickets central to each theme — the numbers
   and root causes live in descriptions, not summaries. `jira_get` takes
   `issue_id_or_key` (one key), not a list — fire the calls in parallel. If a ticket
   I mention by key is not in the window's results, fetch it anyway; the parent that
   frames a theme is often untouched that month.
6. Slack — my posts across any channel, for context only. Never count Slack posts as
   an output metric.

Then show me a **compact evidence digest**: themes with the concrete numbers
attached, ~10 lines. Not a list of every PR and ticket. Ask me what I think mattered
before you draft anything — my read of the month outranks the artifact count.

## 2. Draft one heading at a time

For each heading, in this order, propose and stop for my approval before moving on:

1. **`delivered` — "What I delivered this month."** What changed, and by how much.
   Outcomes, not tasks. Pull numbers from ticket descriptions, not paraphrase.
2. **`focus_next` — "Where I am focused next month."** 2-3 bullets. Real intent, not
   a backlog dump. Ask me what I'm actually planning if the evidence doesn't say.
3. **`needs` — "What I need from my people leader."** Ask me directly: what is
   blocked, what decision am I waiting on, where do I need air cover? Suggest
   candidates from the evidence (stalled PRs, unresolved 1:1 actions, cross-team
   blockers), but the wording must be mine. An empty answer here is usually wrong —
   push once, then accept it.
   My answer is often **one ask plus its supporting evidence**, not several peer
   asks. The app gives no nesting, so carry the subordination in the wording: put
   the ask on line 1 and prefix each supporting line with `Why:`. Do not leave
   reasons looking like separate requests.
4. **`at_risk` — "Anything at risk, or a goal that has changed."** Optional. Flagging
   a slip early is a strength — if the evidence shows a slip, name it and ask whether
   I want it in. Nothing here should surprise my leader at the quarterly check-in.
5. **`proud_moment` — "A moment I am proud of."** My words. Suggest 2-3 candidates
   from the evidence in one line each, then ask me to pick and phrase it.
6. **`proud_values`** — after the proud moment is set, propose which of
   `purpose_over_pride`, `urgency`, `pioneering`, `trust_and_safety` fit, and why in
   a half-line each. Optional; don't force all four.
7. **`for_leader` — "Anything else for my leader."** Optional and usually empty. Ask,
   don't invent.

Save each approved heading with `write_update` as we go (draft only), **newline-joined
into a single item** per the storage model above. Tell me what you wrote and what it
replaced, and check `heading_counts` in the response — an `after` that is not 1 means
you passed a list and the extra lines are about to be invisible.

## 3. Review before submit

When all headings are done, `get_update` and show me the whole thing as it is stored,
with a word count per heading. **Then ask me to reload the page and confirm every
line renders** — `get_update` cannot detect the one-item-per-heading problem. Then:

- Name anything that reads as filler, duplicated across headings, or activity without
  an outcome — and propose a cut.
- Say what a skeptical leader would ask that this update doesn't answer.
- Ask if I want anything cut, sharpened, or reordered.

Then ask whether to submit. Only call `submit_update` on an explicit yes in that turn.
