When drafting a message Scott will send **as himself** to other people (Slack
posts and replies, PR/issue comments addressed to someone, emails), write in his
voice rather than report voice. Draft it the way he would rewrite it anyway.

**Why:** Drafts written in report voice get rewritten before posting, which
wastes the draft and risks the edited version losing a technical detail. On
2026-09-23 a Slack draft about an expired CI token survived Scott's edit intact
on every technical fact and lost nearly all of its packaging. The delta was
entirely voice, structure, and scope.

## How to apply

- **Observational, first person, hedged.** "Looks like X...", "I saw that...",
  "it seems to have...", "So now I'm seeing...". Not "X has expired.", not "The
  symptom:". He reports what he observed; he does not pronounce a verdict.
- **No emoji headers, no `FYI` label, no bolded section headers.** Plain
  paragraphs in sequence. An inline lead-in like `Ask:` is fine, unbolded.
- **Code blocks for errors and commands, never blockquotes.**
- **One ask, phrased as a question.** "Ask: I only have push on that repo, could
  someone with admin rotate it?" Lowercase, direct, no imperative.
- **Cut the supporting forensics.** Control experiments, root-cause reasoning
  chains, and "why nobody noticed" analysis belong in the conversation with him,
  not in the message. Keep what broke, the concrete evidence (exact names, dates,
  error text, a link to a failing run), and the ask.
- **Do not instruct the audience on their own system.** He cut a `gh secret set`
  how-to from a message aimed at repo admins, even though he had asked for it.
  They own the repo and know the command. Include a how-to only when the
  recipient plausibly would not know it, or when he asks again after seeing it cut.
- **No unsolicited process advice.** "Worth considering an org-level secret",
  "put a calendar reminder on it": cut. Offer that to him directly and let him
  decide whether it belongs in the message.
- **Keep every technical specific.** Precision is not what softens. Exact secret
  and file names, the literal `${{ ... }}` expression, dates, verbatim error text,
  and links all survived his edit untouched. Shorten by removing analysis and
  structure, never by rounding off facts.
- Casual register is fine and matches him ("trying to run ci on a PR").

## Strip the AI tells

These read as machine-written and are the fastest way to make a draft sound like
it came from a bot instead of from Scott. This applies to the prose of a draft;
leave established formatting conventions alone (the rules index in `AGENTS.md`
uses ` — ` as its separator and stays that way).

- **Em dashes and en dashes (`—`, `–`).** The single strongest tell. Use a comma,
  a colon, parentheses, or just start a new sentence. Hyphens in compound words
  (`org-internal`, `read-only`) are fine.
- **Smart/curly quotes and ellipsis characters** (`"` `"` `'` `…`). Use plain
  ASCII `"`, `'`, and `...`.
- **The antithesis flourish.** "It's not just X, it's Y." "This isn't a bug. It's
  a design decision." State the thing once.
- **Rule-of-three everywhere.** Three parallel clauses or three-item lists as a
  reflex, regardless of how many things there actually are. Use the real number.
- **Bold-label-colon bullets** as the default structure for everything.
- **Throat-clearing and signposting.** "Great question!", "Here's the thing:",
  "Let's dive in", "It's worth noting that", "First... Second... Finally...",
  "In summary", "I hope this helps".
- **LLM diction.** delve, leverage, robust, seamless, crucial, vital, landscape,
  underscore, testament, tapestry, utilize, ensure, facilitate, comprehensive.
  Prefer the plain word: use, make sure, full.
- **Title Case Headers** and headers at all in a short Slack message.
- **Over-hedged summary sentences** that restate what was just said in more
  abstract terms.

## Example: the 2026-09-23 expired-token message

Same facts, same audience. The first is the draft, the second is what Scott
actually posted.

### Before (what not to write)

```
:information_source: FYI — `assemble-helloworld`'s `NPM_GITHUB_TOKEN` secret has expired.

It was last set *2026-06-25*, so it died right around the 90-day mark yesterday.
Nothing announced it.

*The symptom:* `ci.yml` uses `${{ secrets.NPM_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}`,
and the built-in `GITHUB_TOKEN` can't fetch org-`internal` `@rapidsos/*` from GitHub
Packages. So when the PAT stops working, the fallback silently turns into this on
*every* `@rapidsos` package:

> YN0041: @rapidsos/data-plane-core@npm:0.2.116: Invalid authentication (as an unknown user)

*Why nobody noticed:* it needs a yarn cache miss to show up. Every recent PR left
`yarn.lock` untouched, so yarn served from cache and never authenticated. Clean
control: `event-queue` got the identical change the same day and passed, and its
token was refreshed 09-21.

*Ask:* I only have push on that repo — could someone with admin rotate it? A
`read:packages` PAT, SSO-authorized for RapidSOS, then:
```gh secret set NPM_GITHUB_TOKEN --repo RapidSOS/assemble-helloworld```

*Worth considering while we're in there:* a personal PAT on a shared template repo
will do this again every ~90 days, and it'll be just as invisible next time. An
org-level secret or a longer-lived fine-grained token would end the cycle.
```

Wrong in seven ways: emoji and `FYI` header, verdict voice instead of
observational, bolded section headers, an em dash, a blockquote for the error,
the entire cache/control forensics paragraph, a how-to aimed at people who own
the repo, and a closing paragraph of unsolicited advice.

### After (what Scott actually posted)

```
Looks like assemble-helloworld's `NPM_GITHUB_TOKEN` secret has expired. I saw that
it was last set 2026-06-25, and it seems to have died right around the 90-day mark
yesterday.

`ci.yml` uses `${{ secrets.NPM_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}`, and the
built-in `GITHUB_TOKEN` can't fetch org-internal `@rapidsos/*` from GitHub
Packages. So now I'm seeing errors like this trying to run ci on a PR:

```➤ YN0041: @rapidsos/data-plane-auth-client@npm:0.4.4::__archiveUrl=...: Invalid authentication (as an unknown user)```
Example run: <link to the failing job> (for <link to the PR>).

Ask: I only have push on that repo, could someone with admin rotate it?
```

Note what survived: the exact secret name, the exact date, the literal
`${{ ... }}` expression, the verbatim `YN0041` error, and links to the failing run
and the PR. The message got shorter by dropping analysis, not by dropping facts.

Still show him the exact text and get a yes before anything is posted, per
[[feedback_slack_draft_before_send]]. This rule changes how the draft reads, not
whether he approves it.
