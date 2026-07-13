# Architecture: bundled Nicobailon personas on the Edxeth Herdr runtime

## Decision

Repo này là một Pi package độc lập. Nó fork runtime Edxeth trong `src/` và bundle agent definitions đã chuyển đổi trong `agents/`.

```text
development/update time
upstreams/nicobailon-pi-subagents/agents/*.md
                    |
                    v
        scripts/sync-agents.mjs
     camelCase -> kebab-case + tool bridge
                    |
                    v
             package agents/*.md

installed runtime
Pi -> src/index.ts -> bundled agent discovery
                      builtin < global < project
                                |
                                v
 Herdr tab -> child Pi -> session JSONL/sidecar -> parent result
```

Upstream checkouts và sync adapter chỉ là developer tooling. Chúng không nằm trong npm tarball và không cần tồn tại trên máy người cài.

## Vì sao chỉ fork một runtime

1. Hai upstream cùng tên `pi-subagents` và cùng đăng ký public tool `subagent`.
2. Nicobailon phát triển với Pi 0.74.x; Edxeth yêu cầu Pi >=0.79. Import hai runtime cùng lúc tạo API/version conflict.
3. Foreground runtime Nicobailon dựa trên `pi --mode json -p` và stdout JSONL. Herdr trả pane ID nên port transport vào đó buộc viết lại streaming, timeout, fallback và lifecycle.
4. Edxeth đã có Herdr backend hoàn chỉnh: detect current pane, tạo tab không focus, gửi command, theo dõi child session/exit sidecar, route result và cleanup.

Vì vậy source runtime Edxeth được fork trực tiếp; persona/system prompts Nicobailon trở thành builtin data provider.

## Builtin discovery contract

`src/agents/definitions.ts` đọc lần lượt:

1. package `agents/` với source `builtin`;
2. `$PI_CODING_AGENT_DIR/agents` với source `global`;
3. `<cwd>/.pi/agents` với source `project`.

Definitions sau ghi đè definitions trước theo `name`. Nhờ vậy package hoạt động ngay sau install nhưng người dùng vẫn có quyền override từng persona.

Mỗi builtin định nghĩa:

- body Nicobailon ở đầu system prompt;
- `system-prompt: replace|append` rõ ràng;
- `mode: interactive` và `auto-exit: true`;
- `async: true`, `spawning: false`;
- project context, skills và session mode đã map;
- `caller_ping` thay hai supervisor tools chỉ có trong runtime Nicobailon.

Edxeth mặc định tạo một Herdr **tab** mới trong workspace cha. Nếu cần split pane, thay đổi thuộc placement strategy của `src/mux/`, không thuộc agent adapter.

## Package boundary

Tarball publish chỉ chứa:

- `src/**/*.ts` — extension/runtime, gồm test helpers được export để giữ compatibility với public API của runtime fork;
- `agents/**/*.md` — builtin personas;
- README, architecture, license và third-party notices.

`upstreams/`, tests, sync scripts và local dependencies không được ship nhờ allowlist `files` trong `package.json`.

## Giới hạn

- `caller_ping` là ping-and-exit rồi parent resume, không phải live request/reply như native supervisor channel Nicobailon.
- `output`, `defaultReads`, `defaultProgress` chưa được tự động hóa.
- Chains, worktrees, acceptance gates, watchdog, memory và budgets của Nicobailon không được port; runtime Edxeth vẫn giữ những capability riêng của nó.
- Interactive Herdr cần parent Pi có UI và chạy trong Herdr. Headless `pi -p` dùng background policy của runtime.
- Phiên Codex tạo package không có `HERDR_ENV=1`, vì vậy live Herdr smoke phải chạy từ một Herdr pane thật.

## Verification

1. Adapter test giữ nguyên prompt gốc trước compatibility appendix.
2. Builtin discovery test xác nhận đủ 8 persona và precedence override.
3. TypeScript typecheck xác nhận fork build được với Pi peer APIs.
4. Full runtime test bao gồm fake-Herdr mux và interactive-launch parity.
5. `npm pack --dry-run` xác nhận tarball chứa runtime + agents và không chứa upstreams.
6. Live Herdr smoke là gate cuối khi chạy trong Herdr session.
