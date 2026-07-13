# Herdr Pane Labels

## Goal

Show each split or auto-placed subagent's machine handle in the Herdr pane/sidebar label while preserving descriptive new-tab titles.

## Tasks

- [x] Add a typed `pane rename` adapter in `src/mux/herdr.ts` → Verify it targets the returned pane ID with the supplied label.
- [x] Rename panes after explicit split, auto split, and generic split creation → Verify runtime launches use the machine handle while new-tab placement keeps descriptive titles.
- [x] Extend fake-Herdr tests for labels and rename failures → Verify command logs and error propagation.
- [x] Run typecheck, focused Herdr tests, sync checks, and the broader suite → Verify changed behavior passes and record unrelated failures separately.

## Done When

- [x] Split-pane sidebar entries show labels such as `amc-access-planner` instead of the project directory name.
