# CAO Orchestration

Task Hub dùng hai execution mode của [CLI Agent Orchestrator (CAO)](https://awslabs.github.io/cli-agent-orchestrator/): declarative workflow cho quy trình xác định và Supervisor cho luồng cần khám phá, tự phân rã hoặc phối hợp thích ứng.

## Decision matrix

| Work item | Default | Runtime | Cho phép delegation |
|---|---|---|---|
| Task, Story, Bug | `workflow` | `cao workflow validate/run/status/resume` | Không |
| Epic | `workflow` | Một workflow tuần tự gồm mọi child và `epic-finalize` | Không |
| Requirement discovery | `supervisor` | `code_supervisor` | Có: `assign()`, `handoff()`, `send_message()` |
| Research, investigation, architecture exploration | `supervisor` | `code_supervisor` | Có |
| Docs workflow hiện tại | Giữ nguyên | Legacy docs pipeline | Theo pipeline hiện tại |

Người dùng có thể override mode trước khi chạy trong Control Center. Strict workflow luôn giữ human approval của Hub ở bước cuối; workflow không tự merge, push hoặc bypass review.

## Strict Task workflow

Workflow task có bốn step cố định, mỗi step là một execution stage độc lập:

```text
implement -> review -> evidence -> handoff
```

Spec được tạo bằng `generateCaoStandardWorkflowYaml()` và lưu trong app data, không ghi YAML untracked vào repository. Mỗi step có `id`, `provider`, `agent`, prompt, `output_schema` và binding tới input/output trước đó.

Contract chính:

- `implement`: `modified_files`, `change_summary`;
- `review`: `verdict`, `feedback`, `risk_score`;
- `evidence`: tests, pass/fail counts và `status`;
- `handoff`: summary, changed files, tests và blockers.

Step strict không được gọi `assign()`, `handoff()` hoặc `send_message()`. Electron main phát hiện tool invocation trong output, ghi orchestration violation và dừng run. Các tool này chỉ hợp lệ trong Supervisor mode.

## Epic workflow

Epic được biên dịch thành một YAML duy nhất:

```text
child-1: implement -> review -> evidence -> handoff
child-2: implement -> review -> evidence -> handoff
...
epic-finalize
```

Desktop lấy toàn bộ child chưa hoàn tất, từ chối dependency không tồn tại hoặc cycle, rồi topologically sort theo dependency, `sort_order`, `id`. Các nhánh độc lập vẫn chạy tuần tự trong v1 để bảo đảm deterministic. Parallel branch là phạm vi Supervisor, không trộn vào strict workflow.

`epic-finalize` chỉ chạy sau handoff hợp lệ của mọi child. Mapping Epic/child, current step, completed/failed/interrupted steps và aggregate handoff nằm trong `AgentRun.metadata.workflow` và `AgentRunEvent`; v1 không thêm bảng database.

## Runtime lifecycle

Electron main cung cấp API bất đồng bộ:

```ts
startWorkflow(input): Promise<WorkflowRunHandle>
getWorkflowStatus(runId): Promise<WorkflowRunStatus>
resumeWorkflow(runId): Promise<WorkflowRunStatus>
cancelWorkflow(runId): Promise<boolean>
onWorkflowEvent(callback): () => void
```

Trình tự chạy là:

1. Lưu spec vào app data và map path sang WSL nếu cần.
2. Chạy `cao workflow validate` và từ chối invalid YAML, duplicate step, cycle hoặc thiếu input.
3. Chạy `cao workflow run ... --run-id <id>` ở background.
4. Poll `cao workflow status` và phát event chuẩn hóa cho renderer.
5. Lưu registry run để khôi phục sau khi Desktop restart; resume dùng `cao workflow resume <id>`.

State của workflow: `validating`, `running`, `waiting_input`, `blocked`, `completed`, `failed`, `interrupted`, `cancelled`.

Review `REJECTED` chuyển run sang `blocked/waiting_input`; không chạy evidence hoặc handoff. Người dùng có thể resume, retry từ step implement với feedback, hoặc cancel. Event/result gửi Hub bằng idempotency key:

```text
cao:{workflowRunId}:step:{stepId}:result:{hash}
```

Retry hoặc reconnect vì vậy không tạo duplicate event/evidence.

## Supervisor requirement discovery

Requirement discovery chạy `code_supervisor`, không trực tiếp sửa code. Supervisor đọc context pack, project documents và repository, sau đó dùng:

- `assign()` cho các research task độc lập chạy song song;
- `handoff()` khi cần kết quả ngay và block tại đó;
- `send_message()` để cập nhật agent đang chạy.

Desktop Agent Room hiển thị parent Supervisor, worker terminal, provider/profile, trạng thái, tool style, output, completion message, failure và timeout. Không giả lập pipeline cố định `Architect -> Implementer -> Tester -> Auditor` cho Supervisor; pipeline đó chỉ thuộc Auto-Pilot legacy.

## Hub gate và security

```text
workflow completed
 -> evidence valid
 -> handoff needs_review
 -> human approve
 -> task/Epic done
```

CAO không được tự merge/push. Worktree guardrail vẫn do Electron main kiểm soát. `Full access` chỉ được truyền sau human approval. CAO và provider phải cùng runtime; với WSL, Desktop map cả workspace và workflow spec sang cùng distro.

Prerequisites: CAO CLI, `cao-server`, profile phù hợp (strict workflow hoặc `code_supervisor`), provider CLI trong cùng runtime và `tmux` theo yêu cầu CAO. `npm run dev`/desktop packaging chạy preflight WSL và tự bootstrap `cli-agent-orchestrator` bằng `uv` khi thiếu; Electron main cũng retry WSL startup và không cache lỗi probe transient. Có thể tắt auto-install bằng `TASK_HUB_CAO_AUTO_INSTALL=false`. Nếu CAO vẫn unavailable, Desktop hiển thị lỗi runtime và không giả vờ hiển thị workflow đã hoàn tất.
