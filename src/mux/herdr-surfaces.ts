import {
	createHerdrTabSurface,
	getHerdrCurrentPane,
	listHerdrTabs,
	renameHerdrTab,
	renameHerdrWorkspace,
	splitHerdrPane,
} from "./herdr.ts";

type SurfaceSplitDirection = "left" | "right" | "up" | "down";
type HerdrSurfacePlacement = "tab" | "split" | "auto";

const DEFAULT_HERDR_AUTO_MAX_SPLITS = 2;
const DEFAULT_HERDR_AUTO_MIN_COLUMNS = 50;
const autoSplitPanesByParent = new Map<string, string[]>();
const autoSplitParentByPane = new Map<string, string>();

function assertSupportedHerdrSplitDirection(
	direction: SurfaceSplitDirection,
): asserts direction is "right" | "down" {
	if (direction === "right" || direction === "down") return;
	throw new Error(
		`Herdr split direction "${direction}" is unsupported; Herdr pane split supports only right and down`,
	);
}

function cleanNumberedHerdrTabTitle(title: string): string {
	return title.replace(/^\d+:\s*/, "").trim();
}

function isAgentTabTitle(title: string): boolean {
	return /^\[[^\]\r\n]+\](?:\s|$)/.test(cleanNumberedHerdrTabTitle(title));
}

function numberedHerdrTabTitle(title: string, tabNumber: number | undefined): string {
	const cleanTitle = cleanNumberedHerdrTabTitle(title);
	if (isAgentTabTitle(cleanTitle)) return cleanTitle;
	if (tabNumber === undefined) return title;
	return `${tabNumber}: ${cleanTitle}`;
}

function isSubagentProcess(): boolean {
	return !!(process.env.PI_SUBAGENT_NAME || process.env.PI_SUBAGENT_SESSION);
}

function getHerdrSurfacePlacement(): HerdrSurfacePlacement {
	const placement = process.env.PI_SUBAGENT_HERDR_PLACEMENT
		?.trim()
		.toLowerCase();
	if (placement === "split" || placement === "auto") return placement;
	return "tab";
}

