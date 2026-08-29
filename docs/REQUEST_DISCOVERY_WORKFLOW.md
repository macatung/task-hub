# Request Discovery Workflow

## Mục tiêu

Biến một request của developer thành bối cảnh có thể kiểm chứng, tài liệu dự án, kế hoạch triển khai, backlog có story point và các agent run được đồng bộ về Task Hub.

## Vòng đời

```text
request -> discovery -> docs + plan preview -> human approval -> backlog commit
        -> local execution -> handoff/evidence -> review -> verified
```

## Discovery mode (Supervisor, không ghi dữ liệu)

Developer chọn project/repository và provider local (Codex hoặc Antigravity), sau đó cung cấp request. Desktop tạo một CAO `code_supervisor` session. Supervisor phải:

1. Đọc Task Hub context pack, project documents và repository hiện tại.
2. Hỏi lại các điểm mơ hồ, rủi ro hoặc dependency chưa rõ.
3. Đề xuất các thay đổi cho `PROJECT_BRIEF`, `PRD`, `ARCHITECTURE`, `QA_PLAN` và `RELEASE_RUNBOOK`.
4. Sinh plan theo phase/sprint cùng Epic, Story và Task.
5. Gán story point Fibonacci `1, 2, 3, 5, 8`; mọi item lớn hơn 8 phải tách thành story/task nhỏ hơn.
6. Trả về preview có acceptance criteria, dependency, risk, estimate và lý do estimate.

Supervisor dùng `assign()` cho các nhánh research độc lập, `handoff()` khi cần kết quả đồng bộ và `send_message()` để cập nhật worker đang chạy. Agent Room hiển thị parent supervisor và workers thật; không thay thế bằng fixed 4-role cards của Auto-Pilot legacy.

Không được commit, push, merge, deploy hoặc tạo task chính thức trong mode này.

## Approval và backlog

Developer xem preview trong Task Hub. Khi approve, Hub mới:

- lưu/đồng bộ project document registry `docs/PROJECT_DOCUMENTS.md`;
- tạo sprint, epic, story, task và story point;
- lưu analysis và decision log vào project documents;
- tạo context pack cho từng task.

## Execution mode

Task/Story/Bug/Epic sau khi được approve đi qua strict CAO workflow riêng (YAML implement → review → evidence → handoff), chạy trong worktree riêng và không được tự delegate. Agent phải dùng MCP để đọc task/context/docs, ghi tiến độ, và gửi structured handoff gồm changed files, test/evidence, branch, commit SHA, PR và blocker. Hub giữ nguồn dữ liệu chuẩn cho báo cáo và review.

## Prompt contract

```text
Analyze this request for the selected Task Hub project: <REQUEST>.
Read the context pack, project documents and repository first. Do not implement.
Return a structured discovery result with: clarifying questions, affected docs,
architecture impact, risks, phased plan, Epic/Story/Task backlog, acceptance
criteria, dependencies and Fibonacci story points. Split every item above 8
points. Use Task Hub MCP to read context; do not create or modify records until
human approval.
```

## Sync contract

- Agent events use `event_id`; logs use `(agent_run_id, sequence)`.
- Evidence/handoff use an `Idempotency-Key` when retrying.
- Runner retries transient Hub errors with exponential backoff.
- GitHub CI and PR webhooks attach evidence to matching agent runs.
