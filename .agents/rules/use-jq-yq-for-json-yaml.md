---
name: use-jq-yq-for-json-yaml
description: Always use jq for JSON and yq for YAML instead of python/node for reading or analysis
metadata:
  type: feedback
---

Always use `jq` for reading or analyzing JSON and `yq` for YAML. Never use `python3 -c`, python heredocs, `node -e`, `bun`, `tsx`, or other general-purpose runtimes for JSON/YAML inspection, shape discovery, counting, filtering, or field extraction. This applies in Claude Code and opencode alike — both load this rule from the shared `~/.agents/` source.

**Why:** `jq`/`yq` are single-purpose, concise, and reviewable in an approval prompt. Both are pre-approved in Claude (`settings.json` allow) and opencode (`opencode.jsonc` allow), so they run without a permission prompt — unlike `python3`/`node`, which always prompt. A Python probe like `json.load` + `type(data)` + `len(data)` is exactly `jq 'type, (if type == "array" then length else empty end)'`.

**How to apply:**

- Shape/type/count: `jq 'type' file.json`, `jq 'keys' file.json`, `jq 'length' file.json`, `jq '.items | length' file.json` — not `python3 -c "import json..."`.
- Field extraction: `jq '.foo.bar' file.json`, `jq -r '.items[].name' file.json` — not `node -e "JSON.parse..."`.
- YAML: same with `yq` (e.g. `yq '.spec.replicas' deploy.yaml`, `yq 'keys' values.yaml`).
- Only exception: a transformation `jq`/`yq` genuinely cannot express. Then explain what it does and why `jq`/`yq` is insufficient before running it (per `avoid-complex-inline-scripts`).