function readIntegerEnv(
	name: "PI_SUBAGENT_HERDR_MAX_SPLITS" | "PI_SUBAGENT_HERDR_MIN_COLUMNS",
	fallback: number,
	minimum: number,
): number {
	const raw = process.env[name]?.trim();
	if (!raw || !/^\d+$/.test(raw)) return fallback;
	const parsed = Number(raw);
	return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function getAutoMaxSplits(): number {
	return readIntegerEnv(
		"PI_SUBAGENT_HERDR_MAX_SPLITS",
		DEFAULT_HERDR_AUTO_MAX_SPLITS,
		0,
	);
}

function getAutoMinColumns(): number {
	return readIntegerEnv(
		"PI_SUBAGENT_HERDR_MIN_COLUMNS",
		DEFAULT_HERDR_AUTO_MIN_COLUMNS,
		1,
	);
}

function getTerminalColumns(): number | undefined {
	const columns = process.stdout.columns;
	return typeof columns === "number" && Number.isFinite(columns) && columns > 0
		? columns
		: undefined;
}

function hasRoomForAutoSplit(activeSplits: number, minColumns: number): boolean {
	const columns = getTerminalColumns();
	if (columns === undefined) return false;
	return activeSplits === 0
		? Math.floor(columns / 2) >= minColumns
		: columns >= minColumns;
}

function rememberAutoSplit(parentPaneId: string, paneId: string): void {
	const paneIds = autoSplitPanesByParent.get(parentPaneId) ?? [];
	paneIds.push(paneId);
	autoSplitPanesByParent.set(parentPaneId, paneIds);
	autoSplitParentByPane.set(paneId, parentPaneId);
}

export function forgetHerdrAutoSplit(paneId: string): void {
	const parentPaneId = autoSplitParentByPane.get(paneId);
	if (!parentPaneId) return;
	autoSplitParentByPane.delete(paneId);
	const paneIds = autoSplitPanesByParent.get(parentPaneId);
	if (!paneIds) return;
	const remaining = paneIds.filter((candidate) => candidate !== paneId);
	if (remaining.length > 0) autoSplitPanesByParent.set(parentPaneId, remaining);
	else autoSplitPanesByParent.delete(parentPaneId);
}

export function resetHerdrAutoPlacementForTest(): void {
	autoSplitPanesByParent.clear();
	autoSplitParentByPane.clear();
}

function herdrTabPosition(workspaceId: string, tabId: string): number | undefined {
	const tabs = listHerdrTabs(workspaceId);
	const index = tabs.findIndex((tab) => tab.tabId === tabId);
	return index === -1 ? undefined : index + 1;
}

export function createHerdrSurface(name: string): string {
	const parentPane = getHerdrCurrentPane();
	const placement = getHerdrSurfacePlacement();
	if (placement === "split") {
		return splitHerdrPane({
			paneId: parentPane.paneId,
			direction: "right",
			cwd: process.cwd(),
			focus: false,
		}).paneId;
	}
	if (placement === "auto") {
		const activeSplits = autoSplitPanesByParent.get(parentPane.paneId) ?? [];
		if (
			activeSplits.length < getAutoMaxSplits() &&
			hasRoomForAutoSplit(activeSplits.length, getAutoMinColumns())
		) {
			const pane = splitHerdrPane({
				paneId: activeSplits.at(-1) ?? parentPane.paneId,
				direction: activeSplits.length === 0 ? "right" : "down",
				cwd: process.cwd(),
				focus: false,
			});
			rememberAutoSplit(parentPane.paneId, pane.paneId);
			return pane.paneId;
		}
	}

	const surface = createHerdrTabSurface({
		label: name,
		cwd: process.cwd(),
		workspaceId: parentPane.workspaceId,
		focus: false,
	});

	if (parentPane.tabId && surface.tab.tabId === parentPane.tabId) {
		throw new Error(
			`Herdr tab create returned the parent tab ${parentPane.tabId}; expected a non-shrinking new tab`,
		);
	}

	const tabNumber = !isAgentTabTitle(name) && parentPane.workspaceId
		? herdrTabPosition(parentPane.workspaceId, surface.tab.tabId)
		: undefined;
	renameHerdrTab(surface.tab.tabId, numberedHerdrTabTitle(name, tabNumber));
	return surface.pane.paneId;
}

export function createHerdrSplit(
	_name: string,
	direction: SurfaceSplitDirection,
	fromSurface?: string,
): string {
	assertSupportedHerdrSplitDirection(direction);
	return splitHerdrPane({
		paneId: fromSurface,
		direction,
		cwd: process.cwd(),
		focus: false,
	}).paneId;
}

function currentHerdrTabId(): string {
	const envTabId = process.env.HERDR_TAB_ID?.trim();
	if (envTabId) return envTabId;
	const tabId = getHerdrCurrentPane().tabId;
	if (!tabId) throw new Error("Herdr current pane did not report a tab id");
	return tabId;
}

function currentHerdrWorkspaceId(): string {
	const envWorkspaceId = process.env.HERDR_WORKSPACE_ID?.trim();
	if (envWorkspaceId) return envWorkspaceId;
	const workspaceId = getHerdrCurrentPane().workspaceId;
	if (!workspaceId) {
		throw new Error("Herdr current pane did not report a workspace id");
	}
	return workspaceId;
}

export function renameHerdrCurrentTab(title: string): void {
	const tabId = currentHerdrTabId();
	if (!isSubagentProcess()) {
		renameHerdrTab(tabId, title);
		return;
	}
	if (isAgentTabTitle(title)) {
		renameHerdrTab(tabId, cleanNumberedHerdrTabTitle(title));
		return;
	}
	const workspaceId = currentHerdrWorkspaceId();
	renameHerdrTab(tabId, numberedHerdrTabTitle(title, herdrTabPosition(workspaceId, tabId)));
}

export function renameHerdrCurrentWorkspace(title: string): void {
	renameHerdrWorkspace(currentHerdrWorkspaceId(), title);
}
