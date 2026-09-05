---
name: avoid-eslint-disable
description: Avoid eslint-disable comments; never to bypass type-safety rules; only for unresolvable false positives with an explanation
metadata:
  type: feedback
---

Avoid `eslint-disable-next-line` comments in most circumstances. Never use them to bypass rules that exist to enforce type safety (e.g., `@typescript-eslint/no-non-null-assertion`).

**Why:** Disabling a type-safety rule hides the real problem the rule exists to catch; the unsafe code remains.

**How to apply:** Write better, more type-safe code using proper null checks, type guards, or refactoring. A disable is appropriate only when a lint rule produces a false positive that cannot be resolved by writing different code (e.g., `import/no-unused-modules` on framework-convention exports like Next.js middleware). Always include a trailing comment explaining why the disable is needed.
