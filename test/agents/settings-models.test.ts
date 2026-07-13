import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveSubagentModelSettings } from "../../src/agents/settings-models.ts";

describe("subagent model settings", () => {
	it("merges global and trusted project agent overrides", () => {
		const root = mkdtempSync(join(tmpdir(), "subagent-model-settings-"));
		const agentConfigDir = join(root, "agent");
		const cwd = join(root, "workspace");
		mkdirSync(join(cwd, ".pi"), { recursive: true });
		mkdirSync(agentConfigDir, { recursive: true });
		writeFileSync(
			join(agentConfigDir, "settings.json"),
			JSON.stringify({
				subagents: {
					defaultModel: "global-provider/default-model",
					defaultThinkingLevel: "medium",
					agentOverrides: {
						orchestrator: {
							model: "global-provider/orchestrator-model",
							thinking: "high",
						},
					},
				},
			}),
		);
		writeFileSync(
			join(cwd, ".pi", "settings.json"),
			JSON.stringify({
				subagents: {
					defaultModel: "project-provider/default-model",
					agentOverrides: {
						orchestrator: { thinking: "xhigh" },
					},
				},
			}),
		);

		assert.deepEqual(
			resolveSubagentModelSettings("orchestrator", cwd, { agentConfigDir }),
			{
				agentOverride: {
					model: "global-provider/orchestrator-model",
					thinking: "xhigh",
				},
				defaultModel: "project-provider/default-model",
				defaultThinking: "medium",
			},
		);
	});

	it("ignores project settings when the project is not trusted", () => {
		const root = mkdtempSync(join(tmpdir(), "subagent-model-settings-"));
		const agentConfigDir = join(root, "agent");
		const cwd = join(root, "workspace");
		mkdirSync(join(cwd, ".pi"), { recursive: true });
		mkdirSync(agentConfigDir, { recursive: true });
		writeFileSync(
			join(agentConfigDir, "settings.json"),
			JSON.stringify({ subagents: { defaultModel: "global-provider/default-model" } }),
		);
		writeFileSync(
			join(cwd, ".pi", "settings.json"),
			JSON.stringify({ subagents: { defaultModel: "project-provider/default-model" } }),
		);

		assert.deepEqual(
			resolveSubagentModelSettings("worker", cwd, {
				agentConfigDir,
				projectTrusted: false,
			}),
			{ defaultModel: "global-provider/default-model" },
		);
	});
});
