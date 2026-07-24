---
name: react-usememo-usecallback
description: Only use React useMemo/useCallback for expensive computations or referential stability, never for trivial derivations
metadata:
  type: feedback
---

Only use React `useMemo`/`useCallback` when appropriate: expensive computations (sorting/mapping unbounded lists, complex transforms), or referential stability needed for dependency arrays or props passed to memoized children.

**Why:** Memoizing trivial values adds indirection and maintenance cost with no measurable benefit.

**How to apply:** Do NOT wrap trivial derivations (property access, `.find()`/`.slice()` on small arrays, simple conditionals) or passthrough functions. Reserve memoization for genuinely expensive work or cases where a stable reference is required by a dependency array or a memoized child.
