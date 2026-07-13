import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AgentDefaults } from "./agents/definitions.ts";
import type { AgentListEntry } from "./agents/agent-list.ts";
import {
	getAgentListEntries as getAgentListEntriesFromDefinitions,
	getAgentListSignature,
	renderAgentListReminder,
} from "./agents/agent-list.ts";
import {
	loadAgentDefaults as loadAgentDefaultsFromDefinitions,
} from "./agents/definitions.ts";
import { getNoSessionSeedMode } from "./launch/seed-child-session.ts";
import {
	getSubagentAgentOverrideError,
	getSubagentAgentRequirementError,
	resolveSubagentBlocking,
	resolveSubagentNoSession,
} from "./launch/policy.ts";
import { resolveSubagentCwd } from "./launch/runtime-paths.ts";
export { resolveSubagentConfigDir } from "./launch/runtime-paths.ts";
export { buildSkillLaunchPlan as buildSkillLaunchPlanForTest } from "./launch/skills.ts";
import {
	resolveEffectiveSessionMode as resolveEffectiveSessionModeFromSessionFiles,
	resolveTaskSessionMode as resolveTaskSessionModeFromSessionFiles,
	type SubagentSessionMode,
} from "./session/session-files.ts";
import { isMuxAvailable, muxSetupHint } from "./mux.ts";
import type { SubagentParamsInput } from "./types.ts";
import {
	formatElapsed,
	getLaunchedSubagentResult,
	getShellReadyDelayMs,
	waitForInteractivePrompt,
	getWatcherSignal,
	launchBackgroundSubagent,
	launchSubagent,
	moduleAbortController,
	runningSubagents,
	shutdownSubagentsForParentExit,
	startWidgetRefresh,
	stopRunningSubagent,
	watchBackgroundSubagent,
	watchSubagent,
	widgetManager,
	wireSubagentSteerBack,
} from "./runtime/wiring.ts";
export { getShellReadyDelayMs } from "./runtime/wiring.ts";
export {
	getCompletedSubagentResultForTest,
	getLaunchedSubagentResultForTest,
	getPiInvocationForTest,
	getPiShellPartsForTest,
	getStartedSubagentDetailsForTest,
	getSubagentChildProcessEnvForTest,
	renderSubagentWidgetForTest,
	resetSubagentStateForTest,
	routeDetachedSubagentCompletionForTest,
	setRunningSubagentForTest,
	shutdownSubagentsForTest,
	waitForSubagentForTest,
} from "./runtime/wiring.ts";
import {
	markSubagentBatchBlocking,
	requestSubagentBatchStop,
	resetSubagentBatchStopRequest,
	stopAfterCurrentSubagentBatch,
} from "./runtime/state.ts";
import { classifyAssistantMessageForMixedBatch } from "./runtime/batch-classifier.ts";
import { hasOrchestratorKeyword } from "./runtime/orchestrator-mode.ts";
import { ORCHESTRATOR_ALLOWED_TOOL_NAMES, SUBAGENT_TOOL_NAME } from "./tools/tool-names.ts";
import { registerSubagentCommands } from "./tools/commands.ts";
import { registerSubagentMessageRenderers } from "./tools/message-renderers.ts";
import { registerSubagentResumeTool } from "./tools/resume-tool.ts";
import { markInitialPromptLaunchComplete, registerSubagentCoreTools } from "./tools/subagent-tools.ts";
import { traceSubagentLaunch } from "./launch/trace.ts";
import { registerSubagentsView } from "./tools/subagents-view.ts";

export { markSubagentBatchBlocking as markSubagentBatchBlockingForTest } from "./runtime/state.ts";
export { requestSubagentBatchStop as requestSubagentBatchStopForTest } from "./runtime/state.ts";
export { getSubagentBatchStopMetadata as getSubagentBatchStopMetadataForTest } from "./runtime/state.ts";
export { shouldAwaitSubagentLaunch as shouldAwaitSubagentLaunchForTest } from "./runtime/running-registry.ts";
export { classifyAssistantMessageForMixedBatch as classifyAssistantMessageForMixedBatchForTest } from "./runtime/batch-classifier.ts";
export * from "./testing/test-helpers.ts";

export function loadAgentDefaults(
	agentName: string,
	cwdHint?: string | null,
	baseCwd = process.cwd(),
): AgentDefaults | null {
	return loadAgentDefaultsFromDefinitions(
		agentName,
		cwdHint,
		baseCwd,
		resolveSubagentCwd,
	);
}

function getAgentListEntries(
	baseCwd = process.cwd(),
): AgentListEntry[] {
	return getAgentListEntriesFromDefinitions(baseCwd, resolveTaskSessionMode);
}

