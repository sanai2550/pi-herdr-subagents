# ULW Main-Thread Orchestration

## Goal
Activate delegation-only orchestration in the main Pi session only when a user prompt contains the standalone keyword `ulw` or `ultrawork`.

## Tasks
- [x] Add a tested standalone-keyword detector and main-session mode state. → Verify normal text and partial-word matches stay inactive.
- [x] Switch the main session's tools and system prompt when triggered, then restore normal tools on the next non-triggering user prompt. → Verify consecutive turns and subagent result turns preserve the intended mode.
- [x] Force child launches to clear `PI_ORCHESTRATOR_MODE`. → Verify both interactive/background child environments are non-orchestrator.
- [x] Document `ulw`/`ultrawork` usage and environment-mode compatibility. → Verify README examples match runtime behavior.
- [x] Run focused tests, the full test suite, and typecheck. → Focused tests, typecheck, and sync check pass; the full suite has one unrelated macOS `/var` versus `/private/var` assertion failure.
- [x] Preserve Pi's existing system prompt by injecting a concise ULW directive instead of replacing it. → Verified existing system instructions remain present on triggered turns.
- [x] Harden keyword detection against fenced/inline code and slash/system commands. → Verified mentions used only as examples do not activate ULW.
- [x] Make activation streaming-safe and session-aware across reload/resume where supported. → Verified `steer` cannot change the active turn, queued `followUp` changes apply at the next turn, and custom session state restores on resume.
- [x] Add visible activation feedback and explicit success/verification/stop rules. → Verified the notification and prompt contract in focused tests.
- [x] Run focused tests, typecheck, and the full relevant suite; record any unrelated failures. → Focused tests, typecheck, sync check, and 446/447 executed full-suite tests pass; the existing macOS `/var` versus `/private/var` path assertion remains the only failure.
- [x] Add a compact discovery → synthesis → implementation → review workflow to the ULW directive. → Verified the injected prompt names every phase without adding OMO-only tools.
- [x] Define when to resume a specialist versus spawn a fresh one. → Verified the prompt covers context continuity, correction, and independent review.
- [x] Require every delegated result to report evidence and remaining work. → Verified focused tests assert the result contract and stop condition together.

## Done When
- [x] Ordinary prompts use the normal main agent; `ulw`/`ultrawork` prompts use main-thread orchestration without spawning an orchestrator persona.
- [x] Specialist children never inherit main-thread orchestration mode.
- [x] ULW activation preserves base instructions, avoids false positives, and has observable completion rules.
- [x] ULW provides enough orchestration structure to coordinate multi-phase work without copying OMO's tool-specific prompt.
