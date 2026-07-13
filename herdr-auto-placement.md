# Herdr Auto Placement

## Goal

Add adaptive Herdr placement that keeps interactive subagent panes readable and falls back to tabs when split limits or width limits are reached.

## Tasks

- [x] Define `auto`, maximum split count, and minimum-column configuration semantics → Verify defaults are `2` splits and `50` columns while `tab` and `split` remain compatible.
- [x] Track live auto-created panes per parent and choose right-then-down splits → Verify closed panes are pruned and overflow creates tabs.
- [x] Add focused tests for configuration parsing, layout targeting, width fallback, split limits, and legacy modes → Verify fake Herdr command logs.
- [x] Document all three environment variables → Verify README examples and architecture behavior agree.
- [x] Run typecheck, Herdr tests, sync checks, and the broader suite → Verify changed behavior passes and record unrelated failures separately.

## Done When

- [x] `PI_SUBAGENT_HERDR_PLACEMENT=auto` produces readable right-then-down layouts when space permits.
- [x] `PI_SUBAGENT_HERDR_MAX_SPLITS` and `PI_SUBAGENT_HERDR_MIN_COLUMNS` control safe fallback to tabs.
