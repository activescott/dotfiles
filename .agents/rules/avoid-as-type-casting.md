---
name: avoid-as-type-casting
description: Avoid the `as` keyword in TypeScript; use type guards/narrowing; never `as unknown as <Type>`
metadata:
  type: feedback
---

Avoid the `as` keyword for type casting in TypeScript. Instead, use type guards, proper type narrowing, or refactor code so TypeScript can infer the correct types. **Never use `as unknown as <Type>`.**

**Why:** The `as` keyword bypasses type checking; the `as unknown as` double-cast is almost always a hack covering up a real type mismatch.

**How to apply:** Fix the underlying types instead of casting: correct interface definitions, widen parameter types, add proper generics, or have classes implement shared interfaces. Reserve `as` for rare circumstances where no type-safe alternative exists.
