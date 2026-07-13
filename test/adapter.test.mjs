import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  adaptNicobailonAgent,
  parseAgentMarkdown,
} from "../scripts/lib/nicobailon-agent-adapter.mjs";

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

test("adapts every pinned Nicobailon agent while preserving its original prompt", () => {
  const root = resolve(import.meta.dirname, "..");
  const sourceDir = join(root, "upstreams", "nicobailon-pi-subagents", "agents");
  const files = readdirSync(sourceDir).filter((file) => file.endsWith(".md")).sort();
  assert.equal(files.length, 8);

  for (const file of files) {
    const source = readFileSync(join(sourceDir, file), "utf8");
    const parsed = parseAgentMarkdown(source);
    const adapted = adaptNicobailonAgent(source);
    const adaptedBody = parseAgentMarkdown(adapted.markdown).body;
    assert.ok(
      adaptedBody.startsWith(`${parsed.body}\n\n## Herdr runtime compatibility`),
      `${file} must retain the complete Nicobailon prompt before the runtime appendix`,
    );
    assert.doesNotMatch(adapted.markdown.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "", /intercom|contact_supervisor/);
  }
});