function resolveEffectiveSessionMode(
	params: Partial<SubagentParamsInput>,
	agentDefs: AgentDefaults | null,
): SubagentSessionMode {
	return resolveEffectiveSessionModeFromSessionFiles(params, agentDefs);
}

function resolveTaskSessionMode(
	agentDefs: AgentDefaults | null,
): SubagentSessionMode {
	return resolveTaskSessionModeFromSessionFiles(
		agentDefs,
		resolveSubagentNoSession,
		getNoSessionSeedMode,
	);
}

let lastAmbientRosterSignature: string | null = null;
let pendingAmbientRoster: {
	signature: string;
	content: string;
	entries: AgentListEntry[];
	supersedes?: true;
} | null = null;

function muxUnavailableResult(kind: "subagents" | "tab-title" = "subagents") {
	const text = kind === "tab-title"
		? `Terminal multiplexer not available. ${muxSetupHint()}`
		: `Subagents require a supported terminal multiplexer. ${muxSetupHint()}`;
	return {
		content: [{ type: "text" as const, text }],
		details: { error: "mux not available" },
	};
}

export default function subagentsExtension(pi: ExtensionAPI) {
	function attachWidgetContext(ctx: ExtensionContext) {
		widgetManager.attachContext(ctx);
	}

	function applySubagentLineage(ctx: ExtensionContext) {
		const parentSession = process.env.PI_SUBAGENT_PARENT_SESSION?.trim();
		if (!parentSession) return;
		const header = ctx.sessionManager.getHeader?.();
		if (!header || header.parentSession) return;
		header.parentSession = parentSession;
	}

	// Orchestrator mode constants (defined before use in session_start/before_agent_start)
	const ENV_ORCHESTRATOR_MODE = process.env.PI_ORCHESTRATOR_MODE === "1";
	const IS_SUBAGENT_SESSION = !!process.env.PI_SUBAGENT_NAME?.trim();
	const ORCHESTRATOR_ALLOWED_TOOLS = ORCHESTRATOR_ALLOWED_TOOL_NAMES;
	const ORCHESTRATOR_STATE_ENTRY = "pi-subagents-herdr:ulw-state";
	let keywordOrchestratorMode = false;
	let pendingFollowUpOrchestratorModes: Array<{
		text: string;
		enabled: boolean;
	}> = [];
	let normalActiveTools: string[] | undefined;
	let latestContext: ExtensionContext | undefined;

	function isOrchestratorMode(): boolean {
		return ENV_ORCHESTRATOR_MODE || keywordOrchestratorMode;
	}

	function setKeywordOrchestratorMode(
		enabled: boolean,
		options: {
			ctx?: ExtensionContext;
			persist?: boolean;
			notify?: boolean;
		} = {},
	) {
		if (ENV_ORCHESTRATOR_MODE || IS_SUBAGENT_SESSION) return;
		if (enabled === keywordOrchestratorMode) return;

		if (enabled) {
			normalActiveTools = pi.getActiveTools();
			const allowed = pi.getAllTools()
				.map((tool: { name: string }) => tool.name)
				.filter((name: string) => ORCHESTRATOR_ALLOWED_TOOLS.has(name));
			pi.setActiveTools(allowed);
		} else if (normalActiveTools) {
			pi.setActiveTools(normalActiveTools);
			normalActiveTools = undefined;
		}

		keywordOrchestratorMode = enabled;
		if (options.persist !== false) {
			pi.appendEntry(ORCHESTRATOR_STATE_ENTRY, { version: 1, enabled });
		}
		if (enabled && options.notify !== false) {
			options.ctx?.ui?.notify?.(
				"ULTRAWORK MODE ENABLED — delegating through specialist subagents.",
				"info",
			);
		}
	}

	function restoreKeywordOrchestratorMode(ctx: ExtensionContext) {
		if (ENV_ORCHESTRATOR_MODE || IS_SUBAGENT_SESSION) return;
		const entries = ctx.sessionManager.getBranch?.()
			?? ctx.sessionManager.getEntries?.()
			?? [];
		let restored = false;
		for (const entry of entries) {
			if (entry.type !== "custom" || entry.customType !== ORCHESTRATOR_STATE_ENTRY) continue;
			const data = entry.data as { enabled?: unknown } | undefined;
			if (typeof data?.enabled === "boolean") restored = data.enabled;
		}
		setKeywordOrchestratorMode(restored, {
			ctx,
			persist: false,
			notify: false,
		});
	}

	// Capture the UI context early so the widget keeps a stable slot above tasks.
	pi.on("session_start", (event, ctx) => {
		latestContext = ctx;
		resetSubagentBatchStopRequest();
		applySubagentLineage(ctx);
		attachWidgetContext(ctx);
		pendingFollowUpOrchestratorModes = [];
		restoreKeywordOrchestratorMode(ctx);

		// Restrict active tools in orchestrator mode
		if (ENV_ORCHESTRATOR_MODE) {
			const allTools = pi.getAllTools().map((t: { name: string }) => t.name);
			const allowed = allTools.filter((t: string) =>
				ORCHESTRATOR_ALLOWED_TOOLS.has(t),
			);
			pi.setActiveTools(allowed);
		}

		if (!shouldRegister(SUBAGENT_TOOL_NAME)) return;

		// Reset the cached signature on every fresh session so module-level state
		// does not leak between sessions. The reload path still uses the cached
		// signature to avoid duplicating the notification within the same session.
		if (event.reason !== "reload") {
			lastAmbientRosterSignature = null;
		}

		const entries = getAgentListEntries(ctx.cwd);
		const signature = getAgentListSignature(entries);
		if (entries.length === 0) {
			if (event.reason === "reload") pendingAmbientRoster = null;
			lastAmbientRosterSignature = null;
			return;
		}

		if (signature === lastAmbientRosterSignature) {
			pendingAmbientRoster = null;
			return;
		}

		pendingAmbientRoster = {
			signature,
			content: renderAgentListReminder(entries),
			entries,
			supersedes: event.reason === "reload" ? true : undefined,
		};
	});

	const ORCHESTRATOR_DIRECTIVE = `<ultrawork-mode>
You are the main-thread ULW orchestrator for this task. Coordinate specialist subagents; do not inspect files, run shell commands, edit code, or implement the solution yourself.

Use only the orchestration tools available to you:

- **subagent** spawns one or more specialists. Each task must be self-contained with the objective, relevant paths and evidence, constraints, expected output, and verification.
- **subagent_resume** continues a specialist when its existing context materially helps.
- **subagent_kill** stops work that is obsolete or stuck.

Subagent results arrive as blocking tool output or later messages, depending on launch mode. Never fabricate results that have not arrived.

Execution contract:

1. Define observable success criteria and an explicit WHEN TO STOP before delegation.
2. Parallelize independent work, but keep fan-out bounded and synthesize results before assigning dependent work.
3. Require implementation agents to run relevant checks and report concrete evidence; use a fresh reviewer when risk warrants it.
4. Continue or correct failed work only while new evidence is being produced. After two materially identical failures, stop and ask the user for the missing decision or access.
5. WHEN TO STOP: stop as soon as the user's requested outcome is observably satisfied, verification evidence is available, no required work remains, and any started subagents are completed or stopped. Do not invent extra scope.
</ultrawork-mode>`;

	pi.on("before_agent_start", (event, ctx) => {
		const pendingFollowUp = pendingFollowUpOrchestratorModes[0];
		// Extension-triggered turns (for example, an asynchronous subagent result)
		// may start before a queued user follow-up. Only consume the mode request
		// when the corresponding user prompt actually reaches the agent.
		if (pendingFollowUp?.text.trim() === event.prompt.trim()) {
			pendingFollowUpOrchestratorModes.shift();
			setKeywordOrchestratorMode(pendingFollowUp.enabled, { ctx });
		}
		const rosterResult = pendingAmbientRoster
			? {
					message: {
						customType: "subagent_roster",
						content: pendingAmbientRoster.content,
						display: false,
						details: {
							entries: pendingAmbientRoster.entries,
							signature: pendingAmbientRoster.signature,
							...(pendingAmbientRoster.supersedes
								? { supersedes: true }
								: {}),
						},
					},
				}
			: undefined;
		if (pendingAmbientRoster) {
			lastAmbientRosterSignature = pendingAmbientRoster.signature;
			pendingAmbientRoster = null;
		}

		if (!isOrchestratorMode()) {
			return rosterResult;
		}

		return {
			...(rosterResult ?? {}),
			// Preserve Pi's fully assembled prompt, including project context,
			// loaded skills, and changes from earlier extension handlers.
			systemPrompt: event.systemPrompt.includes("<ultrawork-mode>")
				? event.systemPrompt
				: `${event.systemPrompt}\n\n${ORCHESTRATOR_DIRECTIVE}`,
		};
	});

	pi.on("input", (event, ctx) => {
		resetSubagentBatchStopRequest();
		if (event.source === "extension") return { action: "continue" as const };
		// Steering is part of the turn already in flight. It must not change
		// that turn's tool set or orchestration contract.
		if (event.streamingBehavior === "steer") return { action: "continue" as const };
		const enabled = hasOrchestratorKeyword(event.text);
		if (event.streamingBehavior === "followUp") {
			// Apply only when the queued follow-up becomes the next agent turn.
			pendingFollowUpOrchestratorModes.push({ text: event.text, enabled });
			return { action: "continue" as const };
		}
		setKeywordOrchestratorMode(enabled, { ctx });
		return { action: "continue" as const };
	});

	pi.on("message_end", (event) => {
		// Mixed-batch barrier: when an assistant message contains BOTH an async
		// subagent launch (subagent or subagent_resume) AND a non-subagent tool,
		// mark the batch blocking before any tool runs. The shared
		// shouldAwaitSubagentLaunch predicate then routes both subagent and
		// subagent_resume launches through the await path so the parent's
		// next turn sees completed results instead of racing the children.
		// Gated by PI_SUBAGENT_DISABLE_COORDINATOR_ONLY_TURN to share a kill
		// switch with the existing coordinator-only-turn behavior.
		const message = event?.message;
		if (!message) return;
		classifyAssistantMessageForMixedBatch(message, (agent, cwd) =>
			agent ? loadAgentDefaults(agent, cwd) : null,
		);
	});

	pi.on("tool_call", (event) => {
		if (event.toolName !== SUBAGENT_TOOL_NAME) return {};
		const input = event.input as Partial<SubagentParamsInput>;
		const agentDefs =
			typeof input.agent === "string"
				? loadAgentDefaults(
						input.agent,
						typeof input.cwd === "string" ? input.cwd : undefined,
					)
				: null;
		const agentError = getSubagentAgentRequirementError(input, agentDefs);
		const agentOverrideError = getSubagentAgentOverrideError(input, agentDefs);
		if (!agentError && !agentOverrideError) {
			if (resolveSubagentBlocking(input, agentDefs)) {
				markSubagentBatchBlocking();
			} else {
				requestSubagentBatchStop();
			}
		}
		return {};
	});

	pi.on("turn_start", () => {
		resetSubagentBatchStopRequest();
	});

	pi.on("agent_end", () => {
		resetSubagentBatchStopRequest();
		markInitialPromptLaunchComplete();
	});

	// Clean up on real session shutdown. Pi also emits this event for the
	// coordinator-only turn stop after async launches; that must not kill the
	// children that the stop was created to leave running.
	pi.on("session_shutdown", (event, ctx) => {
		traceSubagentLaunch("session.shutdown", {
			coordinatorOnlyTurnStop: stopAfterCurrentSubagentBatch,
			eventKeys: Object.keys((event ?? {}) as unknown as Record<string, unknown>),
			running: runningSubagents.size,
		});
		if (stopAfterCurrentSubagentBatch) return;

		moduleAbortController.abort();
		widgetManager.reset();
		resetSubagentBatchStopRequest();
		shutdownSubagentsForParentExit();
		if (ctx.hasUI) {
			ctx.ui.setWidget("subagent-status", undefined);
		}
	});

	// Tools denied via PI_DENY_TOOLS env var (set by parent agent based on frontmatter)
	const deniedTools = new Set(
		(process.env.PI_DENY_TOOLS ?? "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	);

	const shouldRegister = (name: string) => !deniedTools.has(name);

	registerSubagentCoreTools(pi, shouldRegister, {
		loadAgentDefaults: (agentName, cwd) => agentName ? loadAgentDefaults(agentName, undefined, cwd) : null,
		resolveEffectiveSessionMode,
		resolveTaskSessionMode,
		launchBackgroundSubagent,
		launchSubagent,
		watchBackgroundSubagent,
		watchSubagent,
		getWatcherSignal,
		wireSubagentSteerBack,
		startWidgetRefresh,
		getLaunchedSubagentResult,
		stopRunningSubagent,
		muxUnavailableResult: () => muxUnavailableResult("tab-title"),
	});

	registerSubagentResumeTool(pi, shouldRegister, {
		getShellReadyDelayMs,
		waitForInteractivePrompt,
		isMuxAvailable,
		watchBackgroundSubagent,
		watchSubagent,
		getWatcherSignal,
		wireSubagentSteerBack,
		startWidgetRefresh,
		getLaunchedSubagentResult,
		runningSubagents,
		getContextWindow: (modelRef) => widgetManager.resolveModelContextWindow(modelRef),
		modelRegistry: {
			getAvailable: () => latestContext?.modelRegistry.getAvailable() ?? [],
		},
	});

	registerSubagentCommands(pi, {
		stopRunningSubagent,
	});

	registerSubagentMessageRenderers(pi, formatElapsed);

	registerSubagentsView(pi, {
		getShellReadyDelayMs,
		waitForInteractivePrompt,
		isMuxAvailable,
		watchBackgroundSubagent,
		watchSubagent,
		getWatcherSignal,
		startWidgetRefresh,
		getContextWindow: (modelRef) => widgetManager.resolveModelContextWindow(modelRef),
		runningSubagents,
		pi,
		wireSubagentSteerBack,
	});

}
