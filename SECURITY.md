# Security Policy

Bảo mật là ưu tiên hàng đầu của dự án **Task Hub**. Chúng tôi cam kết tiếp nhận, xử lý và khắc phục các vấn đề bảo mật một cách nhanh chóng và có trách nhiệm.

---

## 🛡️ Các phiên bản được hỗ trợ (Supported Versions)

Chúng tôi cung cấp các bản vá bảo mật cho các nhánh/phiên bản phát hành chính thức mới nhất:

| Thành phần | Phiên bản hỗ trợ | Tình trạng |
| :--- | :--- | :--- |
| **Task Hub Server** (`apps/hub`) | `1.x` (Latest) | :white_check_mark: Được hỗ trợ |
| **Task Companion Desktop** (`apps/desktop`) | `1.x` (Latest) | :white_check_mark: Được hỗ trợ |
| **API Contracts** (`packages/contracts`) | `v1` | :white_check_mark: Được hỗ trợ |

---

## 🚨 Báo cáo lỗ hổng bảo mật (Reporting a Vulnerability)

Nếu bạn phát hiện một lỗ hổng bảo mật tiềm ẩn trong Task Hub, xin vui lòng **KHÔNG tạo Issue công khai trên GitHub**. Thay vào đó, hãy thực hiện theo một trong hai kênh sau:

1. **Email bảo mật trực tiếp:** Gửi thông tin chi tiết tới **`security@macatung.dev`**.
2. **GitHub Security Advisories:** Gửi báo cáo bảo mật riêng tư thông qua tính năng [Private Vulnerability Reporting](https://github.com/macatung/task-hub/security/advisories/new) của repository.

### Thông tin cần cung cấp trong báo cáo:
- Loại lỗ hổng và phạm vi ảnh hưởng (Hub server, Desktop client, Device pairing hoặc MCP Protocol).
- Các bước chi tiết để tái hiện lỗ hổng (kèm mã khai thác PoC hoặc cấu hình mẫu nếu có).
- Bất kỳ giải pháp khắc phục đề xuất nào (nếu có).

> [!CAUTION]
> **Không gửi bí mật thực tế:** Tuyệt đối không đính kèm file database dump thật, OAuth tokens, mật khẩu, file `.env` hoặc access tokens cá nhân trong báo cáo.

---

## ⏱️ Quy trình xử lý và phản hồi

1. **Tiếp nhận:** Đội ngũ duy trì sẽ xác nhận tiếp nhận báo cáo trong vòng **48 giờ làm việc**.
2. **Thẩm định & Khắc phục:** Đánh giá mức độ nghiêm trọng (CVSS), phát triển bản vá và kiểm thử trong môi trường cô lập.
3. **Phát hành & Công bố:** Phát hành bản vá trên nhánh chính và cung cấp thông báo bảo mật (Security Advisory) ghi nhận đóng góp của nhà nghiên cứu.
