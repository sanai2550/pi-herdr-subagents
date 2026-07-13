import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  adaptNicobailonAgent,
  parseAgentMarkdown,
} from "../scripts/lib/nicobailon-agent-adapter.mjs";
import { BUNDLED_AGENT_MODEL_OVERRIDES } from "../scripts/lib/agent-model-overrides.mjs";

test("parses Nicobailon frontmatter and body", () => {
  const parsed = parseAgentMarkdown(`---
name: scout
systemPromptMode: replace
---

You are a scout.
`);
  assert.equal(parsed.frontmatter.name, "scout");
  assert.equal(parsed.frontmatter.systemPromptMode, "replace");
  assert.equal(parsed.body, "You are a scout.");
});

test("maps Nicobailon runtime fields to Edxeth Herdr fields", () => {
  const result = adaptNicobailonAgent(`---
name: worker
description: Implements approved work
tools: read, write, contact_supervisor, intercom
thinking: high
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
defaultContext: fork
output: progress.md
---

You are a worker.
`);

  assert.match(result.markdown, /^---\nname: worker\n/);
  assert.match(result.markdown, /mode: interactive/);
  assert.match(result.markdown, /system-prompt: replace/);
  assert.match(result.markdown, /session-mode: fork/);
  assert.match(result.markdown, /trust-project: true/);
  assert.match(result.markdown, /skills: none/);
  assert.match(result.markdown, /tools: read, write, caller_ping/);
  assert.doesNotMatch(result.markdown.split("---\n\n")[0], /contact_supervisor|intercom/);
  assert.deepEqual(result.ignoredNicobailonFields, ["output"]);
});

test("preserves append semantics and defaults to isolated lineage", () => {
  const result = adaptNicobailonAgent(`---
name: delegate
systemPromptMode: append
---

Execute the delegated task.
`);
  assert.match(result.markdown, /system-prompt: append/);
  assert.match(result.markdown, /session-mode: lineage-only/);
  assert.match(result.markdown, /auto-exit: true/);
  assert.match(result.markdown, /spawning: false/);
});

test("adds explicit text and structural search tools beside grep", () => {
  const result = adaptNicobailonAgent(`---
name: scout
tools: read, grep, find
---

Map the codebase.
`);
  assert.match(result.markdown, /tools: read, grep, rg, ast_grep, find/);
});

test("applies deterministic bundled thinking overrides without pinning a model", () => {
  const result = adaptNicobailonAgent(`---
name: oracle
thinking: high
---

Protect consistency.
`, { modelOverride: BUNDLED_AGENT_MODEL_OVERRIDES.oracle });

  assert.match(result.markdown, /thinking: max/);
  assert.doesNotMatch(result.markdown, /^model:/m);
  assert.doesNotMatch(result.markdown, /^allow-model-override:/m);
});

test("adapts every pinned Nicobailon agent while preserving its original prompt", () => {
  const root = resolve(import.meta.dirname, "..");
  const sourceDir = join(root, "upstreams", "nicobailon-pi-subagents", "agents");
  const files = readdirSync(sourceDir).filter((file) => file.endsWith(".md")).sort();
  assert.equal(files.length, 8);

  for (const file of files) {
    const source = readFileSync(join(sourceDir, file), "utf8");
    const parsed = parseAgentMarkdown(source);
    const name = file.replace(/\.md$/, "");
    const adapted = adaptNicobailonAgent(source, {
      modelOverride: BUNDLED_AGENT_MODEL_OVERRIDES[name],
    });
    const adaptedBody = parseAgentMarkdown(adapted.markdown).body;
    assert.ok(
      adaptedBody.startsWith(`${parsed.body}\n\n## Herdr runtime compatibility`),
      `${file} must retain the complete Nicobailon prompt before the runtime appendix`,
    );
    assert.doesNotMatch(adapted.markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "", /intercom|contact_supervisor/);
  }
});
