import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerCodeSearchTools } from "../../src/tools/code-search.ts";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

function createToolHarness() {
	const tools = new Map<string, any>();
	const pi = {
		registerTool(definition: any) {
			tools.set(definition.name, definition);
		},
		async exec(command: string, args: string[], options: any) {
			try {
				const result = await execFileAsync(command, args, {
					cwd: options.cwd,
					signal: options.signal,
					timeout: options.timeout,
					maxBuffer: 10 * 1024 * 1024,
				});
				return { stdout: result.stdout, stderr: result.stderr, code: 0, killed: false };
			} catch (error: any) {
				return {
					stdout: error.stdout ?? "",
					stderr: error.stderr ?? "",
					code: error.code ?? 1,
					killed: error.killed ?? false,
				};
			}
		},
	} as unknown as ExtensionAPI;
	registerCodeSearchTools(pi);
	return tools;
}

describe("code search tools", () => {
	it("registers rg and ast_grep", () => {
		const tools = createToolHarness();
		assert.deepEqual([...tools.keys()], ["rg", "ast_grep"]);
	});

	it("uses rg for ordinary text search", async () => {
		const directory = mkdtempSync(join(tmpdir(), "pi-rg-tool-"));
		temporaryDirectories.push(directory);
		writeFileSync(join(directory, "sample.ts"), "const searchableNeedle = 1;\n", "utf8");
		const tool = createToolHarness().get("rg");
		const result = await tool.execute(
			"call-rg",
			{ pattern: "searchableNeedle", path: ".", literal: true },
			new AbortController().signal,
			undefined,
			{ cwd: directory },
		);
		assert.match(result.content[0].text, /sample\.ts:1/);
	});

	it("matches syntax with ast_grep while ignoring comments and strings", async () => {
		const directory = mkdtempSync(join(tmpdir(), "pi-ast-grep-tool-"));
		temporaryDirectories.push(directory);
		writeFileSync(
			join(directory, "sample.ts"),
			[
				'// console.log("comment")',
				'const example = "console.log(\\\"string\\\")";',
				'console.log("real call");',
			].join("\n"),
			"utf8",
		);
		const tool = createToolHarness().get("ast_grep");
		const result = await tool.execute(
			"call-ast-grep",
			{
				pattern: "console.log($ARG)",
				path: "sample.ts",
				language: "ts",
			},
			new AbortController().signal,
			undefined,
			{ cwd: directory },
		);
		const text = result.content[0].text;
		assert.match(text, /sample\.ts:3:1-3/);
		assert.match(text, /real call/);
		assert.doesNotMatch(text, /comment|string/);
		assert.deepEqual(result.details, { matchCount: 1, returnedCount: 1 });
	});
});
