## General Rules

- Never skip signing of commits. If necessary wait on the user to authorize signing as needed
- When staging files for git, add specific files by name instead of using `git add -A` or `git add .`
- use lowercase variable names in bash when creating new variables
- Prefer jq and yq over python or scripts for parsing JSON/YAML on the command line
- Never run `minikube update-context` or other commands that change the global kubectl context. Use `kubectl --context minikube` to target minikube without modifying the global context.
- Avoid `<Box>` and similar React "CSS utility components" that merely turn props into CSS. Prefer plain `<div>` with CSS classes (preferred) or inline styles (less favorable). Exception: Themed colors that require styled-components access.
- Only use React `useMemo`/`useCallback` when appropriate: expensive computations (sorting/mapping unbounded lists, complex transforms), referential stability needed for dependency arrays or props passed to memoized children. Do NOT wrap trivial derivations (property access, `.find()`, `.slice()`, simple conditionals) or passthrough functions.
- Do not create barrel/index files (`index.ts`) in JS/TS just to re-export from a single module. Co-locate the export in the source file instead. Only create barrel files when aggregating exports from 3+ modules in a directory.
- Avoid dedicated section-heading comments like `// Types`, `// Hook`, `// Helper Functions`, etc. Code structure should be self-evident from the declarations themselves.
- In TypeScript/JavaScript, use named function declarations (not arrow functions) for all module-level exports: React components, hooks, and utility functions. Use `function Foo()` not `const Foo = () =>`.
- DO NOT create file header comments or module-level docstrings at the top of files. Instead, add JSDoc comments only for exported functions, classes, and constants.
- In comments and docstrings, use plain technical wording. Avoid anthropomorphizing data ("the row carries", "the session runs") or traversal jargon ("walking the relationship"). Prefer literal verbs that name the operation: "has", "stores", "reads", "queries", "joins", "returns".
- Avoid `eslint-disable-next-line` comments in most circumstances. Never use them to bypass rules that exist to enforce type safety (e.g., `@typescript-eslint/no-non-null-assertion`) — instead, write better, more type-safe code using proper null checks, type guards, or refactoring. However, `eslint-disable-next-line` is appropriate when a lint rule produces a false positive that cannot be resolved by writing different code (e.g., `import/no-unused-modules` on framework-convention exports like Next.js middleware). Always include a trailing comment explaining why the disable is needed.
- Avoid the `as` keyword for type casting in TypeScript. Instead, use type guards, proper type narrowing, or refactor code so TypeScript can infer the correct types. The `as` keyword bypasses type checking and should only be used in rare circumstances where no type-safe alternative exists. **Never use `as unknown as <Type>`** — this double-cast is almost always a hack covering up a real type mismatch. Fix the underlying types instead: correct interface definitions, widen parameter types, add proper generics, or have classes implement shared interfaces.
- NEVER include in commit messages or PR descriptions: the phrase "Claude Code", any mention of being an AI, Co-Authored-By lines, or any other AI attribution.
- When creating a new repo-level agent instructions file, prefer `AGENTS.md` over `CLAUDE.md`. If a `CLAUDE.md` is also wanted, make it a thin `@AGENTS.md` reference. **However**, when working in an existing repo that already uses `CLAUDE.md` (or any other convention), follow that repo's existing convention rather than introducing `AGENTS.md`.

## Specs and Summaries

For ongoing work that produces a plan, spec, or post-implementation summary
(multi-day investigations, feature implementations, debugging sessions
worth preserving), save the documents under:

```
docs/specs/<ticket>-<short-descriptive-name>/
  plan.md       # implementation plan, written before starting work
  spec.md       # design/specification details
  summary.md    # what was done, what was learned, where work left off
```

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

- **BEFORE calling ExitPlanMode**, save the plan to `plan.md`. Context is lost after exiting plan mode, so the plan must be written to disk while still in plan mode.
- **When starting implementation of a plan** (e.g. the user pastes a plan into a fresh session after clearing context), save the plan to `plan.md` as the FIRST step before making any code changes. This is critical because the plan may only exist in the user's prompt and will be lost if not persisted.
- **While working, keep a running log** Upon every commit or upon key milestones, consider if you need to update `summary.md` with progresss including key insights discovered (e.g. a particular utility found or created or command to run, a potential root cause of a bug, etc.), milestones (e.g. a test created that reproduces something, initial feature implementation, etc.) etc.
- **After a compaction event**, if actively working on implementing a plan, re-read the plan file from `specs/<feature-name>/plan.md` to restore context.
- **After finishing implementation of a plan, save a summary** of what was done to `specs/<feature-name>/summary.md` alongside the plan file.
