import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { hasOrchestratorKeyword } from "../../src/runtime/orchestrator-mode.ts";
import { subagentsExtension } from "../support/index.ts";

const ORIGINAL_SUBAGENT_NAME = process.env.PI_SUBAGENT_NAME;
const ORIGINAL_ORCHESTRATOR_MODE = process.env.PI_ORCHESTRATOR_MODE;

afterEach(() => {
	if (ORIGINAL_SUBAGENT_NAME === undefined) delete process.env.PI_SUBAGENT_NAME;
	else process.env.PI_SUBAGENT_NAME = ORIGINAL_SUBAGENT_NAME;
	if (ORIGINAL_ORCHESTRATOR_MODE === undefined) delete process.env.PI_ORCHESTRATOR_MODE;
	else process.env.PI_ORCHESTRATOR_MODE = ORIGINAL_ORCHESTRATOR_MODE;
});

function createExtensionHarness(branchEntries: any[] = []) {
	const handlers = new Map<string, any>();
	let activeTools = ["read", "bash", "edit", "subagent", "subagent_resume", "subagent_kill", "set_tab_title"];
	const allTools = activeTools.map((name) => ({ name }));
	const persistedEntries: Array<{ customType: string; data: unknown }> = [];
	const notifications: Array<{ message: string; level: string }> = [];
	const ctx = {
		cwd: process.cwd(),
		hasUI: true,
		ui: {
			notify(message: string, level: string) {
				notifications.push({ message, level });
			},
			setWidget() {},
		},
		sessionManager: {
			getBranch: () => branchEntries,
			getEntries: () => branchEntries,
			getHeader: () => ({ id: "root", type: "session", timestamp: "", cwd: process.cwd() }),
		},
	};

	subagentsExtension({
		on(event: string, handler: any) {
			handlers.set(event, handler);
		},
		getActiveTools() {
			return [...activeTools];
		},
		getAllTools() {
			return allTools;
		},
		setActiveTools(tools: string[]) {
			activeTools = [...tools];
		},
		appendEntry(customType: string, data: unknown) {
			persistedEntries.push({ customType, data });
		},
		registerCommand() {},
		registerMessageRenderer() {},
		registerTool() {},
		sendMessage() {},
	} as any);

	return {
		handlers,
		ctx,
		getActiveTools: () => activeTools,
		notifications,
		persistedEntries,
	};
}

