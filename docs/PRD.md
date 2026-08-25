# Task Hub Product Requirements Document (PRD)

**Version**: 2.0.0  
**Status**: Production / Operational  
**Standard**: `task-hub-docs-v1`  
**Last Updated**: 2026-08-25  
**Canonical Manifest**: [`docs/PROJECT_DOCUMENTS.md`](file:///d:/Work/task-hub/docs/PROJECT_DOCUMENTS.md)  
**Detailed Functional Specs**: [`docs/FRD.md`](file:///d:/Work/task-hub/docs/FRD.md)

---

## 1. Product Purpose & Objective

Task Hub là nền tảng quản trị công việc và điều phối tác tử AI (Human-in-the-Loop AI Orchestration & Work Management Platform). Hệ thống giải quyết bài toán:
1. **Kiểm soát AI Agent trong phát triển phần mềm**: Ngăn chặn Agent chạy mất kiểm soát, phá hoại mã nguồn hoặc tự ý thay đổi dữ liệu mà không có sự đồng thuận của con người.
2. **Minh bạch hóa tiến độ & lịch sử E2E**: Mọi bước chuyển trạng thái, lệnh chạy, bằng chứng kiểm thử (Verification Evidence) đều được ghi nhận danh tính người/agent thực hiện (`Actor Attribution`).
3. **Chuẩn hóa tri thức dự án**: Kho tài liệu kỹ thuật (`docs/`) tự động cập nhật, theo dõi tính tươi mới và cung cấp Context Pack đầy đủ cho Agent trước khi thực thi.

---

## 2. Target Personas & Primary Use Cases

- **Product Owner (PO)**: Khởi tạo yêu cầu thô ➔ AI phân tích codebase và đề xuất Backlog ➔ PO chỉnh sửa bản thảo ➔ PO bấm duyệt để tạo Epic & Tasks trên Hub.
- **Developer / Operator**: Chọn Task trên Desktop Control Center ➔ Chọn AI Provider (Codex / Claude) & Sandbox Policy ➔ Khởi chạy Agent trong Git worktree cô lập ➔ Tương tác theo dõi live stream và gửi prompt bổ sung ➔ Nộp Handoff bàn giao.
- **Tech Lead / Reviewer**: Nhận thông báo Task chuyển sang `review` ➔ Kiểm tra diff file, bằng chứng test, và actor audit trail ➔ Bấm **Approve** (hoàn tất task) hoặc **Request Changes** (trả về kèm feedback).
- **QA Lead**: Quản lý QA Plan, cấu hình test command tự động, xác minh bằng chứng kiểm thử.

---

## 3. Product Scope & Functional Modules Overview

Hệ thống bao gồm 8 phân hệ chức năng chính (Xem chi tiết kỹ thuật từng requirement tại [`docs/FRD.md`](file:///d:/Work/task-hub/docs/FRD.md)):

1. **Workspace & Multi-Tenancy**: Phân vùng dữ liệu an toàn theo Workspace, phân quyền người dùng và ghép nối Desktop Companion qua mã pairing.
2. **Agile Work Item Management**: Quản lý Epic, Story, Task, Bug; Sprint burndown; DAG Task Dependencies và thuật toán Next Action.
3. **Project Knowledge & Document Engine**: Bảng Manifest `docs/PROJECT_DOCUMENTS.md`, phát hiện tài liệu cũ (`is_stale > 30 days`), cảnh báo thiếu tài liệu lõi và tự động đóng gói Context Pack.
4. **Desktop Control Center**: Điều phối Agent cục bộ trong Git worktree cô lập, hệ thống phản hồi thao tác tức thì (Instant Toast & Audio SFX), cấp quyền sandbox linh hoạt.
5. **Structured Handoff & Evidence**: Hợp đồng JSON Schema nghiêm ngặt cho bàn giao mã nguồn và bằng chứng kiểm thử tự động.
6. **E2E Task History & Actor Attribution**: Dòng thời gian sự kiện toàn diện, phân định rõ con người (`user`) vs AI (`agent_runner`/`agent_model`), xuất báo cáo Markdown 1-click.
7. **AI Requirement Discovery**: Chuyển đổi yêu cầu ngôn ngữ tự nhiên thành Backlog Agile với quy trình duyệt bản thảo cục bộ 100% trước khi tạo task.
8. **Model Context Protocol (MCP) Server**: Cung cấp 9 công cụ MCP chuẩn giúp AI Agents tương tác với Task Hub qua JSON-RPC 2.0.

---

## 4. Operational Workflows (Vận Hành Thực Tế)

### Flow 1: Vòng Đời Thực Thi Nhiệm Vụ (Task Execution Lifecycle)
```
[Todo] ➔ [Select Task & Worktree] ➔ [Agent Running] ➔ [Pass Test & Handoff] ➔ [Review] ➔ [Tech Lead Approve] ➔ [Done]
                                          │                                      │
                                    (Sandbox Block)                      (Changes Requested)
                                          │                                      │
                                 [Human Approval Card]                     [Back to In Progress]
```

### Flow 2: Vòng Đời Cập Nhật Tài Liệu Kỹ Thuật (Document Freshness Flow)
```
[Codebase Changes] ➔ [AI Docs Scanner] ➔ [Review 6 Docs] ➔ [Save to Repo] ➔ [Sync to Hub] ➔ [Fresh Context Injected]
```

---

## 5. Traceability & Task Alignment

Mọi yêu cầu chức năng (FR-01 đến FR-22) trong PRD & FRD đều được liên kết trực tiếp với mã nguồn và kiểm chứng bởi **789 automated tests**:

| Module | Range Yêu Cầu | Mã Nguồn Đại Diện | Test Suite Đại Diện |
| :--- | :--- | :--- | :--- |
| Work Management | `FR-01` -> `FR-06` | [`ApiTaskController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiTaskController.php), [`Task.php`](file:///d:/Work/task-hub/apps/hub/app/Models/Task.php) | `UiButtonWorkflowE2ETest.test.ts` |
| Document System | `FR-07` -> `FR-09` | [`ProjectKnowledgeService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/ProjectKnowledgeService.php) | `ProjectDocumentsWorkflowE2ETest.test.ts` |
| Desktop App | `FR-10` -> `FR-13` | [`ControlCenter.vue`](file:///d:/Work/task-hub/apps/desktop/src/views/ControlCenter.vue), [`useActionFeedback.ts`](file:///d:/Work/task-hub/apps/desktop/src/composables/useActionFeedback.ts) | `ControlCenterActionFeedback.test.ts` |
| Handoff & Review | `FR-14` -> `FR-16` | [`ApiAgentRunController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/ApiAgentRunController.php) | `diffHandoff.test.ts` |
| History & Audit | `FR-17` -> `FR-19` | [`TaskHistoryService.php`](file:///d:/Work/task-hub/apps/hub/app/Services/TaskHistoryService.php) | `TaskE2EHistoryAuditTest.test.ts` |
| AI Discovery | `FR-20` -> `FR-21` | [`WorkflowPanel.vue`](file:///d:/Work/task-hub/apps/desktop/src/components/control-center/WorkflowPanel.vue) | `WorkflowPanelReview.test.ts` |
| MCP Protocol | `FR-22` | [`TaskHubMcpController.php`](file:///d:/Work/task-hub/apps/hub/app/Http/Controllers/Api/TaskHubMcpController.php) | `UserInTheLoopE2ETest.test.ts` |

---

## 6. Success Metrics & Non-Functional Criteria

1. **Zero Unsupervised Data Mutation**: 100% các thao tác thay đổi Backlog và quyền hệ thống đều phải thông qua phê duyệt của con người.
2. **100% Audit Coverage**: 100% các lượt chuyển đổi trạng thái của Task đều lưu kèm danh tính Actor và mốc thời gian ISO 8601.
3. **Automated Verification Reliability**: 100% các lượt bàn giao đều có bằng chứng kiểm thử (Verification Evidence) được lưu trữ và có thể kiểm chứng lại.
4. **Continuous Test Health**: 789/789 test cases chạy pass 100% trong CI/CD pipeline.
