# ⚡ Task Companion — Desktop App (Windows)

Ứng dụng mascot desktop chạy lơ lửng trên Windows, tập trung vào quản lý task, productivity và kết nối AI agent.

---

## ✨ Tính Năng Nổi Bật

1. **Cửa Sổ Trong Suốt Lơ Lửng (Frameless Transparent Window)**:
   - Mascot bay bổng trên màn hình với nền trong suốt tuyệt đối 100%.
   - Kéo thả tự do (`Drag & Drop`) tới bất kỳ góc màn hình nào bạn thích.
   - Luôn ở trên cùng (`Always-on-Top`) để bạn không bỏ lỡ những khoảnh khắc chánh niệm.

2. **Task workspace**: task dispatch, Pomodoro, review, quick notes và debug.

3. **AI Agent Workspace**: kết nối Codex, Antigravity và Claude Code; cấu hình MCP Task Hub cho workspace.

4. **Khay hệ thống**: mở mascot, task dispatch, agent workspace, Pomodoro, review và Task Hub.

5. **Agent Workspace**:
   - Mở console từ `Tasks → Agent` để làm việc với Codex, Claude Code hoặc Antigravity.
   - Với Codex/Claude Code, chọn thư mục repository, mở một phiên CLI và gửi prompt/lệnh qua stdin; output được stream trực tiếp về desktop app.
   - Với Antigravity 2.0 desktop, app mở `Antigravity.exe` vào workspace đã chọn và copy prompt vào clipboard để dán vào Agent panel. Bản desktop không expose `agy` stdin/stdout API.
   - Agent Workspace bắt buộc chọn đúng một task đang mở từ Task Hub production; task không có project không thể chạy.
   - App dùng device pairing với GitHub approval, tự lấy context pack, tạo `agent_run`, cấu hình MCP và truyền contract vào agent.

   Các CLI cần có sẵn trong `PATH` của Windows:

   ```powershell
   codex --version
   claude --version
   agy --version
   ```

   Agent bridge chỉ cho phép ba provider trên và chạy trong thư mục mà người dùng chọn. Không nhập token vào prompt; hãy đăng nhập/authenticate từng CLI theo hướng dẫn riêng của chúng.

   Với Antigravity IDE, chọn provider `Antigravity` và workspace, sau đó approve project trong browser khi app yêu cầu. Không cần nhập Project ID hay MCP token thủ công. App sẽ tạo hoặc cập nhật:

   ```text
   <workspace>/.agents/mcp_config.json
   ```

   Sau đó mở workspace này trong Antigravity IDE. Trong IDE, kiểm tra MCP ở `Settings → Customizations → Installed MCP Servers`; agent có thể dùng các tool `task-hub` để đọc task, lấy context pack, ghi lifecycle và đính verification evidence. Token chỉ tồn tại trong pairing response/config local và không được đưa vào prompt hoặc log.

6. **Auto-update**:
   - Bản đã cài tự kiểm tra GitHub Releases sau khi khởi động và định kỳ mỗi 6 giờ.
   - Update được tải nền; app chỉ restart khi người dùng bấm `Khởi động lại và cập nhật`.
   - Release chính thức dùng tag `desktop-v<version>`, ví dụ `desktop-v1.0.1`.

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Chạy thử nghiệm chế độ Development:
```powershell
cd d:\Work\macatung\desktop
npm run dev
```

### 2. Đóng gói ứng dụng Windows (.exe):
```powershell
cd d:\Work\macatung\desktop
npm run build
```
File cài đặt `.exe` sẽ được tạo tự động trong thư mục `desktop/dist/`.

### 3. Phát hành bản cập nhật Windows

Tăng version trong `desktop/package.json`, commit thay đổi rồi tạo tag release:

```powershell
cd d:\Work\macatung\desktop
npm version patch
git add package.json package-lock.json
git commit -m "chore(desktop): release v1.0.1"
git tag desktop-v1.0.1
git push origin main --tags
```

GitHub Actions sẽ kiểm tra version, build installer NSIS per-user và publish
`.exe`, `latest.yml` cùng blockmap lên GitHub Releases.

---

## 🛠️ Cấu Trúc Mã Nguồn

```
desktop/
├── electron/
│   ├── main.ts              # Quản lý BrowserWindow trong suốt & System Tray
│   └── preload.ts           # Bridge API giữa Electron và Vue
├── src/
│   ├── audio/
│   │   └── mindfulBellAudio.ts # Bộ tổng hợp chuông Tây Tạng 432Hz/528Hz
│   ├── components/
│   │   ├── ZenMascotStage.vue          # Mascot Ma Tọa Thiền (Đài sen & Hào quang)
│   │   ├── CoderMascotStage.vue        # Mascot Ma Cà Tưng Coder (Bùa chú & Cà phê)
│   │   ├── DhammapadaSpeechBubble.vue  # Bong bóng kệ Pháp Cú & Lời nhắc
│   │   ├── BreathingPacer.vue          # Vòng tròn điều tức 3 nhịp thở
│   │   └── SettingsModal.vue           # Bảng cài đặt chu kỳ nhắc nhở
│   ├── composables/
│   │   └── useMindfulScheduler.ts      # Bộ đếm giờ tự động định kỳ
│   ├── data/
│   │   └── dhammapadaVerses.ts         # Kho kệ Pháp Cú & Nhắc nhở sức khỏe
│   ├── App.vue                         # Component điều phối chính
│   └── main.ts
├── package.json
└── vite.config.ts
```
