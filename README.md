# Task Hub ⚡

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-blue)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)]()
[![Laravel](https://img.shields.io/badge/laravel-11.x-red.svg)]()
[![Electron](https://img.shields.io/badge/electron-34.x-47848F.svg)]()
[![Vue](https://img.shields.io/badge/vue-3.5.x-4FC08D.svg)]()

> **Task Hub** là nền tảng quản trị công việc và điều phối Supervised AI Coding Agents mã nguồn mở. Kết hợp quản lý dự án, tài liệu kỹ thuật ngữ cảnh cao (Context Packs), tích hợp giao thức MCP (Model Context Protocol), và ứng dụng desktop **Task Companion** điều phối thực thi cục bộ với **Antigravity 2.0**, **Codex**, và **Claude Code**.

---

## 🏛️ Kiến trúc tổng thể (Architecture)

```mermaid
graph TD
    User([Người dùng / Product Team]) -->|Browser| Hub[Task Hub Web / REST API & MCP]
    User -->|Desktop GUI| Companion[Task Companion Desktop App]

    subgraph Server ["Task Hub Server (Laravel 11 + Inertia/Vue)"]
        Hub --> DB[(PostgreSQL)]
        Hub --> Cache[(Redis / Queue)]
        Hub --> MCPGateway[MCP Gateway 2024-11-05]
    end

    subgraph Desktop ["Local Client (Electron + Vue 3 + Tailwind)"]
        Companion --> DevicePairing[Device Pairing & Approval]
        Companion --> AgentConsole[Supervised Agent Console]
        Companion --> MarkdownEngine[Enhanced Markdown & Mermaid Viewer]
        Companion --> MindfulMascot[Zen & Productivity Mascot Stage]
    end

    DevicePairing <-->|Secure Token / SSE| MCPGateway

    subgraph LocalAgents ["Local AI Coding Agents"]
        AgentConsole -->|CLI Stdin/Stdout| Codex[Codex CLI]
        AgentConsole -->|CLI Stdin/Stdout| Claude[Claude Code]
        AgentConsole -->|Workspace Pairing & Clipboard| Antigravity[Antigravity 2.0 IDE]
    end
```

---

## 📂 Cấu trúc Repository (Workspaces)

- **`apps/hub`** — Máy chủ web Laravel 11 + Inertia/Vue 3, cung cấp REST API, MCP Server, xác thực GitHub OAuth và quản lý Sprint/Project.
- **`apps/desktop`** — Ứng dụng desktop Electron (Windows) hỗ trợ giám sát Agent Console, kết nối Antigravity IDE, Pomodoro, Mascot đồng hành và hiển thị Markdown phong phú.
- **`packages/contracts`** — Hợp đồng đặc tả giao tiếp versioned OpenAPI (`task-hub.openapi.yaml`) và JSON Schemas.
- **`infra/docker`** — Cấu hình triển khai tự lưu trữ (Self-hosted) gồm PostgreSQL, Redis, Nginx, PHP-FPM worker và scheduler.
- **`docs/`** — Tài liệu kỹ thuật chi tiết về quy trình Request Discovery, kiến trúc hệ thống, QA plan và runbooks.

---

## 🚀 Hướng dẫn khởi chạy nhanh (Quick Start)

### 1. Khởi chạy Máy chủ Task Hub (Docker)

```bash
# Thiết lập biến môi trường
cp apps/hub/.env.example apps/hub/.env

# Khởi chạy cụm dịch vụ qua Docker Compose
docker compose -f infra/docker/compose.yml up -d --build

# Chạy migration cơ sở dữ liệu
docker compose -f infra/docker/compose.yml exec hub php artisan migrate --force
```

Truy cập Hub tại `http://localhost:8080`.

### 2. Khởi chạy Ứng dụng Desktop (Task Companion)

```powershell
# Cài đặt dependencies tại thư mục gốc
npm install

# Khởi chạy chế độ phát triển Desktop
npm --workspace apps/desktop run dev

# Đóng gói bộ cài đặt Windows (.exe)
npm --workspace apps/desktop run build:vue
npm --workspace apps/desktop run build
```

---

## 🤖 Điều phối Local AI Agents

Ứng dụng **Task Companion** cho phép kết nối trực tiếp với các công cụ AI coding đã cài sẵn trên máy mà **không cần cấu hình API key mô hình trên Hub server**:

1. **Antigravity 2.0 IDE:** Tự động thiết lập cấu hình MCP `.agents/mcp_config.json` vào workspace repository, nạp context pack và đồng bộ verification evidence.
2. **Codex CLI / Claude Code:** Mở phiên làm việc độc lập trong thư mục được cô lập, stream output thời gian thực và quản lý lifecycle task.

```powershell
# Đảm bảo các CLI có sẵn trong PATH nếu dùng provider tương ứng:
codex --version
claude --version
agy --version
```

---

## 📝 Khả năng Markdown & Biểu đồ nâng cao

Hệ thống hỗ trợ chuẩn Markdown GFM tối ưu với:
- **GitHub Alerts:** `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` với icon và giao diện trực quan.
- **GFM Task Lists:** Danh sách công việc dạng checkbox `- [ ]` và `- [x]`.
- **Diff Highlighting:** Tô màu trực quan các dòng thêm (`+`) và xóa (`-`).
- **Mermaid Diagrams:** Dựng sơ đồ luồng dữ liệu, kiến trúc và sequence diagrams trực tiếp.

---

## 📄 Bản quyền & Giấy phép (License)

Dự án được phân phối theo giấy phép mã nguồn mở **Apache License, Version 2.0**.
Bản quyền thuộc về **Copyright 2026 Ma Cà Tưng (macatung.dev)**.

Xem chi tiết tại [LICENSE](LICENSE) và [NOTICE](NOTICE).

---

## 🤝 Đóng góp & Bảo mật

- **Đóng góp:** Xem [CONTRIBUTING.md](CONTRIBUTING.md) và [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Chính sách bảo mật:** Xem [SECURITY.md](SECURITY.md) hoặc gửi báo cáo trực tiếp đến `security@macatung.dev`.
- **Kế hoạch phát triển:** Xem [docs/ROADMAP.md](docs/ROADMAP.md).
