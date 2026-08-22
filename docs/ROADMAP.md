# Public Roadmap 🗺️

Lộ trình phát triển công khai của nền tảng **Task Hub** và ứng dụng **Task Companion**.

---

## 🎯 Phiên bản v1.0 (Hiện tại)

- [x] **Core Hub Architecture:** Máy chủ tự lưu trữ Laravel 11 với PostgreSQL, Redis, xác thực GitHub OAuth, quản lý Workspace, Project, Sprint, Task và Context Packs.
- [x] **Versioned API & MCP Server:** Giao thức chuẩn hóa REST API `v1` và MCP `2024-11-05` với cơ chế ghép nối thiết bị an toàn (Device Pairing).
- [x] **Task Companion Desktop Client:** Ứng dụng Electron hỗ trợ điều phối AI Coding Agent đa provider (**Antigravity 2.0**, **Codex**, **Claude Code**).
- [x] **Request Discovery & Planning Engine:** Bộ công cụ AI tự động phân rã yêu cầu thành Epic, User Stories và Tasks có thể thực thi.
- [x] **Rich Markdown & Mermaid Engine:** Trình hiển thị Markdown tối ưu với GitHub Alerts, GFM Task Lists, Diff Highlighting và sơ đồ Mermaid trực quan.
- [x] **Giấy phép mã nguồn mở:** Chuyển đổi toàn diện sang **Apache License 2.0**.

---

## 🚀 Phiên bản v1.1 (Sắp ra mắt)

- [ ] **Multi-provider Source Control:** Bổ sung adapter cho GitLab và Bitbucket bên cạnh GitHub.
- [ ] **Tích hợp Issue Tracker nâng cao:** Đồng bộ hai chiều với Jira, Linear và GitHub Issues.
- [ ] **Server-side Runner Sandbox:** Chế độ thực thi agent cô lập trên máy chủ dành cho các tác vụ tự động hóa CI/CD.
- [ ] **Advanced Agent Analytics:** Bảng thống kê chi tiết về thời gian chạy, token tiêu thụ và độ chính xác bàn giao của AI Agent.

---

## 🔮 Tương lai (Future Milestones)

- [ ] Hỗ trợ Multi-Agent Collaboration (hợp tác nhiều agent cùng phân chia và giải quyết một Epic).
- [ ] Mở rộng hệ sinh thái Custom Skills và Plugins cho Antigravity IDE.
- [ ] Nền tảng Managed Cloud / Hosted SaaS cho doanh nghiệp.
