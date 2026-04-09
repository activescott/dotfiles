---
description: Convert a project's CLAUDE.md files into agent-agnostic AGENTS.md files, keeping each CLAUDE.md as a thin @-reference. Handles the root CLAUDE.md and any nested ones in subdirectories.
derived-from: https://github.com/jimeh/agentic/blob/main/plugins/agents-md/commands/claude-md-to-agents-md.md
---

## Context

- All CLAUDE.md and AGENTS.md files in the repo:
  !`find . -name 'CLAUDE.md' -o -name 'AGENTS.md' | sort`
- Root CLAUDE.md symlink check:
  !`test -L CLAUDE.md && readlink CLAUDE.md || echo "not a symlink"`

## Your Task

Convert every `CLAUDE.md` in this project into a sibling `AGENTS.md` file, and
replace each `CLAUDE.md` with a thin `@AGENTS.md` reference. This includes the
root `CLAUDE.md` and any nested ones found in subdirectories.

## Steps

1. **Discover all `CLAUDE.md` files** using the context output above. For each
   directory that contains a `CLAUDE.md`, also note whether an `AGENTS.md`
   already exists in that same directory.

2. **Process each `CLAUDE.md`** by applying steps 3–8 below. Process them one at
   a time, starting with the root and then proceeding to subdirectories. Report
   progress for each file.

3. **Verify preconditions** (for the current `CLAUDE.md` being processed):
   - If `CLAUDE.md` is a symlink pointing to `AGENTS.md`, skip to step 9.
   - If `CLAUDE.md` does not exist but `AGENTS.md` does, skip to step 8.
   - If both `CLAUDE.md` and `AGENTS.md` exist in the same directory, skip this
     file — report that it was skipped and suggest using `AGENTS.md` directly or
     removing it first.
   - If `CLAUDE.md` already contains only an `@AGENTS.md` reference, skip this
     file — it was already converted.
   - Otherwise, `CLAUDE.md` exists and `AGENTS.md` does not — proceed.

4. **Read `CLAUDE.md`** content in full.

5. **Review content for references that need updating**:

   **Filename references**:
   - Headings like `# CLAUDE.md` → `# AGENTS.md`
   - Self-references like "this CLAUDE.md file" → "this AGENTS.md file"
   - Any other mentions of the filename that refer to the file itself and should
     change to reflect the new name

   **Generalize Claude-specific agent language**:
   - The title and opening paragraph often describe the file's purpose in
     Claude-specific terms (e.g., "This file provides guidance to Claude...").
     Rewrite these to be generic (e.g., "This file provides guidance to LLM
     agents...").
   - "Claude" (when referring to the AI agent performing tasks) → "LLM agents"
     or "agents"
   - "Tell Claude to..." → "Instruct agents to..."
   - "Claude should..." → "Agents should..."
   - "When Claude encounters..." → "When agents encounter..."
   - Similar phrasing that assumes a specific AI agent — rewrite to be
     agent-agnostic

   **Do NOT change**:
   - "Claude Code" — it's a proper product name (CLI tool)
   - References to Claude Code features, documentation, or capabilities (e.g.,
     `@`-references, slash commands)
   - "Claude" as part of a filename or path (e.g., `.claude/`, `CLAUDE.md`
     referring to other projects)
   - References to CLAUDE.md that refer to other projects' files or external
     concepts

6. **Write `AGENTS.md`** in the same directory as the `CLAUDE.md` being
   processed, with the updated content.

7. **Replace `CLAUDE.md`** contents with just `@AGENTS.md` — this makes Claude
   Code load `AGENTS.md` via the `@`-reference. Continue to the next file (step
   2).

8. **Create `CLAUDE.md` reference** (only reached when `CLAUDE.md` doesn't exist
   but `AGENTS.md` does in a directory):
   - Write a new `CLAUDE.md` in that directory containing just:
     ```
     @AGENTS.md
     ```
   - Report that `CLAUDE.md` was created as a reference to the existing
     `AGENTS.md`. Continue to the next file (step 2).

9. **Replace symlink with `@`-reference** (only reached when `CLAUDE.md` is a
   symlink to `AGENTS.md`):
   - Remove the `CLAUDE.md` symlink.
   - Write a new `CLAUDE.md` file containing just:
     ```
     @AGENTS.md
     ```
   - Report that the symlink was replaced with an `@`-reference to `AGENTS.md`.
     Continue to the next file (step 2).

10. **Final summary**: After all files are processed, report:
    - How many `CLAUDE.md` files were converted
    - How many were skipped (and why)
    - List each file and what action was taken
