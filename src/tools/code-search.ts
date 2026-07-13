import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createGrepTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { asSubagentToolResult } from "../runtime/state.ts";
import { AST_GREP_TOOL_NAME, RG_TOOL_NAME } from "./tool-names.ts";

const require = createRequire(import.meta.url);
const AST_GREP_BINARY = join(
	dirname(require.resolve("@ast-grep/cli/package.json")),
	"ast-grep",
);
const DEFAULT_AST_GREP_LIMIT = 100;
const MAX_MATCH_TEXT_CHARS = 4_000;

const strictnessSchema = Type.Union([
	Type.Literal("cst"),
	Type.Literal("smart"),
	Type.Literal("ast"),
	Type.Literal("relaxed"),
	Type.Literal("signature"),
	Type.Literal("template"),
]);

const astGrepParams = Type.Object({
	pattern: Type.String({
		description:
			"AST pattern to match, for example `console.log($ARG)` or `foo($$$ARGS)`,",
	}),
	path: Type.Optional(
		Type.String({ description: "File or directory to search; defaults to the current directory" }),
	),
	language: Type.Optional(
		Type.String({ description: "Pattern language such as ts, tsx, js, python, rust, or go" }),
	),
	selector: Type.Optional(
		Type.String({ description: "AST node kind to extract from the pattern before matching" }),
	),
	strictness: Type.Optional(strictnessSchema),
	globs: Type.Optional(
		Type.Array(Type.String(), {
			description: "Include or exclude globs; prefix exclusions with !",
			maxItems: 20,
		}),
	),
	context: Type.Optional(
		Type.Integer({ description: "Context lines around each match", minimum: 0, maximum: 20 }),
	),
	limit: Type.Optional(
		Type.Integer({ description: "Maximum matches returned", minimum: 1, maximum: 500 }),
	),
});

interface AstGrepMatch {
	file?: string;
	text?: string;
	range?: {
		start?: { line?: number; column?: number };
		end?: { line?: number; column?: number };
	};
}

function formatAstGrepMatch(match: AstGrepMatch): string {
	const startLine = (match.range?.start?.line ?? 0) + 1;
	const startColumn = (match.range?.start?.column ?? 0) + 1;
	const endLine = (match.range?.end?.line ?? 0) + 1;
	const location = `${match.file ?? "<unknown>"}:${startLine}:${startColumn}-${endLine}`;
	const text = (match.text ?? "").slice(0, MAX_MATCH_TEXT_CHARS);
	const suffix = (match.text?.length ?? 0) > MAX_MATCH_TEXT_CHARS ? "\n[match text truncated]" : "";
	return `${location}\n${text}${suffix}`;
}

export function registerCodeSearchTools(pi: ExtensionAPI): void {
	const grepParameters = createGrepTool(process.cwd()).parameters;
	pi.registerTool({
		name: RG_TOOL_NAME,
		label: "ripgrep",
		description:
			"Fast regex/literal text search powered by ripgrep. Use this for normal repository discovery; use ast_grep when syntax structure matters.",
		parameters: grepParameters,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return createGrepTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		name: AST_GREP_TOOL_NAME,
		label: "ast-grep",
		description:
			"Read-only structural code search using ast-grep. Matches parsed syntax instead of comments or string contents. This tool never rewrites files.",
		parameters: astGrepParams,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const args = ["run", "--pattern", params.pattern, "--json=compact", "--color", "never"];
			if (params.language) args.push("--lang", params.language);
			if (params.selector) args.push("--selector", params.selector);
			if (params.strictness) args.push("--strictness", params.strictness);
			if (params.context !== undefined) args.push("--context", String(params.context));
			for (const glob of params.globs ?? []) args.push("--globs", glob);
			args.push(params.path ?? ".");

			const result = await pi.exec(AST_GREP_BINARY, args, {
				cwd: ctx.cwd,
				signal,
				timeout: 120_000,
			});
			if (result.code === 1 && result.stdout.trim() === "[]") {
				return asSubagentToolResult({
					content: [{ type: "text" as const, text: "No structural matches found" }],
					details: { matchCount: 0, returnedCount: 0 },
				});
			}
			if (result.code !== 0) {
				const message = result.stderr.trim() || `ast-grep exited with code ${result.code}`;
				throw new Error(message);
			}

			let matches: AstGrepMatch[];
			try {
				const parsed: unknown = JSON.parse(result.stdout);
				matches = Array.isArray(parsed) ? (parsed as AstGrepMatch[]) : [];
			} catch {
				throw new Error("ast-grep returned malformed JSON output");
			}
			const limit = params.limit ?? DEFAULT_AST_GREP_LIMIT;
			const returned = matches.slice(0, limit);
			let text = returned.map(formatAstGrepMatch).join("\n\n");
			if (matches.length > returned.length) {
				text += `\n\n[Results truncated: showing ${returned.length} of ${matches.length} matches]`;
			}
			return asSubagentToolResult({
				content: [{ type: "text" as const, text: text || "No structural matches found" }],
				details: { matchCount: matches.length, returnedCount: returned.length },
			});
		},
	});
}
