---
mode: agent
description: Keep the README in sync with the current state of the codebase
---

# Update README

Read the current [README.md](../../README.md) and cross-reference it against the live codebase, then produce an updated README that reflects reality. Do not change the project's tone or structure unless instructed.

## What to check and update

### CLI Commands table
- Read `src/cli/prompt.ts` — every `case` in the `switch (cmd)` block is a command.
- The README's **CLI Commands** section must list all commands with accurate usage syntax.
- Include the live-feed behaviour note if `watch` is present.

### Project Structure tree
- Reflect the actual files in `src/kite/`, `src/db/`, `src/cli/`, and root.
- Each file should have an accurate one-line comment.
- Include any `.github/` entries that are meaningful to contributors.

### Architecture & Stack
- If new dependencies were added to `package.json`, add them to the Stack table or note them in Architecture.
- If the DB schema changed (`src/db/migrate.ts`), update any schema references.

### Session Flow
- If the startup sequence in `index.ts` or `src/cli/prompt.ts` changed (e.g. new prompts, new startup checks), update the Session Flow example.

### Local vs Cloud table
- Update only if deployment process or env vars changed.

## Rules
- Keep all existing sections. Never delete a section; only update its content.
- Preserve all code block examples — update them if the actual output changed, keep them if not.
- Do not add new sections unless a significant new subsystem was introduced (e.g. WebSocket feed, backtesting, scheduler).
- Always end by running a diff review: re-read the updated README and confirm every statement is accurate.
