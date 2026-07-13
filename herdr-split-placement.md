# Herdr Split Placement

## Goal

Allow interactive Herdr subagents to open as split panes in the parent tab while preserving new-tab placement by default.

## Tasks

- [x] Add `PI_SUBAGENT_HERDR_PLACEMENT=split` routing in `src/mux/herdr-surfaces.ts` → Verify default still calls `tab create`, while split calls `pane split` from the current pane.
- [x] Add focused Herdr mux tests for default, explicit `tab`, and `split` values → Verify command logs and returned pane IDs.
- [x] Document the environment variable in `README.md` and architecture notes → Verify examples state that `tab` remains the default.
- [x] Run TypeScript and automated tests → Verify typecheck, focused Herdr tests, and agent sync checks exit successfully; record the unrelated macOS `/private/var` full-suite assertion separately.

## Done When

- [x] Setting `PI_SUBAGENT_HERDR_PLACEMENT=split` launches each interactive child in a non-focused split pane of the parent tab.
- [x] Unset or non-`split` placement preserves the existing new-tab behavior.
