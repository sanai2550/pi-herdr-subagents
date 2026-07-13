# Architecture: bundled Nicobailon personas on the Edxeth Herdr runtime

## Decision

This repository is a standalone Pi package. It forks the Edxeth runtime into `src/` and bundles converted agent definitions in `agents/`.

```text
development/update time
upstreams/nicobailon-pi-subagents/agents/*.md
                    |
                    v
        scripts/sync-agents.mjs
     camelCase -> kebab-case + tool bridge
                    |
                    v
             package agents/*.md

installed runtime
Pi -> src/index.ts -> bundled agent discovery
                      builtin < global < project
                                |
                                v
 Herdr tab -> child Pi -> session JSONL/sidecar -> parent result
```

The upstream checkouts and sync adapter are developer tooling only. They are not included in the npm tarball and do not need to exist on the installer's machine.

## Why only one runtime is forked

1. Both upstream packages are named `pi-subagents` and register the public `subagent` tool.
2. Nicobailon was developed against Pi 0.74.x, while Edxeth requires Pi >=0.79. Importing both runtimes creates API and version conflicts.
3. Nicobailon's foreground runtime relies on `pi --mode json -p` and stdout JSONL. Porting that transport to Herdr pane IDs would require rewriting streaming, timeout, fallback, and lifecycle handling.
4. Edxeth already provides a complete Herdr backend: it detects the current pane, creates a tab without taking focus, sends commands, monitors the child session and exit sidecar, routes the result, and cleans up.

Therefore, the Edxeth runtime source is forked directly, while the Nicobailon personas/system prompts become a built-in data provider.

## Built-in discovery contract

`src/agents/definitions.ts` reads definitions in this order:

1. package `agents/` with source `builtin`;
2. `$PI_CODING_AGENT_DIR/agents` with source `global`;
3. `<cwd>/.pi/agents` with source `project`.

Later definitions override earlier definitions with the same `name`. This makes the package work immediately after installation while preserving the user's ability to override individual personas.

Each built-in definition includes:

- the Nicobailon body at the beginning of the system prompt;
- an explicit `system-prompt: replace|append`;
- `mode: interactive` and `auto-exit: true`;
- `async: true` and `spawning: false`;
- mapped project context, skills, and session mode settings;
- `caller_ping` in place of the two supervisor tools available only in the Nicobailon runtime.

By default, Edxeth creates a new Herdr **tab** in the parent workspace. Supporting a split pane would be a placement-strategy change in `src/mux/`, not an agent-adapter change.

## Package boundary

The published tarball contains only:

- `src/**/*.ts` — the extension/runtime, including exported test helpers retained for compatibility with the forked runtime's public API;
- `agents/**/*.md` — built-in personas;
- the README, architecture document, license, and third-party notices.

`upstreams/`, tests, sync scripts, and local dependencies are excluded by the `files` allowlist in `package.json`.

## Limitations

- `caller_ping` performs a ping-and-exit followed by a parent resume; it is not a live request/reply channel like Nicobailon's native supervisor channel.
- `output`, `defaultReads`, and `defaultProgress` are not automated.
- Nicobailon's chains, worktrees, acceptance gates, watchdog, memory, and budgets have not been ported; the Edxeth runtime retains its own capabilities.
- Interactive Herdr requires a parent Pi UI running inside Herdr. Headless `pi -p` uses the runtime's background policy.
- The Codex session used to build this package did not have `HERDR_ENV=1`, so the live Herdr smoke test must run from an actual Herdr pane.

## Verification

1. The adapter test preserves the original prompt before the compatibility appendix.
2. The built-in discovery test verifies all eight personas and override precedence.
3. TypeScript typechecking verifies that the fork builds against the Pi peer APIs.
4. The full runtime test suite covers the fake-Herdr multiplexer and interactive-launch parity.
5. `npm pack --dry-run` verifies that the tarball contains the runtime and agents but excludes upstream checkouts.
6. A live Herdr smoke test is the final gate when running inside a Herdr session.
