---
name: avoid-complex-inline-scripts
description: Use the Edit tool and jq/yq instead of complex inline scripts (e.g. python heredocs) when a simpler alternative exists
metadata:
  type: feedback
---

Avoid complex inline scripts (e.g. `python3 - <<EOF` heredocs doing multi-line find/replace) when a viable simpler alternative exists: use the Edit tool for changes to a small number of lines in a file, and jq/yq for extracting from JSON/YAML.

**Why:** An inline script embedding file edits in quoted strings is impossible to review in an approval prompt — the user cannot see what actually changes.

**How to apply:** Prefer the Edit tool for few-line changes and jq/yq for JSON/YAML extraction. Not absolutely forbidden: when a complex command or script genuinely is the right tool (e.g., a mechanical change across many files), use it, but first give the user brief context on what the script does and why it's needed in this case.
