export const BUNDLED_AGENT_MODEL_OVERRIDES = Object.freeze({
  "context-builder": Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol", thinking: "medium" }),
  delegate: Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol" }),
  oracle: Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol", thinking: "max" }),
  planner: Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol", thinking: "xhigh" }),
  researcher: Object.freeze({ model: "cliproxy/cli/gpt-5.6-terra", thinking: "medium" }),
  reviewer: Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol", thinking: "high" }),
  scout: Object.freeze({ model: "cliproxy/cli/gpt-5.6-luna", thinking: "low" }),
  worker: Object.freeze({ model: "cliproxy/cli/gpt-5.6-sol", thinking: "medium" }),
});
