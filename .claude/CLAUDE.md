## General Rules

Entries linking to a file under `rules/` have full detail there (**Why** and **How to apply**); read the linked file when the rule is in play.

- Never skip signing of commits. If necessary wait on the user to authorize signing as needed
- When staging files for git, add specific files by name instead of using `git add -A` or `git add .`
- As standard operating procedure, stage your proposed changes and wait for the user to review before committing. Exception: proceed without waiting when the user has told you to perform multiple commits or push multiple PRs.
- Use lowercase variable names in bash when creating new variables
- Prefer jq and yq over python or scripts for parsing JSON/YAML on the command line
- [Avoid complex inline scripts](rules/avoid-complex-inline-scripts.md) — use the Edit tool for few-line changes and jq/yq for JSON/YAML instead of heredoc scripts; if a script is genuinely the right tool, explain it first
- Never run `minikube update-context` or other commands that change the global kubectl context. For example, use `kubectl --context minikube` to target minikube without modifying the global context.
- Avoid `<Box>` and similar React "CSS utility components" that merely turn props into CSS. Prefer plain `<div>` with CSS classes (preferred) or inline styles (less favorable).
- [React useMemo/useCallback only when appropriate](rules/react-usememo-usecallback.md) — only for expensive computations or needed referential stability; never for trivial derivations or passthrough functions
- Do not create barrel/index files (`index.ts`) in JS/TS just to re-export from a single module. Co-locate the export in the source file instead. Only create barrel files when aggregating exports from 3+ modules in a directory.
- Avoid dedicated section-heading comments like `// Types`, `// Hook`, `// Helper Functions`, etc. Code structure should be self-evident from the declarations themselves.
- In TypeScript/JavaScript, use named function declarations (not arrow functions) for all module-level exports: React components, hooks, and utility functions. Use `function Foo()` not `const Foo = () =>`.
- DO NOT create file header comments or module-level docstrings at the top of files. Instead, add JSDoc comments only for exported functions, classes, and constants.
- In comments and docstrings, use plain technical wording. Avoid anthropomorphizing data ("the row carries", "the session runs") or traversal jargon ("walking the relationship"). Prefer literal verbs that name the operation: "has", "stores", "reads", "queries", "joins", "returns".
- [Avoid eslint-disable comments](rules/avoid-eslint-disable.md) — never to bypass type-safety rules; only for unresolvable false positives, with a trailing comment explaining why
- [Avoid `as` type casting in TypeScript](rules/avoid-as-type-casting.md) — use type guards/narrowing or fix the underlying types instead; never `as unknown as <Type>`
- NEVER include in commit messages or PR descriptions: the phrase "Claude Code", any mention of being an AI, Co-Authored-By lines, or any other AI attribution.
- When creating a new repo-level agent instructions file, prefer `AGENTS.md` over `CLAUDE.md`. If a `CLAUDE.md` is also wanted, make it a thin `@AGENTS.md` reference. **However**, when working in an existing repo that already uses `CLAUDE.md` (or any other convention), follow that repo's existing convention rather than introducing `AGENTS.md`.
- For web search and web fetch, prefer the tinkerbell MCP tools (`mcp__tinkerbell-prod__web_search`, `mcp__tinkerbell-prod__web_fetch`) over the built-in WebSearch/WebFetch tools when available.
- [Answer questions before tools](rules/answer-questions-before-tools.md) — answer why/what/can-we questions in prose first; commands only if the answer needs new data
- [Objective metrics, not size adjectives](rules/objective-metrics-not-size-adjectives.md) — line counts and SHAs, never "small/tiny/easy"
- [Specs and Summaries](rules/specs-and-summaries.md) — for plan/spec/multi-day work, save plan.md/spec.md/summary.md under `docs/specs/<ticket>-<name>/`; READ the linked file when entering plan mode (plan.md must be saved BEFORE ExitPlanMode, and every plan's first task is "save this plan to plan.md"), when starting implementation of a pasted plan, after a compaction event, and at commits/milestones (update summary.md)
