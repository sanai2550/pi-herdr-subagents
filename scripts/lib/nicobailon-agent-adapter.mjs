const RUNTIME_FIELDS = new Set([
  "name",
  "description",
  "model",
  "thinking",
  "tools",
  "systemPromptMode",
  "inheritProjectContext",
  "inheritSkills",
  "defaultContext",
]);

const TOOL_ALIASES = new Map([
  ["intercom", "caller_ping"],
  ["contact_supervisor", "caller_ping"],
]);

const HERDR_COMPATIBILITY_PROMPT = `## Herdr runtime compatibility

This child is launched by the Edxeth pi-subagents runtime in a Herdr surface. Runtime lifecycle and result delivery are managed by that extension.

- If you are blocked or require a decision, use \`caller_ping\` with one concise message. It notifies the launching session, closes this helper session, and allows the parent to resume it later.
- Treat earlier references to \`intercom\` or \`contact_supervisor\` as \`caller_ping\`; those Nicobailon-specific bridge tool names are not available in this runtime.
- Return the requested final answer normally when the task is complete. The runtime handles automatic exit and result delivery.`;

export function parseAgentMarkdown(content) {
  const normalized = content.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("Agent definition must start with YAML frontmatter");

  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    frontmatter[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { frontmatter, body: match[2].trim() };
}

function bool(value, fallback) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function adaptTools(value) {
  if (!value) return undefined;
  const tools = value
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean)
    .map((tool) => TOOL_ALIASES.get(tool) ?? tool);
  return [...new Set(tools)].join(", ");
}

function yamlLine(key, value) {
  return value === undefined ? null : `${key}: ${String(value)}`;
}

export function adaptNicobailonAgent(content, options = {}) {
  const { frontmatter, body } = parseAgentMarkdown(content);
  const name = frontmatter.name ?? options.fallbackName;
  if (!name) throw new Error("Agent definition is missing name");

  const unknownRuntimeFields = Object.keys(frontmatter).filter(
    (key) => !RUNTIME_FIELDS.has(key),
  );
  const promptMode = frontmatter.systemPromptMode === "append" ? "append" : "replace";
  const sessionMode = frontmatter.defaultContext === "fork" ? "fork" : "lineage-only";
  const trustProject = bool(frontmatter.inheritProjectContext, true);
  const inheritSkills = bool(frontmatter.inheritSkills, true);
  const tools = adaptTools(frontmatter.tools);
  const model = options.modelOverride?.model ?? frontmatter.model;
  const thinking = options.modelOverride?.thinking ?? frontmatter.thinking;

  const lines = [
    yamlLine("name", name),
    yamlLine("description", frontmatter.description),
    yamlLine("model", model),
    yamlLine("thinking", thinking),
    yamlLine(
      "allow-model-override",
      options.modelOverride ? "false" : undefined,
    ),
    yamlLine("mode", "interactive"),
    yamlLine("async", "true"),
    yamlLine("auto-exit", "true"),
    yamlLine("spawning", "false"),
    yamlLine("system-prompt", promptMode),
    yamlLine("session-mode", sessionMode),
    yamlLine("trust-project", trustProject),
    yamlLine("no-context-files", !trustProject),
    yamlLine("skills", inheritSkills ? "all" : "none"),
    yamlLine("tools", tools),
    yamlLine("parent-close-policy", "terminate"),
  ].filter(Boolean);

  return {
    name,
    markdown: `---\n${lines.join("\n")}\n---\n\n${body}\n\n${HERDR_COMPATIBILITY_PROMPT}\n`,
    ignoredNicobailonFields: unknownRuntimeFields,
  };
}
