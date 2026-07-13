# Settings-based subagent model priority

## Goal
Make `settings.json` the authoritative place for per-agent and default subagent model selection while preserving portable bundled agent definitions.

## Tasks
- [x] Define and parse the supported `subagents.agentOverrides` and `subagents.defaultModel` settings → Verify with focused parser tests.
- [x] Feed settings defaults into child launch planning with explicit precedence → Verify per-agent override, shared default, agent-file fallback, and parent fallback.
- [x] Preserve call-time override policy without allowing it to bypass an explicit settings agent override → Verify both allowed and denied override cases.
- [x] Update documentation for the effective precedence and examples → Verify no personal provider names are introduced.
- [x] Regenerate/check agent definitions and run typecheck plus model-related tests.

## Done When
- [x] A newly spawned named agent uses its settings agent override first and the settings default after launch/definition fallbacks.
- [x] Resume behavior remains session-metadata based and all focused tests pass.
