# Third-party notices

This package combines and modifies material from two MIT-licensed projects.

## edxeth/pi-subagents

- Source: https://github.com/edxeth/pi-subagents
- Pinned analysis commit: `f445a178d14eb6d55d8f60d6aeca132713c8c188`
- Use: extension runtime, Herdr/multiplexer integration, lifecycle, session, tools and tests
- License: MIT; the copyright and permission notice is preserved in `LICENSE`

The Edxeth project itself credits HazAT/pi-interactive-subagents as its upstream foundation.

## nicobailon/pi-subagents

- Source: https://github.com/nicobailon/pi-subagents
- Pinned agent-source commit: `c940fe20e86d9ba429eebcac809ec79d478ef206`
- Use: builtin agent personas and system prompts under `agents/`, adapted to the Edxeth frontmatter/runtime contract
- Declared license: MIT (`package.json` in the upstream repository)

The original prompt body is retained before a small Herdr runtime compatibility appendix. Frontmatter is normalized for the bundled runtime.
