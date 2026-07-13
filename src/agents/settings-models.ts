import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { getAgentConfigDir } from "./definitions.ts";

export interface SubagentModelSelection {
	model?: string;
	thinking?: string;
}

export interface ResolvedSubagentModelSettings {
	agentOverride?: SubagentModelSelection;
	defaultModel?: string;
	defaultThinking?: string;
}

interface SubagentSettingsBlock {
	agentOverrides?: Record<string, SubagentModelSelection>;
	defaultModel?: string;
	defaultThinkingLevel?: string;
}

interface SettingsWithSubagents {
	subagents?: SubagentSettingsBlock;
}

function nonEmpty(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeSelection(
	selection: SubagentModelSelection | undefined,
): SubagentModelSelection | undefined {
	const model = nonEmpty(selection?.model);
	const thinking = nonEmpty(selection?.thinking);
	return model || thinking ? { ...(model ? { model } : {}), ...(thinking ? { thinking } : {}) } : undefined;
}

export function resolveSubagentModelSettings(
	agentName: string | undefined,
	cwd: string,
	options: { agentConfigDir?: string; projectTrusted?: boolean } = {},
): ResolvedSubagentModelSettings {
	const manager = SettingsManager.create(
		cwd,
		options.agentConfigDir ?? getAgentConfigDir(),
		{ projectTrusted: options.projectTrusted ?? true },
	);
	const globalBlock = (manager.getGlobalSettings() as SettingsWithSubagents).subagents;
	const projectBlock = (manager.getProjectSettings() as SettingsWithSubagents).subagents;
	const globalOverride = agentName
		? normalizeSelection(globalBlock?.agentOverrides?.[agentName])
		: undefined;
	const projectOverride = agentName
		? normalizeSelection(projectBlock?.agentOverrides?.[agentName])
		: undefined;
	const mergedOverride = normalizeSelection({
		...globalOverride,
		...projectOverride,
	});

	return {
		...(mergedOverride ? { agentOverride: mergedOverride } : {}),
		...(nonEmpty(projectBlock?.defaultModel ?? globalBlock?.defaultModel)
			? { defaultModel: nonEmpty(projectBlock?.defaultModel ?? globalBlock?.defaultModel) }
			: {}),
		...(nonEmpty(
			projectBlock?.defaultThinkingLevel ?? globalBlock?.defaultThinkingLevel,
		)
			? {
					defaultThinking: nonEmpty(
						projectBlock?.defaultThinkingLevel ?? globalBlock?.defaultThinkingLevel,
					),
				}
			: {}),
	};
}
