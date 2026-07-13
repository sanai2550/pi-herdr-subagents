# pi-subagents-herdr

Một Pi package độc lập kết hợp:

- runtime subagent, session lifecycle, resume/kill và Herdr backend từ `edxeth/pi-subagents`;
- 8 persona/system prompt từ `nicobailon/pi-subagents`: `scout`, `worker`, `reviewer`, `planner`, `oracle`, `researcher`, `context-builder`, `delegate`.

Package không phụ thuộc vào việc cài `edxeth/pi-subagents` hoặc `nicobailon/pi-subagents` riêng. Runtime nằm trong `src/`, còn agent pack đã được bundle trong `agents/` và tự động được load khi extension khởi động.

## Cài đặt

Trong lúc phát triển local:

```bash
pi install ./local/path/to/pi-herdr-subagents
```

Sau khi push repo riêng lên GitHub:

```bash
pi install git:github.com/sanai2550/pi-herdr-subagents
```

Sau khi publish npm:

```bash
pi install npm:pi-subagents-herdr
```

Chỉ dùng **một** trong các lệnh trên. Không cài thêm hai upstream vì cả hai đều đăng ký tool `subagent` và có thể gây collision.

## Model bundled

Package này pin model theo từng persona và yêu cầu provider `cliproxy` có các model `cli/gpt-5.6-sol`, `cli/gpt-5.6-terra` và `cli/gpt-5.6-luna`:

| Agent | Model | Thinking |
| --- | --- | --- |
| `context-builder` | `cliproxy/cli/gpt-5.6-sol` | `medium` |
| `delegate` | `cliproxy/cli/gpt-5.6-sol` | kế thừa parent |
| `oracle` | `cliproxy/cli/gpt-5.6-sol` | `max` |
| `planner` | `cliproxy/cli/gpt-5.6-sol` | `xhigh` |
| `researcher` | `cliproxy/cli/gpt-5.6-terra` | `medium` |
| `reviewer` | `cliproxy/cli/gpt-5.6-sol` | `high` |
| `scout` | `cliproxy/cli/gpt-5.6-luna` | `low` |
| `worker` | `cliproxy/cli/gpt-5.6-sol` | `medium` |

Các default này dùng `allow-model-override: false`, nên launch-time model override bị bỏ qua. Nếu máy khác không có provider/model tương ứng, hãy override toàn bộ agent definition trong `~/.pi/agent/agents` hoặc `<project>/.pi/agents`.

## Chạy trong Herdr

Mở `pi` từ một pane do Herdr quản lý. Có thể ép runtime dùng Herdr:

```bash
export PI_SUBAGENT_MUX=herdr
pi
```

Sau đó yêu cầu tự nhiên:

```text
Use scout to map the authentication flow.
Use worker to implement the approved plan, then use reviewer to inspect the diff.
```

Các builtin agent được cấu hình `mode: interactive`. Runtime tạo một tab Herdr mới trong cùng workspace, không lấy focus. `auto-exit: true` đóng child sau khi hoàn tất và chuyển kết quả về parent.

## Builtin và override

Precedence của agent definitions:

```text
builtin Nicobailon < ~/.pi/agent/agents < <project>/.pi/agents
```

Bạn có thể override `worker` hoặc agent bất kỳ bằng file global/project cùng tên mà không sửa package.

## Phát triển và publish

```bash
npm install
npm run typecheck
npm test
npm run check
npm pack --dry-run
```

Tên npm tạm là `pi-subagents-herdr`. Trước khi publish, có thể đổi sang scope của bạn, ví dụ `@your-scope/pi-subagents-herdr`, rồi chạy:

```bash
npm publish --access public
```

`npm run check` xác nhận 8 bundled agents khớp với commit Nicobailon được pin trong `sources.lock.json`. Các checkout phục vụ update nằm trong `upstreams/` và không được đóng gói.

Khi cập nhật prompts:

1. Checkout commit mới trong `upstreams/nicobailon-pi-subagents`.
2. Review thay đổi frontmatter và prompt.
3. Cập nhật commit trong `sources.lock.json`.
4. Chạy `npm run sync && npm run typecheck && npm test && npm run check`.

## Mapping agent

| Nicobailon | Runtime bundled | Lý do |
| --- | --- | --- |
| `systemPromptMode` | `system-prompt` | Body được truyền đúng dưới dạng system prompt |
| `defaultContext: fork` | `session-mode: fork` | Giữ transcript cho planner/worker/oracle |
| context mặc định | `session-mode: lineage-only` | Có lineage nhưng child model bắt đầu sạch |
| `inheritProjectContext` | `trust-project` + `no-context-files` | Map project-context boundary |
| `inheritSkills: false` | `skills: none` | Không tự nạp skill ngoài persona |
| `intercom`, `contact_supervisor` | `caller_ping` | Dùng child protocol của runtime Herdr |
| child tự kết thúc | `auto-exit: true` | Cleanup tab và trả result tự động |

Các field riêng như `output`, `defaultReads` và `defaultProgress` chưa có semantic tương đương. Prompt gốc được giữ nguyên trước một compatibility appendix ngắn dành cho runtime Herdr.

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) và [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) để biết chi tiết kỹ thuật và attribution.
