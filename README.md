# pi-subagents-herdr

A standalone Pi package that combines:

- the subagent runtime, session lifecycle, resume/kill support, and Herdr backend from `edxeth/pi-subagents`;
- eight personas/system prompts from `nicobailon/pi-subagents`: `scout`, `worker`, `reviewer`, `planner`, `oracle`, `researcher`, `context-builder`, and `delegate`.

The package does not require separate installations of `edxeth/pi-subagents` or `nicobailon/pi-subagents`. The runtime lives in `src/`, while the agent pack is bundled in `agents/` and loaded automatically when the extension starts.

## Installation

For local development:

```bash
pi install ./local/path/to/pi-herdr-subagents
```

After pushing your repository to GitHub:

```bash
pi install git:github.com/sanai2550/pi-herdr-subagents
```

After publishing to npm:

```bash
pi install npm:pi-subagents-herdr
```

Use only **one** of these commands. Do not install either upstream package alongside this one because both register the `subagent` tool and may cause a collision.

## Bundled models

This package pins a model for each persona and requires the `cliproxy` provider to expose `cli/gpt-5.6-sol`, `cli/gpt-5.6-terra`, and `cli/gpt-5.6-luna`:

| Agent | Model | Thinking |
| --- | --- | --- |
| `context-builder` | `cliproxy/cli/gpt-5.6-sol` | `medium` |
| `delegate` | `cliproxy/cli/gpt-5.6-sol` | inherits from parent |
| `oracle` | `cliproxy/cli/gpt-5.6-sol` | `max` |
| `planner` | `cliproxy/cli/gpt-5.6-sol` | `xhigh` |
| `researcher` | `cliproxy/cli/gpt-5.6-terra` | `medium` |
| `reviewer` | `cliproxy/cli/gpt-5.6-sol` | `high` |
| `scout` | `cliproxy/cli/gpt-5.6-luna` | `low` |
| `worker` | `cliproxy/cli/gpt-5.6-sol` | `medium` |

These defaults use `allow-model-override: false`, so launch-time model overrides are ignored. If another machine does not provide the required provider or models, override the complete agent definitions in `~/.pi/agent/agents` or `<project>/.pi/agents`.

## Running in Herdr

Start `pi` from a Herdr-managed pane. You can force the runtime to use Herdr:

```bash
export PI_SUBAGENT_MUX=herdr
pi
```

Then request agents naturally:

```text
Use scout to map the authentication flow.
Use worker to implement the approved plan, then use reviewer to inspect the diff.
```

The built-in agents use `mode: interactive`. The runtime creates a new Herdr tab in the same workspace without taking focus. `auto-exit: true` closes the child after completion and returns its result to the parent.

To place interactive subagents in non-focused split panes of the parent's current tab instead, set:

```bash
export PI_SUBAGENT_HERDR_PLACEMENT=split
pi
```

Split placement opens each child to the right of the parent pane. Leave the variable unset, or set it to `tab`, to keep the default one-tab-per-subagent layout. Background-mode agents do not use Herdr placement.

For a readable adaptive layout, use `auto` placement:

```bash
export PI_SUBAGENT_HERDR_PLACEMENT=auto
export PI_SUBAGENT_HERDR_MAX_SPLITS=2
export PI_SUBAGENT_HERDR_MIN_COLUMNS=50
pi
```

`auto` opens the first child to the right, stacks the next child below it, and sends further children to new tabs. It also falls back to a tab when splitting would leave fewer than `PI_SUBAGENT_HERDR_MIN_COLUMNS` columns. The defaults are two active split children and 50 columns; closed child panes free their split slots. Set `PI_SUBAGENT_HERDR_MAX_SPLITS=0` to make `auto` always use tabs. These two limits apply only to `auto`; explicit `split` placement keeps opening right splits.

## Built-ins and overrides

Agent definition precedence is:

```text
builtin Nicobailon < ~/.pi/agent/agents < <project>/.pi/agents
```

You can override `worker` or any other agent with a global or project file of the same name without modifying the package.

## Development and publishing

```bash
npm install
npm run typecheck
npm test
npm run check
npm pack --dry-run
```

The current npm package name is `pi-subagents-herdr`. Before publishing, you can change it to your scope, for example `@your-scope/pi-subagents-herdr`, then run:

```bash
npm publish --access public
```

`npm run check` verifies that the eight bundled agents match the Nicobailon commit pinned in `sources.lock.json`. The checkouts used for updates live in `upstreams/` and are not included in the package.

To update the prompts:

1. Check out the new commit in `upstreams/nicobailon-pi-subagents`.
2. Review the frontmatter and prompt changes.
3. Update the commit in `sources.lock.json`.
4. Run `npm run sync && npm run typecheck && npm test && npm run check`.

## Agent mapping

| Nicobailon | Bundled runtime | Reason |
| --- | --- | --- |
| `systemPromptMode` | `system-prompt` | The body is passed unchanged as the system prompt |
| `defaultContext: fork` | `session-mode: fork` | Preserves the transcript for planner/worker/oracle |
| default context | `session-mode: lineage-only` | Preserves lineage while giving the child model a clean start |
| `inheritProjectContext` | `trust-project` + `no-context-files` | Maps the project-context boundary |
| `inheritSkills: false` | `skills: none` | Prevents skills outside the persona from loading automatically |
| `intercom`, `contact_supervisor` | `caller_ping` | Uses the Herdr runtime's child protocol |
| child exits itself | `auto-exit: true` | Cleans up the tab and returns the result automatically |

Fields such as `output`, `defaultReads`, and `defaultProgress` do not yet have equivalent semantics. The original prompt remains intact before a short compatibility appendix for the Herdr runtime.

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for technical details and attribution.