describe("ULW main-thread orchestration mode", () => {
	it("matches only standalone ulw and ultrawork keywords", () => {
		for (const text of ["ulw finish this", "please ULW now", "run ultrawork", "ULTRAWORK: ship it", "ulw-loop"]) {
			assert.equal(hasOrchestratorKeyword(text), true, text);
		}
		for (const text of ["normal work", "bulw task", "ulwextra", "ultraword", "ultraworks"]) {
			assert.equal(hasOrchestratorKeyword(text), false, text);
		}
	});

	it("ignores keywords in code, slash commands, and internal directives", () => {
		for (const text of [
			"Document `ulw` for users",
			"Example:\n```text\nultrawork implement this\n```",
			"Example:\n~~~text\nulw implement this\n~~~",
			"/skill:docs explain ulw",
			"<system-reminder>ulw continue the loop</system-reminder>",
			"[system] ulw continuation",
			"[system_message] ultrawork continuation",
		]) {
			assert.equal(hasOrchestratorKeyword(text), false, text);
		}
		assert.equal(hasOrchestratorKeyword("Document `ulw`, then ultrawork ship it"), true);
	});

	it("activates orchestration on the main session and restores normal tools on the next normal prompt", () => {
		delete process.env.PI_SUBAGENT_NAME;
		delete process.env.PI_ORCHESTRATOR_MODE;
		const harness = createExtensionHarness();

		harness.handlers.get("input")(
			{ text: "ulw implement this", source: "interactive" },
			harness.ctx,
		);
		assert.deepEqual(harness.getActiveTools(), ["subagent", "subagent_resume", "subagent_kill", "set_tab_title"]);
		assert.deepEqual(harness.notifications, [{
			message: "ULTRAWORK MODE ENABLED — delegating through specialist subagents.",
			level: "info",
		}]);
		assert.deepEqual(harness.persistedEntries.at(-1)?.data, { version: 1, enabled: true });

		const activated = harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "ulw implement this",
			systemPrompt: "normal system prompt\n\nlocal append",
			systemPromptOptions: { appendSystemPrompt: "local append" },
		});
		assert.match(activated.systemPrompt, /^normal system prompt\n\nlocal append/);
		assert.match(activated.systemPrompt, /<ultrawork-mode>/);
		assert.match(activated.systemPrompt, /observable success criteria/);
		assert.match(activated.systemPrompt, /\*\*Discovery\*\*/);
		assert.match(activated.systemPrompt, /\*\*Synthesis\*\*/);
		assert.match(activated.systemPrompt, /\*\*Implementation\*\*/);
		assert.match(activated.systemPrompt, /\*\*Review\*\*/);
		assert.match(activated.systemPrompt, /Continue versus start fresh/);
		assert.match(activated.systemPrompt, /Use \*\*subagent_resume\*\*/);
		assert.match(activated.systemPrompt, /fresh \*\*subagent\*\*/);
		assert.match(activated.systemPrompt, /Every delegated result must state/);
		assert.match(activated.systemPrompt, /exact remaining work/);
		assert.match(activated.systemPrompt, /WHEN TO STOP/);
		assert.match(activated.systemPrompt, /verification evidence/);

		const resultTurn = harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "subagent result",
			systemPrompt: "normal system prompt",
		});
		assert.match(resultTurn.systemPrompt, /^normal system prompt/);
		assert.match(resultTurn.systemPrompt, /<ultrawork-mode>/);

		harness.handlers.get("input")(
			{ text: "answer normally", source: "interactive" },
			harness.ctx,
		);
		assert.deepEqual(harness.getActiveTools(), ["read", "bash", "edit", "subagent", "subagent_resume", "subagent_kill", "set_tab_title"]);
		assert.deepEqual(harness.persistedEntries.at(-1)?.data, { version: 1, enabled: false });
		assert.equal(harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "answer normally",
			systemPrompt: "normal system prompt",
		}), undefined);
	});

	it("defers follow-up mode changes and ignores steering mode changes", () => {
		delete process.env.PI_SUBAGENT_NAME;
		delete process.env.PI_ORCHESTRATOR_MODE;
		const harness = createExtensionHarness();

		harness.handlers.get("input")(
			{ text: "ulw interrupt this", source: "interactive", streamingBehavior: "steer" },
			harness.ctx,
		);
		assert.equal(harness.persistedEntries.length, 0);
		assert.equal(harness.notifications.length, 0);
		assert.equal(harness.getActiveTools().includes("read"), true);

		harness.handlers.get("input")(
			{ text: "ulw do this next", source: "interactive", streamingBehavior: "followUp" },
			harness.ctx,
		);
		assert.equal(harness.getActiveTools().includes("read"), true);
		assert.equal(harness.persistedEntries.length, 0);
		assert.equal(harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "asynchronous subagent result",
			systemPrompt: "base prompt",
			systemPromptOptions: {},
		}, harness.ctx), undefined);
		assert.equal(harness.getActiveTools().includes("read"), true);

		const followUp = harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "ulw do this next",
			systemPrompt: "base prompt",
			systemPromptOptions: {},
		}, harness.ctx);
		assert.deepEqual(harness.getActiveTools(), ["subagent", "subagent_resume", "subagent_kill", "set_tab_title"]);
		assert.match(followUp.systemPrompt, /^base prompt/);
		assert.match(followUp.systemPrompt, /<ultrawork-mode>/);
		assert.deepEqual(harness.persistedEntries.at(-1)?.data, { version: 1, enabled: true });

		harness.handlers.get("input")(
			{ text: "normal queued prompt", source: "interactive", streamingBehavior: "followUp" },
			harness.ctx,
		);
		assert.equal(harness.getActiveTools().includes("read"), false);
		assert.equal(harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "normal queued prompt",
			systemPrompt: "base prompt",
			systemPromptOptions: {},
		}, harness.ctx), undefined);
		assert.equal(harness.getActiveTools().includes("read"), true);
	});

	it("restores keyword mode from the current session branch without duplicating state", () => {
		delete process.env.PI_SUBAGENT_NAME;
		delete process.env.PI_ORCHESTRATOR_MODE;
		const harness = createExtensionHarness([
			{ type: "custom", customType: "pi-subagents-herdr:ulw-state", data: { version: 1, enabled: true } },
		]);

		harness.handlers.get("session_start")(
			{ type: "session_start", reason: "resume" },
			harness.ctx,
		);
		assert.deepEqual(harness.getActiveTools(), ["subagent", "subagent_resume", "subagent_kill", "set_tab_title"]);
		assert.equal(harness.persistedEntries.length, 0);
		assert.equal(harness.notifications.length, 0);
		const result = harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "continue restored task",
			systemPrompt: "restored base",
			systemPromptOptions: {},
		}, harness.ctx);
		assert.match(result.systemPrompt, /^restored base/);
		assert.match(result.systemPrompt, /<ultrawork-mode>/);
	});

	it("does not activate keyword mode inside a child agent session", () => {
		process.env.PI_SUBAGENT_NAME = "auth-scout";
		delete process.env.PI_ORCHESTRATOR_MODE;
		const harness = createExtensionHarness();

		harness.handlers.get("input")(
			{ text: "ulw inspect this", source: "interactive" },
			harness.ctx,
		);
		assert.deepEqual(harness.getActiveTools(), ["read", "bash", "edit", "subagent", "subagent_resume", "subagent_kill", "set_tab_title"]);
		assert.equal(harness.handlers.get("before_agent_start")({
			type: "before_agent_start",
			prompt: "ulw inspect this",
			systemPrompt: "child system prompt",
		}), undefined);
	});
});
