export const ORCHESTRATOR_KEYWORD_PATTERN = /\b(?:ulw|ultrawork)\b/i;

const FENCED_CODE_PATTERN = /(?:```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const INLINE_CODE_PATTERN = /`[^`\n]+`/g;
const SLASH_COMMAND_LEAD_PATTERN =
	/^\s*\/[a-zA-Z][\w-]*(?::[\w-]+)?(?:\s|$)/;
const INTERNAL_DIRECTIVE_LEAD_PATTERN =
	/^\s*(?:<system(?:[-_:][\w-]+)?\b|\[system(?:\s|[-_:\]]))/i;

export function removeOrchestratorCodeMentions(text: string): string {
	return text
		.replace(FENCED_CODE_PATTERN, "")
		.replace(INLINE_CODE_PATTERN, "");
}

export function isOrchestratorControlInput(text: string): boolean {
	return !SLASH_COMMAND_LEAD_PATTERN.test(text)
		&& !INTERNAL_DIRECTIVE_LEAD_PATTERN.test(text);
}

export function hasOrchestratorKeyword(text: string): boolean {
	if (!isOrchestratorControlInput(text)) return false;
	return ORCHESTRATOR_KEYWORD_PATTERN.test(removeOrchestratorCodeMentions(text));
}
