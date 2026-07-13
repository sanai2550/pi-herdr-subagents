# Add code search tools

## Goal
Expose fast text search and AST-aware structural search directly to bundled subagents.

## Tasks
- [x] Register `rg` as a ripgrep-backed alias of Pi's built-in `grep` tool. → Verify: focused tool registration test passes.
- [x] Register a read-only `ast_grep` tool backed by the packaged `@ast-grep/cli` binary. → Verify: structural search finds code but ignores matching comments/strings.
- [x] Add both tools to agent allowlists and explain when each should be used. → Verify: agent sync check passes.
- [x] Cover deny/allowlist behavior without changing existing `grep` compatibility. → Verify: launch and tool policy tests pass.
- [x] Run project verification. → Verify: focused tests, typecheck, sync check, and package dry-run pass; the full suite has one unrelated macOS `/private/var` path assertion failure.

## Done When
- [x] Bundled subagents can call `rg` and `ast_grep` directly, while existing `grep` configurations continue to work.

## Notes
Pi's existing `grep` already runs ripgrep internally; `rg` is an explicit alias for clearer agent tool selection. `ast_grep` is search-only and does not expose rewrite flags.
