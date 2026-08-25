# Task Hub Functional Requirements Document (FRD)

**Version**: 2.0.0  
**Status**: Production / Operational  
**Standard**: `task-hub-docs-v1`  
**Last Updated**: 2026-08-25  
**Canonical Manifest**: [`docs/PROJECT_DOCUMENTS.md`](file:///d:/Work/task-hub/docs/PROJECT_DOCUMENTS.md)

---

## 1. Executive Summary & Product Vision

Task Hub là nền tảng quản lý dự án thế hệ mới kết hợp **Human-in-the-loop Work Management** và **Supervised AI Agent Execution**. Nền tảng cho phép con người (Product Owner, Tech Lead, Developer, QA) và AI Agents (Codex, Claude Code, Antigravity) cộng tác trong một môi trường an toàn, có bằng chứng kiểm thử (verification evidence), truy vết lịch sử E2E minh bạch và kiểm soát quyền hạn chặt chẽ.

---

## 2. User Personas & Roles

| Persona | Vai trò | Trách nhiệm chính trong hệ thống |
| :--- | :--- | :--- |
| **Product Owner (PO)** | Quản lý sản phẩm | Khởi tạo Requirement Discovery, duyệt Backlog proposal, quản lý Sprint và đo lường tiến độ. |
| **Tech Lead / Reviewer** | Giám sát kỹ thuật & Review | Duyệt handoff từ Agent, kiểm tra Test Evidence & Diff, phê duyệt chuyển trạng thái `review -> done` hoặc Request Changes. |
| **Developer / Operator** | Lập trình viên | Chọn Task, khởi chạy Agent trên Desktop Control Center, cấp quyền sandbox escalation, gửi follow-up prompt, submit handoff. |
| **QA / Tester** | Đảm bảo chất lượng | Xác thực QA Plan, cấu hình test commands, thẩm định bằng chứng kiểm thử tự động. |
| **AI Agent (Worker)** | Tác tử AI tự hành | Đọc Context Pack, thực thi code trong Git worktree cô lập, chạy test suite, tạo commit, gửi structured handoff. |

---

## 3. Detailed Functional Requirements (FRD)

### Module 1: Workspace & Multi-Tenancy Management

#### `FR-01: Multi-Tenant Workspace Isolation`
- **Mô tả**: Mọi tài nguyên (Projects, Tasks, Documents, Agent Runs, Sprints) phải được cô lập tuyệt đối theo `workspace_id`.
- **Business Rules**:
  - Người dùng chỉ truy cập được dữ liệu thuộc workspace hiện tại được resolve qua session hoặc API key.
  - Phân quyền theo vai trò: `owner`, `admin`, `developer`, `viewer`.
- **Linked Task / Epic**: `TASK-WS-01` (Multi-tenancy Architecture)
- **Source Paths**: [`WorkspaceContext.php`](file:///d:/Work/task-hub/apps/hub/app/Services/WorkspaceContext.php), [`WorkspaceProjectAccess.php`](file:///d:/Work/task-hub/apps/hub/app/Services/WorkspaceProjectAccess.php)

#### `FR-02: Desktop Companion Pairing & Token Lifecycle`
- **Mô tả**: Ứng dụng Desktop kết nối với Web Hub thông qua mã Pairing Code 6 chữ số hoặc API Token.
- **Business Rules**:
  - Mã pairing có hạn 10 phút, mã hóa một chiều.
  - Sau khi duyệt, Desktop nhận bearer token được phân vùng truy cập theo Project ID đã chọn.
- **Linked Task / Epic**: `TASK-DESK-01` (Desktop Pairing Protocol)
- **Source Paths**: [`DesktopPairingController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/DesktopPairingController.php)

---

### Module 2: Project, Task & Sprint Management (Work Items)

#### `FR-03: Hierarchical Work Items (Epic -> Story -> Task -> Bug)`
- **Mô tả**: Hỗ trợ phân cấp quản lý công việc chuẩn Agile/Scrum.
- **Business Rules**:
  - `Epic`: Chứa nhiều Story/Task, không trực tiếp gán vào Sprint.
  - `Story`, `Task`, `Bug`: Có thể gán vào Sprint, hỗ trợ điểm Story Point Fibonacci (1, 2, 3, 5, 8, 13, 21).
  - Tự động sinh mã `issue_key` duy nhất theo Project prefix (ví dụ `HUB-101`).
- **Linked Task / Epic**: `TASK-CORE-01` (Hierarchical Work Items)
- **Source Paths**: [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php), [`Task.php`](file:///d:/Work/task-hub/apps/hub/app/Models/Task.php)

#### `FR-04: Task Lifecycle & Status State Machine`
- **Mô tả**: Quản lý vòng đời trạng thái: `todo` ➔ `in_progress` ➔ `review` ➔ `done`.
- **Business Rules**:
  - Khi chuyển sang `done`, tự động ghi nhận `completed_at = now()`.
  - Khi chuyển ra khỏi `done`, xóa `completed_at = null`.
  - Mọi bước chuyển trạng thái bắt buộc ghi nhận danh tính Actor (`user`, `agent_runner`, `system`).
- **Linked Task / Epic**: `TASK-CORE-02` (Task State Machine)
- **Source Paths**: [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php#L161)

#### `FR-05: Task Dependency Guardrail & DAG Validation`
- **Mô tả**: Hỗ trợ phụ thuộc giữa các Task (`task_dependencies`).
- **Business Rules**:
  - Không cho phép task phụ thuộc vào chính nó hoặc tạo chu trình lặp (Cyclic Dependency).
  - **Chốt chặn an toàn**: Task đang bị block bởi prerequisite chưa xong **không được phép chuyển sang `in_progress`** (trả về lỗi HTTP 422).
- **Linked Task / Epic**: `TASK-CORE-03` (Dependency Guardrail)
- **Source Paths**: [`Task.php`](file:///d:/Work/task-hub/apps/hub/app/Models/Task.php#L72)

#### `FR-06: Sprint Management & Velocity Burndown`
- **Mô tả**: Quản lý Sprint theo chu kỳ 2 tuần: `future`, `active`, `completed`.
- **Business Rules**:
  - Mỗi Project chỉ có duy nhất 1 Sprint ở trạng thái `active` tại một thời điểm.
  - Tự động tính toán tổng điểm Story Points, điểm đã hoàn tất, và tỷ lệ phân bổ tiến độ.
- **Linked Task / Epic**: `TASK-CORE-04` (Sprint Lifecycle)
- **Source Paths**: [`ApiSprintController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiSprintController.php)

---

### Module 3: Project Knowledge & Document Lifecycle

#### `FR-07: Manifest-Driven Document Catalog (PROJECT_DOCUMENTS.md)`
- **Mô tả**: Quản lý tài liệu dự án thông qua bảng manifest markdown chuẩn (`task-hub-docs-v1`).
- **Business Rules**:
  - Bắt buộc kiểm tra 5 loại tài liệu lõi: `brief`, `prd`, `architecture`, `qa_plan`, `release_runbook`.
  - Tự động cảnh báo `missing_core` khi phát hiện tài liệu lõi bị thiếu hoặc chưa kích hoạt.
- **Linked Task / Epic**: `TASK-DOC-01` (Document Catalog & Manifest)
- **Source Paths**: [`ProjectKnowledgeService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/ProjectKnowledgeService.php), [`ProjectDocumentsPanel.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/ProjectDocumentsPanel.vue)

#### `FR-08: Document Freshness & 30-Day Staleness Detection`
- **Mô tả**: Giám sát tính tươi mới của tài liệu theo thời gian thực.
- **Business Rules**:
  - Lưu trữ `last_verified_at`, `source_updated_at` và `content_hash` (SHA-256).
  - Tự động gán cờ `is_stale = true` nếu tài liệu không được xác thực trong vòng 30 ngày hoặc không ở trạng thái `active`.
- **Linked Task / Epic**: `TASK-DOC-02` (Staleness Detection Engine)
- **Source Paths**: [`ProjectDocument.php`](file:///d:/Work/task-hub/apps/hub/app/Models/ProjectDocument.php#L25)

#### `FR-09: Preflight Context Pack Ingestion for Agents`
- **Mô tả**: Tự động đóng gói nội dung tài liệu tươi mới nhất vào Context Pack trước khi Agent thực thi Task.
- **Business Rules**:
  - Đọc nội dung từ database Hub hoặc fetch trực tiếp file mới nhất từ GitHub repo qua API.
  - Agent luôn nhận được tiêu chuẩn kiến trúc và PRD cập nhật nhất.
- **Linked Task / Epic**: `TASK-DOC-03` (Agent Context Pack Ingestion)
- **Source Paths**: [`TaskHubContextPackService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/TaskHubContextPackService.php#L60)

---

### Module 4: Desktop Control Center & Agent Orchestration

#### `FR-10: Instant User Action Feedback & Audio Cues`
- **Mô tả**: Mọi hành động của người dùng trên Desktop app đều phải nhận được phản hồi trực quan (Toast) và âm thanh (Web Audio SFX) tức thì.
- **Business Rules**:
  - Hiển thị Toast thông báo trạng thái (`loading`, `success`, `warning`, `error`, `info`).
  - Hỗ trợ tracking tiến trình đa bước với spinner và progress bar.
  - Tự động ghi lại log thao tác vào Audit Timeline.
- **Linked Task / Epic**: `TASK-UX-01` (Action Feedback System)
- **Source Paths**: [`useActionFeedback.ts`](file:///d:/Work/task-hub/apps/desktop/src/composables/useActionFeedback.ts), [`ActionFeedbackToast.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/ActionFeedbackToast.vue)

#### `FR-11: Isolated Git Worktree Execution`
- **Mô tả**: Agent không được chạy trực tiếp trên working directory chính mà phải chạy trong một Git worktree riêng biệt (`.worktrees/task-xxx`).
- **Business Rules**:
  - Tự động tạo branch `task/KEY-title` từ branch mặc định.
  - Tự động dọn dẹp worktree sau khi hoàn tất hoặc hủy phiên.
- **Linked Task / Epic**: `TASK-DESK-02` (Worktree Isolation Engine)
- **Source Paths**: [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue#L75)

#### `FR-12: Multi-Tier Execution Policy & Human Escalation`
- **Mô tả**: Kiểm soát quyền thực thi của Agent theo 3 cấp độ: `restricted`, `workspace_write`, `full_access`.
- **Business Rules**:
  - Mặc định: `workspace_write` (chỉ ghi trong worktree).
  - Khi sandbox bị chặn (Windows helper missing) hoặc agent cần quyền cao hơn, hệ thống chuyển sang `waiting_input` và hiển thị thẻ **Human Approval Required**.
  - Người dùng có thể duyệt `workspace_write`, duyệt `full_access` (kèm xác nhận cảnh báo), hoặc từ chối.
- **Linked Task / Epic**: `TASK-DESK-03` (Security Policy Escalation)
- **Source Paths**: [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue#L90), [`codexApprovalPolicy.ts`](file:///d:/Work/task-hub/apps/desktop/src/services/codexApprovalPolicy.ts)

#### `FR-13: Real-Time Bidirectional Interaction & Follow-Up Input`
- **Mô tả**: Người dùng có thể theo dõi live stream log/code và gửi prompt bổ sung trực tiếp vào session đang chạy.
- **Business Rules**:
  - Truyền prompt qua stdin/IPC của Agent runner mà không ngắt tiến trình.
  - Ghi nhận turn mới của người dùng vào lịch sử hội thoại.
- **Linked Task / Epic**: `TASK-DESK-04` (Live Interactive Stream)
- **Source Paths**: [`RunWorkspace.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/control-center/RunWorkspace.vue#L57)

---

### Module 5: Structured Handoff, Verification Evidence & Review Flow (HITL)

#### `FR-14: JSON Schema-Enforced Handoff Contract`
- **Mô tả**: Khi Agent hoàn tất code, bắt buộc xuất ra payload bàn giao chuẩn theo schema nghiêm ngặt (`agent-handoff.schema.json`).
- **Business Rules**:
  - Bắt buộc các trường: `run_id`, `summary`, `changed_files` (mảng >= 1 phần tử), `tests` (mảng >= 1 phần tử với `command`, `status`, `summary`).
  - Tùy chọn: `commit_sha`, `pull_request_url`, `blockers`.
  - Nghiêm cấm trường không xác định (`additionalProperties: false`).
- **Linked Task / Epic**: `TASK-HAND-01` (Strict Handoff Schema)
- **Source Paths**: [`agent-handoff.schema.json`](file:///d:/Work/task-hub/packages/contracts/schemas/agent-handoff.schema.json), [`diffHandoff.ts`](file:///d:/Work/task-hub/apps/desktop/src/utils/diffHandoff.ts)

#### `FR-15: Auto-Transition to Review & Evidence Storage`
- **Mô tả**: Nộp handoff thành công sẽ tự động chuyển Task sang `status = 'review'` và lưu bằng chứng kiểm thử vào bảng `verification_evidences`.
- **Business Rules**:
  - Lưu kết quả test (passed/failed), command đã chạy, commit SHA và artifact URL.
  - Tự động kích hoạt thông báo cho Reviewer.
- **Linked Task / Epic**: `TASK-HAND-02` (Evidence Storage & Status Transition)
- **Source Paths**: [`ApiAgentRunController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiAgentRunController.php#L540)

#### `FR-16: Human Reviewer Approval & Change Request (Reject)`
- **Mô tả**: Reviewer trên Web Hub thẩm định Task trong trạng thái `review`.
- **Business Rules**:
  - **Approve**: Đánh dấu `status = 'done'`, ghi nhận `completed_at = now()`, lưu audit `task_approved`.
  - **Request Changes / Reject**: Chuyển task về `in_progress` hoặc `todo`, bắt buộc kèm lý do/ghi chú phản hồi, lưu audit `task_rejected`.
- **Linked Task / Epic**: `TASK-HAND-03` (Reviewer Workflow)
- **Source Paths**: [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php#L161), [`TaskDrawer.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/TaskDrawer.vue)

---

### Module 6: E2E Task History Audit Trail & Actor Attribution

#### `FR-17: Comprehensive E2E History Aggregation`
- **Mô tả**: Thu thập và hợp nhất mọi sự kiện lịch sử của Task từ 3 nguồn: `TaskUsageEvent`, `AgentRun`, `VerificationEvidence`.
- **Business Rules**:
  - Sắp xếp theo thứ tự thời gian (`occurred_at` desc/asc).
  - Thống kê: `total_events`, `total_transitions`, `current_handler`, `actors_involved`.
- **Linked Task / Epic**: `TASK-AUDIT-01` (E2E History Service)
- **Source Paths**: [`TaskHistoryService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/TaskHistoryService.php)

#### `FR-18: Multi-Type Actor Attribution & Badging`
- **Mô tả**: Phân loại và gán nhãn danh tính cho mọi thực thể tác động lên Task.
- **Actor Categories**:
  - `user`: Con người (Developer, Reviewer, Approver).
  - `agent_runner`: Desktop Runner hoặc Headless Daemon.
  - `agent_model`: Mô hình LLM (Codex, Claude).
  - `github_ci`: Webhook CI/CD từ GitHub.
  - `system`: Cronjob, scheduler, hệ thống tự động.
- **Linked Task / Epic**: `TASK-AUDIT-02` (Actor Attribution Engine)
- **Source Paths**: [`TaskHistoryTimeline.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/TaskHistoryTimeline.vue)

#### `FR-19: 1-Click Markdown Audit Report Export`
- **Mô tả**: Cho phép xuất toàn bộ dòng thời gian và bằng chứng kiểm thử ra định dạng Markdown chỉ với 1 click.
- **Business Rules**:
  - Định dạng chuẩn Markdown có header, bảng tóm tắt, danh sách actor và chi tiết từng bước.
  - Sao chép trực tiếp vào Clipboard với thông báo xác nhận.
- **Linked Task / Epic**: `TASK-AUDIT-03` (Markdown Audit Export)
- **Source Paths**: [`TaskHistoryTimeline.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/TaskHistoryTimeline.vue#L165)

---

### Module 7: AI Requirement Discovery & Backlog Generator (HITL)

#### `FR-20: AI Codebase & Docs Exploration`
- **Mô tả**: Phân tích yêu cầu thô từ người dùng bằng cách đọc hiểu mã nguồn và tài liệu trong worktree cô lập.
- **Business Rules**:
  - Không chỉnh sửa code ứng dụng, không commit, không push.
  - Đề xuất cấu trúc: 1 Epic, nhiều User Stories, các Task thực thi cụ thể, Story Points Fibonacci, Tiêu chí nghiệm thu (Acceptance Criteria).
- **Linked Task / Epic**: `TASK-REQ-01` (AI Discovery Engine)
- **Source Paths**: [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue#L205), [`discoveryPlan.ts`](file:///d:/Work/task-hub/apps/desktop/src/utils/discoveryPlan.ts)

#### `FR-21: Strictly Local Proposal Draft & Revision Loop`
- **Mô tả**: Đề xuất Backlog hoàn toàn nằm ở local cho đến khi con người phê duyệt.
- **Business Rules**:
  - Người dùng có thể bấm **Edit draft** để tự sửa trực tiếp.
  - Người dùng có thể bấm **Request revision** kèm prompt phản hồi để AI viết lại.
  - Chỉ khi bấm **Approve & create backlog** và xác nhận modal, hệ thống mới gọi API Task Hub để tạo Epic & Tasks.
- **Linked Task / Epic**: `TASK-REQ-02` (Proposal Review & Revision)
- **Source Paths**: [`WorkflowPanel.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/control-center/WorkflowPanel.vue#L23)

---

### Module 8: Model Context Protocol (MCP) Server

#### `FR-22: Standardized MCP JSON-RPC 2.0 API`
- **Mô tả**: Cung cấp bộ công cụ MCP chuẩn để AI Agent có thể giao tiếp hai chiều với Task Hub.
- **Danh sách MCP Tools**:
  - `get_work_item_context`: Đọc ngữ cảnh nhiệm vụ và tài liệu liên quan.
  - `list_tasks`: Tra cứu danh sách task theo bộ lọc.
  - `update_task_status`: Cập nhật trạng thái task.
  - `start_agent_run`: Đăng ký bắt đầu phiên chạy của agent.
  - `complete_agent_handoff`: Gửi báo cáo bàn giao kèm bằng chứng kiểm thử.
  - `get_task_history`: Tra cứu lịch sử E2E và actor timeline của task.
  - `create_requirement_backlog`: Tạo 1 Epic và danh sách Task liên kết từ bản thảo discovery đã duyệt.
  - `read_project_document`: Đọc nội dung tài liệu dự án.
  - `get_project_knowledge_state`: Lấy trạng thái tổng thể của kho tri thức dự án.
- **Linked Task / Epic**: `TASK-MCP-01` (Task Hub MCP Server)
- **Source Paths**: [`TaskHubMcpController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php)

---

## 4. Traceability Matrix (Ma Trận Truy Vết Yêu Cầu & Task Linkage)

| Req ID | Tên Yêu Cầu Chức Năng | Phân Hệ / Module | Vai Trò Chính | Trạng Thái | Linked Task Key | Implementation File / Controller | Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Multi-Tenant Workspace Isolation | Multi-Tenancy | Admin / Owner | `DONE` | `TASK-WS-01` | [`WorkspaceContext.php`](file:///d:/Work/task-hub/apps/hub/app/Services/WorkspaceContext.php) | `SaasTenantIsolationTest.php` |
| **FR-02** | Desktop Companion Pairing | Multi-Tenancy | Developer | `DONE` | `TASK-DESK-01` | [`DesktopPairingController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/DesktopPairingController.php) | `DesktopAgentRuntimeTest.test.ts` |
| **FR-03** | Hierarchical Work Items | Work Management | PO / Dev | `DONE` | `TASK-CORE-01` | [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php) | `TaskE2EHistoryAuditTest.test.ts` |
| **FR-04** | Task Lifecycle State Machine | Work Management | Developer / PO | `DONE` | `TASK-CORE-02` | [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php#L161) | `UiButtonWorkflowE2ETest.test.ts` |
| **FR-05** | Task Dependency Guardrail | Work Management | Dev / Lead | `DONE` | `TASK-CORE-03` | [`Task.php`](file:///d:/Work/task-hub/apps/hub/app/Models/Task.php#L72) | `TaskE2EHistoryAuditTest.test.ts` |
| **FR-06** | Sprint Lifecycle & Velocity | Work Management | Product Owner | `DONE` | `TASK-CORE-04` | [`ApiSprintController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiSprintController.php) | `RoadmapProjectManagementTest.test.ts` |
| **FR-07** | Manifest Document Catalog | Knowledge Base | Tech Lead | `DONE` | `TASK-DOC-01` | [`ProjectKnowledgeService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/ProjectKnowledgeService.php) | `ProjectDocumentsWorkflowE2ETest.test.ts` |
| **FR-08** | 30-Day Staleness Detection | Knowledge Base | System / QA | `DONE` | `TASK-DOC-02` | [`ProjectDocument.php`](file:///d:/Work/task-hub/apps/hub/app/Models/ProjectDocument.php#L25) | `ProjectDocumentsPanelTest.test.ts` |
| **FR-09** | Preflight Context Ingestion | Knowledge Base | AI Agent | `DONE` | `TASK-DOC-03` | [`TaskHubContextPackService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/TaskHubContextPackService.php) | `TaskHubAgentWorkflowTest.php` |
| **FR-10** | Instant Action Feedback & SFX | Desktop App | Developer | `DONE` | `TASK-UX-01` | [`useActionFeedback.ts`](file:///d:/Work/task-hub/apps/desktop/src/composables/useActionFeedback.ts) | `ControlCenterActionFeedback.test.ts` |
| **FR-11** | Git Worktree Isolation | Desktop App | AI Agent | `DONE` | `TASK-DESK-02` | [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue#L75) | `roadmap_feasibility_challenge.test.ts` |
| **FR-12** | Policy Escalation & Human Approval | Desktop App | Developer | `DONE` | `TASK-DESK-03` | [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue#L90) | `UserInTheLoopE2E.test.ts` |
| **FR-13** | Bidirectional Follow-Up Stream | Desktop App | Developer | `DONE` | `TASK-DESK-04` | [`RunWorkspace.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/control-center/RunWorkspace.vue) | `UserInTheLoopE2E.test.ts` |
| **FR-14** | Strict Handoff JSON Schema | Review / Handoff | AI Agent | `DONE` | `TASK-HAND-01` | [`agent-handoff.schema.json`](file:///d:/Work/task-hub/packages/contracts/schemas/agent-handoff.schema.json) | `diffHandoff.test.ts` |
| **FR-15** | Evidence Storage & Review Transition | Review / Handoff | AI Agent / Hub | `DONE` | `TASK-HAND-02` | [`ApiAgentRunController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiAgentRunController.php) | `testEvidence.test.ts` |
| **FR-16** | Reviewer Approval / Request Changes | Review / Handoff | Reviewer / Lead | `DONE` | `TASK-HAND-03` | [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php#L161) | `UserInTheLoopE2ETest.test.ts` |
| **FR-17** | E2E History Aggregation | Audit Trail | Tech Lead / PO | `DONE` | `TASK-AUDIT-01` | [`TaskHistoryService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/TaskHistoryService.php) | `TaskE2EHistoryAuditTest.test.ts` |
| **FR-18** | Multi-Type Actor Attribution | Audit Trail | All Users | `DONE` | `TASK-AUDIT-02` | [`TaskHistoryTimeline.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/TaskHistoryTimeline.vue) | `TaskE2EHistoryAuditTest.test.ts` |
| **FR-19** | 1-Click Markdown Audit Export | Audit Trail | Tech Lead | `DONE` | `TASK-AUDIT-03` | [`TaskHistoryTimeline.vue`](file:///d:/Work/task-hub/apps/hub/resources/js/Components/tasks/TaskHistoryTimeline.vue#L165) | `TaskE2EHistoryAuditTest.test.ts` |
| **FR-20** | AI Codebase Discovery | Requirement AI | Product Owner | `DONE` | `TASK-REQ-01` | [`discoveryPlan.ts`](file:///d:/Work/task-hub/apps/desktop/src/utils/discoveryPlan.ts) | `discoveryPlan.test.ts` |
| **FR-21** | Strictly Local Proposal Review | Requirement AI | Product Owner | `DONE` | `TASK-REQ-02` | [`WorkflowPanel.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/control-center/WorkflowPanel.vue) | `WorkflowPanelReview.test.ts` |
| **FR-22** | MCP Protocol Implementation | MCP Server | AI Agent / Tools | `DONE` | `TASK-MCP-01` | [`TaskHubMcpController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php) | `UserInTheLoopE2ETest.test.ts` |

---

## 5. Non-Functional & Operational Requirements (NFR)

1. **Security & Redaction**:
   - Tự động lọc bỏ các chuỗi nhạy cảm (Bearer tokens, GitHub personal access tokens, AWS keys, database passwords) khỏi tất cả log stream và output.
2. **Sandbox Safety & Fail-Closed**:
   - Các lệnh nguy hiểm (`rm -rf /`, `DROP TABLE`, `git push --force`) bị chặn đứng tự động.
   - Bộ đếm thời gian 15-minute fail-closed timeout ngăn chặn việc agent bị treo hoặc chạy ngoài tầm kiểm soát.
3. **High Performance & Low Latency**:
   - Lightweight SSE streaming cho live log với độ trễ < 100ms.
   - Phản hồi UI tức thì (Instant optimistic UI updates) trên cả Desktop và Web.
4. **Data Integrity & Traceability**:
   - Không có bất kỳ thay đổi trạng thái nào của Task bị ẩn danh; 100% thay đổi đều gắn kèm danh tính Actor và mốc thời gian ISO 8601.

---

## 6. Verification & Test Strategy

Mọi Functional Requirement trong tài liệu này đều được kiểm chứng tự động thông qua **789 Unit, Component, Integration và E2E tests** trong toàn bộ monorepo:
- **`apps/hub`**: 624 tests (4-Tier Unified E2E Test Runner).
- **`apps/desktop`**: 163 tests (Vitest Suite).
- **`apps/runner`**: 2 tests (Node Test Runner).
- Tỷ lệ pass: **100% (789/789 passed)**.
