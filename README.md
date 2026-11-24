# KTAutoTrading - Bot Phân Tích & Tự Động Vào Lệnh BTC

Hệ thống bot tự động phân tích thị trường tiền mã hóa (Bitcoin - BTC/USDT), tính toán chỉ báo kỹ thuật, tích hợp AI phân tích đa khung thời gian và tự động mô phỏng/vào lệnh với quản lý rủi ro nâng cao.

---

## 🚀 Tính năng nổi bật

- **Tự động phân tích & vào lệnh (Auto-Trading Engine):**
  - Quét nến thời gian thực từ Binance WebSocket / REST API.
  - Phân tích đa chỉ báo: RSI, MACD, Bollinger Bands, EMA, Khối lượng giao dịch.
  - Tự động quản lý vốn, đòn bẩy, cài đặt Stop Loss (SL) và Take Profit (TP), Trailing Stop thông minh.
- **Tích hợp Trí tuệ Nhân tạo (AI-Powered Analysis):**
  - Kết nối Gemini / OpenAI API để phân tích tâm lý thị trường, tin tức vĩ mô và xác nhận tín hiệu vào lệnh.
  - Hệ thống Self-Learning: Ghi nhận lịch sử lệnh thắng/thua để tối ưu hóa tham số thích ứng theo từng giai đoạn thị trường.
- **Backend & Database 24/7:**
  - Xây dựng trên nền tảng Node.js / Express với WebSocket Server cập nhật dữ liệu độ trễ thấp.
  - Cơ sở dữ liệu SQLite (`better-sqlite3`) lưu trữ cấu hình, lịch sử giao dịch và thống kê PnL theo ngày/tháng/năm.
- **Thông báo & Điều khiển từ xa qua Telegram:**
  - Báo động ngay khi có tín hiệu khớp lệnh, cắt lỗ, chốt lời hoặc chạm Trailing Stop.
  - Hỗ trợ tra cứu nhanh qua bot: `/status`, `/balance`, `/pnl`, `/ping`.
- **Giao diện Dashboard trực quan (Frontend):**
  - Phát triển bằng React 19 + Vite, giao diện hiện đại hỗ trợ dark mode.
  - Tích hợp biểu đồ kỹ thuật chuyên nghiệp TradingView (`lightweight-charts`).
  - Quản lý nhật ký tín hiệu, hiệu suất danh mục và tuỳ chỉnh tham số linh hoạt.

---

## 📁 Cấu trúc thư mục

```
KT1/
├── backend/
│   └── server/
│       ├── botEngine.js          # Core engine phân tích & tính toán lệnh
│       ├── database.js           # Quản lý SQLite database (better-sqlite3)
│       ├── server.js             # Express API & WebSocket Server
│       ├── telegramService.js    # Dịch vụ thông báo & lệnh qua Telegram Bot
│       ├── upgradeBrain.js       # Mô-đun tự học & tối ưu tham số AI
│       └── data/                 # Thư mục chứa database SQLite runtime
├── frontend/
│   ├── src/
│   │   ├── components/           # Dashboard UI (Chart, Analytics, Simulator, Settings, ...)
│   │   ├── services/             # Binance API, AI service, Server Sync
│   │   └── utils/                # Audio alert, chỉ báo kỹ thuật (RSI, MACD, ...)
│   ├── package.json
│   └── vite.config.js
├── scratch/                      # Các công cụ script bổ trợ
├── package.json                  # Cấu hình dự án & scripts chạy hệ thống
└── README.md
```

---

## 🛠️ Hướng dẫn cài đặt & Khởi chạy

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 18+ hoặc 20+
- **NPM** hoặc **Yarn**

### 2. Cài đặt dependencies

Cài đặt gói cho root và backend:
```bash
npm install
```

Cài đặt gói cho frontend:
```bash
cd frontend
npm install
cd ..
```

### 3. Cấu hình biến môi trường (Tùy chọn)

Có thể cấu hình các thông số qua giao diện Cài đặt (Settings) trên Dashboard hoặc qua biến môi trường:
- `PORT`: Cổng chạy Backend (mặc định: `5001`)
- `TELEGRAM_BOT_TOKEN`: Token của Telegram Bot
- `TELEGRAM_CHAT_ID`: Chat ID nhận thông báo

### 4. Khởi chạy dự án

**Chạy Backend Server:**
```bash
node backend/server/server.js
```
*(Hoặc dùng PM2 để chạy nền 24/7: `pm2 start backend/server/server.js --name kt1-bot`)*

**Chạy Frontend Dashboard (Dev Mode):**
```bash
cd frontend
npm run dev
```

Truy cập Dashboard tại: `http://localhost:5173` (hoặc cổng hiển thị trên terminal).

---

## ⚠️ Lưu ý miễn trừ trách nhiệm

Dự án này phục vụ mục đích nghiên cứu, học tập và thử nghiệm chiến lược giao dịch tự động. Giao dịch tiền mã hóa tiềm ẩn rủi ro tài chính cao, người sử dụng cần cân nhắc và tự chịu trách nhiệm với quyết định đầu tư thực tế của mình.
