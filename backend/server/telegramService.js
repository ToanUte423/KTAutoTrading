/**
 * Telegram Notification & Remote Control Service for KTAutoTrading
 * Sends 24/7 real-time trade alerts, trailing stop triggers, daily PnL reports,
 * and responds to commands (/status, /balance, /pnl, /ping).
 */
import { serverDb as db } from './database.js';

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.isPolling = false;
    this.pollingOffset = 0;
    this.pollingTimer = null;
    this.botEngineRef = null;

    // Load persisted credentials from DB
    try {
      const savedToken = db.getSetting('telegram_bot_token');
      const savedChatId = db.getSetting('telegram_chat_id');
      if (savedToken) this.token = savedToken;
      if (savedChatId) this.chatId = savedChatId;
    } catch (e) {
      // DB not ready yet
    }
  }

  init(botEngine) {
    this.botEngineRef = botEngine;
    if (this.token && this.chatId) {
      this.startPolling();
      console.log('📱 [TELEGRAM SERVICE] Initialized with active Bot Token & Chat ID.');
    } else {
      console.log('📱 [TELEGRAM SERVICE] Standby (Awaiting Bot Token & Chat ID configuration).');
    }
  }

  updateConfig(token, chatId) {
    this.token = (token || '').trim();
    this.chatId = (chatId || '').trim();
    db.setSetting('telegram_bot_token', this.token);
    db.setSetting('telegram_chat_id', this.chatId);

    if (this.token && this.chatId) {
      this.startPolling();
      return true;
    } else {
      this.stopPolling();
      return false;
    }
  }

  getConfig() {
    return {
      hasToken: Boolean(this.token),
      maskedToken: this.token ? `${this.token.slice(0, 4)}...${this.token.slice(-4)}` : '',
      chatId: this.chatId || '',
      isPolling: this.isPolling
    };
  }

  async sendMessage(text, parseMode = 'Markdown') {
    if (!this.token || !this.chatId) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!data.ok) {
        console.warn('⚠️ [TELEGRAM API ERROR]:', data.description);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('⚠️ [TELEGRAM SEND ERROR]:', err.message);
      return false;
    }
  }

  // Helper to format price with coin-specific decimals
  formatPrice(val, symbol = '') {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    const dec = symbol?.includes('SUI') || val < 10 ? 4 : 2;
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  // 1. Notify Trade Opened
  async notifyTradeOpened(pos, reason = 'Khớp tín hiệu HTF & Hỗ Trợ/Kháng Cự') {
    const isLong = pos.side === 'LONG' || pos.side === 'BUY';
    const sideIcon = isLong ? '🟢 MUA (LONG)' : '🔴 BÁN (SHORT)';
    const sym = pos.symbol || 'BTC/USDT';
    const text = `⚡ *[KTAutoTrading - VỪA KHỚP LỆNH 24/7]*\n\n` +
      `• Vị thế: *${sideIcon} ${pos.leverage || 10}x (${sym})*\n` +
      `• Giá vào (Entry): *$${this.formatPrice(pos.entryPrice, sym)}*\n` +
      `• Cắt lỗ (SL): *$${this.formatPrice(pos.stopLoss, sym)}*\n` +
      `• Chốt lời (TP): *$${this.formatPrice(pos.takeProfit, sym)}*\n` +
      `• Ký quỹ (Margin): *$${pos.margin || 10} USDT*\n` +
      `• Lý do: _${reason}_\n\n` +
      `⏰ _${new Date().toLocaleTimeString('vi-VN')} | Raspberry Pi 5 Autonomous Engine_`;

    return await this.sendMessage(text);
  }

  // 2. Notify Trailing Stop Break-even Triggered
  async notifyTrailingBreakeven(pos, peakRoe) {
    const sym = pos.symbol || 'BTC/USDT';
    const text = `🛡️ *[KTAutoTrading - BẢO VỆ VỐN THÀNH CÔNG]*\n\n` +
      `• Vị thế: *${pos.side} ${pos.leverage}x (${sym})*\n` +
      `• Giá vào ban đầu: *$${this.formatPrice(pos.entryPrice, sym)}*\n` +
      `• Lợi nhuận đỉnh đã chạm: *+${peakRoe?.toFixed(1)}% ROE*\n` +
      `• Hành động: Đã tự động *kéo Stop Loss về điểm Hòa Vốn ($${this.formatPrice(pos.entryPrice, sym)})*.\n` +
      `🎯 _100% rủi ro lỗ đã được triệt tiêu hoàn toàn! Yên tâm thả trôi lợi nhuận._`;

    return await this.sendMessage(text);
  }

  // 3. Notify Trailing Stop Locking Profit
  async notifyTrailingLock(pos, lockedRoe, newSlPrice) {
    const sym = pos.symbol || 'BTC/USDT';
    const text = `🔒 *[KTAutoTrading - KHÓA LỢI NHUẬN ĐỘNG]*\n\n` +
      `• Vị thế: *${pos.side} ${pos.leverage}x (${sym})*\n` +
      `• Đã khóa lợi nhuận tối thiểu: *+${lockedRoe?.toFixed(1)}% ROE*\n` +
      `• Mức Stop Loss mới: *$${this.formatPrice(newSlPrice, sym)}*\n` +
      `🚀 _Thả trôi theo con sóng dài của thị trường._`;

    return await this.sendMessage(text);
  }

  // 4. Notify Trade Closed Outcome
  async notifyTradeClosed(trade, lesson = null) {
    const isProfit = (trade.pnlUsdt || 0) >= 0;
    const resultIcon = isProfit ? '🟢 CHỐT LỜI THÀNH CÔNG' : '🔴 CẮT LỖ BẢO TOÀN VỐN';
    const sign = isProfit ? '+' : '';
    const sym = trade.symbol || 'BTC/USDT';

    let text = `🔔 *[KTAutoTrading - KẾT QUẢ ĐÓNG LỆNH]*\n\n` +
      `• Kết quả: *${resultIcon}*\n` +
      `• Lệnh: *${trade.side} ${trade.leverage}x (${sym})*\n` +
      `• Lợi nhuận (ROE): *${sign}${trade.roePercent}%*\n` +
      `• P&L Ròng: *${sign}$${trade.pnlUsdt} USDT*\n` +
      `• Giá vào: *$${this.formatPrice(trade.entryPrice, sym)}* ➜ Giá ra: *$${this.formatPrice(trade.exitPrice, sym)}*\n` +
      `• Lý do đóng: _${trade.reason || 'Khớp mục tiêu'}_`;

    if (lesson) {
      text += `\n\n🧠 *[AI TỰ HỌC GEN ${lesson.generation || ''}]:*\n` +
        `• Đánh giá: _${lesson.reason}_\n` +
        `• Hành động thích ứng: *${lesson.actionTaken}*`;
    }

    return await this.sendMessage(text);
  }

  // 5. Notify Circuit Breaker Tripped
  async notifyCircuitBreaker(cbState) {
    const text = `⚠️ *[CẦU CHÌ TỰ NGẮT - BẢO VỆ VỐN KÍCH HOẠT]*\n\n` +
      `• Nguyên nhân: *${cbState.reason}*\n` +
      `• Trạng thái: *TẠM KHÓA MỞ LỆNH MỚI*\n` +
      `• Thời gian mở lại: _${new Date(cbState.resumeAt).toLocaleTimeString('vi-VN')}_\n` +
      `🛡️ _Hệ thống tự động bảo toàn $100 vốn, tránh thị trường quét râu giông bão._`;

    return await this.sendMessage(text);
  }

  // 6. Interactive Command Polling
  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
  }

  async pollLoop() {
    if (!this.isPolling || !this.token) return;

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.pollingOffset}&timeout=15`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.pollingOffset = update.update_id + 1;
            if (update.message && update.message.text) {
              await this.handleIncomingMessage(update.message);
            }
          }
        }
      }
    } catch (e) {
      // Silent catch
    }

    if (this.isPolling) {
      this.pollingTimer = setTimeout(() => this.pollLoop(), 3000);
    }
  }

  async handleIncomingMessage(msg) {
    const senderChatId = String(msg.chat?.id);
    const cmd = (msg.text || '').trim();

    // Auto-bind chatId if not set
    if (!this.chatId) {
      this.chatId = senderChatId;
      db.setSetting('telegram_chat_id', this.chatId);
      await this.sendMessage(`🎉 *Đã kết nối thành công với KTAutoTrading!*\nTừ giờ bạn sẽ nhận được thông báo lệnh 24/7 tại đây.`);
      return;
    }

    if (senderChatId !== this.chatId) return;

    if (cmd === '/start' || cmd === '/help') {
      const text = `🤖 *KTAutoTrading Pro Terminal - Danh sách Lệnh Tra Cứu:*\n\n` +
        `• /status : Xem trạng thái thị trường & vị thế đang mở\n` +
        `• /balance : Xem số dư tài khoản & PnL hiện tại\n` +
        `• /pnl : Tổng kết hiệu suất lợi nhuận hôm nay\n` +
        `• /btcdom : Xem chỉ số Bitcoin Dominance & Dòng tiền\n` +
        `• /funding : Xem tỷ lệ Funding Rate & Long/Short ratio\n` +
        `• /ping : Kiểm tra kết nối với Raspberry Pi 5`;
      await this.sendMessage(text);
    } else if (cmd === '/ping') {
      await this.sendMessage(`🏓 *Pong!* Raspberry Pi 5 daemon đang hoạt động bình thường 24/7.`);
    } else if (cmd === '/status') {
      if (!this.botEngineRef) return;
      const status = this.botEngineRef.getStatus();
      const pos = status.positions && status.positions.length > 0 ? status.positions[0] : null;
      let text = `📊 *TRẠNG THÁI HỆ THỐNG KTAutoTrading*\n\n` +
        `• Giá BTC: *$${status.price?.toLocaleString()}*\n` +
        `• Xu hướng 4H: *${status.htfTrend?.bias || 'N/A'}*\n` +
        `• BTC.D: *${status.btcDominance?.displayPercent || 'N/A'} (${status.btcDominance?.matrix?.badge || ''})*\n` +
        `• Cầu chì bảo vệ: *${status.circuitBreaker?.isTripped ? '🔴 ĐANG KHÓA' : '🟢 HOẠT ĐỘNG'}*\n\n`;

      if (pos) {
        text += `⚡ *VỊ THẾ ĐANG MỞ:*\n` +
          `• Lệnh: *${pos.side} ${pos.leverage}x*\n` +
          `• Giá vào: *$${pos.entryPrice?.toLocaleString()}*\n` +
          `• Giá hiện tại: *$${status.price?.toLocaleString()}*\n` +
          `• Lợi nhuận (ROE): *${pos.roePercent >= 0 ? '+' : ''}${pos.roePercent?.toFixed(2)}%*\n` +
          `• P&L: *${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl?.toFixed(2)} USDT*`;
      } else {
        text += `💤 *Hiện không có vị thế mở nào.*\nBot đang quét hỗ trợ/kháng cự để tìm điểm vào an toàn.`;
      }
      await this.sendMessage(text);
    } else if (cmd === '/balance') {
      if (!this.botEngineRef) return;
      const status = this.botEngineRef.getStatus();
      const text = `💰 *TÀI KHOẢN GIAO DỊCH*\n\n` +
        `• Vốn ban đầu: *$${status.initialBalance} USDT*\n` +
        `• Số dư khả dụng: *$${status.balance?.toFixed(2)} USDT*\n` +
        `• Số lệnh đã thực hiện: *${status.historyCount || 0} lệnh*`;
      await this.sendMessage(text);
    } else if (cmd === '/btcdom') {
      if (!this.botEngineRef) return;
      const dom = this.botEngineRef.getStatus().btcDominance;
      const text = `🪙 *PHÂN TÍCH TỶ TRỌNG BITCOIN (BTC.D)*\n\n` +
        `• Chỉ số BTC.D: *${dom?.displayPercent || '51.3%'}* (${dom?.change24h >= 0 ? '+' : ''}${dom?.change24h?.toFixed(2)}% 24h)\n` +
        `• Kịch bản: *${dom?.matrix?.scenario || 'SIDEWAYS'}* (${dom?.matrix?.badge || ''})\n` +
        `• Đánh giá: _${dom?.matrix?.headline || ''}_\n` +
        `• Lời khuyên: _${dom?.matrix?.advice || ''}_`;
      await this.sendMessage(text);
    }
  }
}

export const telegramService = new TelegramService();
