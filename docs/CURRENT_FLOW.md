# Luồng hiện tại của Task Hub

## Vai trò các thành phần

| Thành phần | Vai trò |
| --- | --- |
| **Task Hub** | Control plane và nguồn dữ liệu chuẩn cho workspace, project/repository, tài liệu, task, agent run, evidence, approval và báo cáo. |
| **GitHub** | Nguồn repository, branch, pull request, issue và webhook. |
| **Local Agent Runner** | Execution plane chạy trên máy local/server riêng; tạo worktree, gọi Codex/Claude Code, chạy test và gửi kết quả về Hub. |
| **Desktop Task Companion** | Client Electron để ghép nối máy local, chọn workspace/repo, theo dõi và điều khiển agent tương tác. |

## Luồng tạo project từ GitHub

```text
Người dùng chọn workspace đang active
        |
        v
Hub lấy GitHub credential của CHÍNH workspace đó
        |
        v
GET /api/projects/github/repositories
        |
        v
GitHub API /user/repos
        |
        v
Hub hiển thị repo -> tạo Project -> lưu repo + default branch
```

Credential GitHub được lưu theo workspace. Hub không dùng credential của một workspace khác chỉ vì workspace đó được tạo sớm hơn.

## Luồng tài liệu và task context

```text
Repository docs/PROJECT_DOCUMENTS.md
        |
        v
Hub import/sync document registry
        |
        v
Project documents: brief, PRD, architecture, QA plan, release runbook...
        |
        v
Task được tạo/chọn cho agent run
        |
        v
Hub tạo context pack: task + project + docs + repository/branch + constraints
        |
        v
Local agent nhận context để thực thi
```

`docs/PROJECT_DOCUMENTS.md` là registry chuẩn để Hub biết tài liệu nào cần đưa vào ngữ cảnh task. Nội dung docs có thể được giữ trong Hub hoặc đọc từ repository theo path đã đăng ký.

## Luồng thực thi local agent

```text
Người dùng tạo agent run (queued)
        |
        v
Local runner đăng ký / có token runner
        |
        v
Runner claim task phù hợp provider (Codex / Claude Code)
        |
        v
Hub gán run cho runner + tạo lease
        |
        v
Runner lấy credential được scope theo run
        |
        v
Runner clone repository, tạo branch/worktree riêng
        |
        v
Runner chạy agent + test
        |
        v
Runner gửi log, event, evidence và handoff về Hub
        |
        v
Hub chuyển run sang review / ghi nhận báo cáo
```

Runner không cần mở cổng inbound. Mọi request đều là HTTPS outbound từ runner về Hub, nên chạy được qua NAT/VPN và dễ kiểm soát hơn.

## Giao tiếp hai chiều Hub ↔ agent

| Hướng | Cơ chế hiện tại | Dữ liệu chính |
| --- | --- | --- |
| Runner → Hub | Register, claim, heartbeat, events, logs, handoff | capability, `active_run_ids`, trạng thái, log đã redact, test/evidence, branch/PR |
| Hub → Runner | Response của heartbeat và claim | task context, lease, command `cancel` |
| Hub → UI | Đọc run/events/logs đã lưu; có thể thêm SSE/WebSocket cho realtime | tiến độ, log, trạng thái review, báo cáo |

### Heartbeat, lease và cancel

```text
Runner --heartbeat(active_run_ids)--> Hub
Hub    --renew lease---------------> AgentRun tương ứng
Hub    --commands:[cancel?]--------> Runner
Runner --SIGTERM process-----------> Local agent process
Runner --run_cancelled event-------> Hub
```

- Lease chỉ được gia hạn cho `active_run_ids` thuộc đúng runner đã claim task.
- Nếu runner ngừng heartbeat, lease hết hạn; Hub có thể cho runner khác claim lại task.
- `cancel` là command có thể lặp lại an toàn. Runner chỉ ghi event huỷ một lần và không biến run đã huỷ thành `failed` khi process đóng.

## Trạng thái khuyến nghị của một agent run

```text
queued -> claimed -> preparing -> running -> waiting_input -> needs_review -> verified
                     |              |
                     v              v
                  cancelled       failed
```

- `queued`: Hub đang chờ runner phù hợp.
- `claimed`: một runner đã nhận lease.
- `preparing`: đang clone repo/tạo worktree/lấy context.
- `running`: agent đang xử lý.
- `waiting_input` hoặc `needs_review`: agent đã bàn giao, cần người xem xét.
- `verified`: người/CI đã xác minh hoàn tất.

## Quy tắc an toàn

- Secret không nằm trong task context, logs hay report.
- Credential chỉ lấy qua endpoint scope theo workspace/project/run và chỉ dùng ngắn hạn.
- Mỗi run dùng branch/worktree tách biệt; agent không tự merge hoặc deploy.
- Logs được redact trước khi lưu tại Hub.
- Handoff cần chứa evidence: test command/result, commit SHA, branch hoặc PR và giới hạn còn lại.

## Báo cáo

Hub tổng hợp dữ liệu từ task, agent run, evidence, release và GitHub snapshot để tạo báo cáo theo project/sprint. Local agent chỉ gửi dữ liệu thực thi; Hub giữ trách nhiệm tổng hợp và hiển thị báo cáo.

## API cốt lõi

| Mục đích | Endpoint |
| --- | --- |
| Liệt kê repo GitHub | `GET /api/projects/github/repositories` |
| Đăng ký runner | `POST /api/v1/runners/register` |
| Heartbeat + nhận command | `POST /api/v1/runners/{runner_id}/heartbeat` |
| Claim task | `GET /api/v1/runners/{runner_id}/jobs/claim?provider=codex` |
| Lấy credential scope theo run | `GET /api/v1/runners/{runner_id}/jobs/{run_id}/credential?provider=github` |
| Gửi event | `POST /api/v1/agent-runs/{run_id}/events` |
| Gửi log | `POST /api/v1/agent-runs/{run_id}/logs` |
| Yêu cầu huỷ | `POST /api/v1/agent-runs/{run_id}/cancel` |

## Việc tiếp theo nên làm

1. Bổ sung SSE/WebSocket để UI nhận log và trạng thái gần realtime; runner vẫn giữ heartbeat/polling làm cơ chế tin cậy chính.
2. Định nghĩa idempotency key cho toàn bộ event/handoff và chính sách retry/backoff.
3. Thêm dashboard runner: online/busy/offline, lease sắp hết hạn, version/capability và lỗi gần nhất.
4. Kết nối CI/GitHub webhook để tự động đính evidence test/PR vào agent run và report.
