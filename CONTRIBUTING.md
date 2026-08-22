# Contributing to Task Hub

Cảm ơn bạn đã quan tâm đến việc đóng góp cho **Task Hub**! Chúng tôi hoan nghênh mọi đóng góp từ cộng đồng nhằm cải thiện nền tảng quản trị công việc và điều phối AI Agent.

---

## 📜 Giấy phép đóng góp (Contributor License Agreement)

Task Hub là dự án mã nguồn mở được phát hành theo giấy phép **Apache License, Version 2.0**.
Bằng việc gửi Pull Request hoặc đóng góp mã nguồn/tài liệu cho dự án, bạn đồng ý rằng mọi đóng góp của bạn sẽ được cấp phép theo các điều khoản của Apache 2.0 (theo Mục 5 của Giấy phép).

---

## 🛠️ Quy trình phát triển & Đóng góp

### 1. Phân nhánh & Chuẩn bị
- Fork repository và tạo một branch riêng biệt cho tính năng hoặc bản sửa lỗi của bạn:
  ```bash
  git checkout -b feat/ten-tinh-nang
  # hoặc
  git checkout -b fix/ten-loi
  ```

### 2. Tiêu chuẩn mã nguồn & Kiểm thử
- Dự án sử dụng mô hình monorepo (`npm workspaces` kết hợp `apps/hub`, `apps/desktop`, `apps/runner`, `packages/contracts`).
- Luôn chạy kiểm thử trước khi tạo Pull Request:
  ```powershell
  # Kiểm tra tính hợp lệ của API Contracts
  npm run contracts:validate

  # Chạy test suite ứng dụng Desktop
  npm --workspace apps/desktop run test

  # Chạy test suite của Hub Server (nếu có thay đổi trong apps/hub)
  docker compose -f infra/docker/compose.yml exec hub php artisan test
  ```

### 3. Cập nhật Hợp đồng API (API Contracts)
- Nếu thay đổi của bạn liên quan đến public REST API hoặc giao thức MCP (`2024-11-05`), bạn **bắt buộc** phải cập nhật file đặc tả tại `packages/contracts/task-hub.openapi.yaml` và các JSON schemas tương ứng.
- Đảm bảo `node packages/contracts/validate.mjs` vượt qua kiểm tra 100%.

### 4. Bảo mật & Dữ liệu nhạy cảm
- **Tuyệt đối không** commit các file cấu hình chứa bí mật (`.env`, `.agents/mcp_config.json` có token thật, credentials, OAuth tokens hoặc webhook secrets).
- Không đưa dữ liệu cá nhân hay dữ liệu production vào mock data/test cases.

---

## 📬 Tạo Pull Request

1. Mô tả rõ ràng mục đích của thay đổi, vấn đề được giải quyết và các bước kiểm chứng.
2. Đính kèm liên kết đến Issue liên quan nếu có.
3. Đội ngũ maintainers của **Ma Cà Tưng (macatung.dev)** sẽ xem xét và phản hồi trong thời gian sớm nhất.
