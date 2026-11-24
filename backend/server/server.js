import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { botEngine } from './botEngine.js';
import { serverDb } from './database.js';
import { telegramService } from './telegramService.js';

const PORT = process.env.PORT || 5001;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// 1. Get Live Bot Status & Metrics
app.get('/api/status', (req, res) => {
  res.json(botEngine.getStatus());
});

// 2. Get Historical Performance & Analytics (Day / Month / Year)
app.get('/api/analytics', (req, res) => {
  res.json(serverDb.getAnalytics());
});

// 2b. Database diagnostics
app.get('/api/db/diagnostics', (req, res) => {
  res.json(serverDb.getDiagnostics());
});

// 3. Close Position Manually via API
app.post('/api/position/close', (req, res) => {
  const { id, reason, exitPrice } = req.body || {};
  const closed = botEngine.closePositionManually(id, reason || 'Đóng qua Dashboard', exitPrice);
  if (closed) {
    res.json({ success: true, trade: closed });
  } else {
    res.status(404).json({ success: false, error: 'Vị thế không tồn tại' });
  }
});

// 4. Toggle Auto Trade on Server
app.post('/api/auto-trade/toggle', (req, res) => {
  const sim = serverDb.getSimulatorState();
  sim.isAutoTradeActive = !sim.isAutoTradeActive;
  serverDb.saveSimulatorState(sim);
  botEngine.broadcast('AUTO_TRADE_TOGGLE', { isAutoTradeActive: sim.isAutoTradeActive });
  res.json({ success: true, isAutoTradeActive: sim.isAutoTradeActive });
});

// 5. Reset Paper Trading Account
app.post('/api/account/reset', (req, res) => {
  serverDb.resetAccount();
  botEngine.broadcast('ACCOUNT_RESET', serverDb.getSimulatorState());
  res.json({ success: true, message: 'Đã đặt lại tài khoản' });
});

// 5b. Delete SUI Trades (Loss/Error or All)
app.post('/api/trades/delete-sui', (req, res) => {
  const { all = false } = req.body || {};
  const result = serverDb.deleteSuiTrades({ all: Boolean(all) });
  botEngine.broadcast('SIMULATOR_UPDATE', serverDb.getSimulatorState());
  res.json({ success: true, ...result });
});

// 6. Telegram Bot Config & Test
app.get('/api/telegram/config', (req, res) => {
  res.json(telegramService.getConfig());
});

app.post('/api/telegram/config', (req, res) => {
  const { token, chatId } = req.body;
  const ok = telegramService.updateConfig(token, chatId);
  res.json({ success: true, isConfigured: ok, config: telegramService.getConfig() });
});

app.post('/api/telegram/test', async (req, res) => {
  const success = await telegramService.sendMessage('🚀 *[KTAutoTrading Pro]*\nKiểm tra kết nối thành công! Hệ thống sẵn sàng gửi thông báo lệnh 24/7 từ Raspberry Pi 5.');
  res.json({ success });
});

// 7. Proxy endpoints for Binance Data (bypasses Vietnam ISP blocks for client browsers)
app.get('/api/binance/klines', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1h', limit = 300 } = req.query;
  const mirrors = [
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  ];
  for (const url of mirrors) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch {}
  }
  res.status(502).json({ error: 'All Binance klines mirrors failed' });
});

app.get('/api/binance/ticker', async (req, res) => {
  const { symbol = 'BTCUSDT' } = req.query;
  const mirrors = [
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`,
    `https://api1.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
  ];
  for (const url of mirrors) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch {}
  }
  res.status(502).json({ error: 'All Binance ticker mirrors failed' });
});

// 8. Proxy endpoint for Live Crypto News RSS (Cointelegraph with Decrypt & Cryptoslate fallbacks)
let cachedNewsXml = null;
let lastNewsFetchTime = 0;

app.get('/api/news', async (req, res) => {
  const now = Date.now();
  // Return cached XML if fresh (less than 45 seconds old)
  if (cachedNewsXml && (now - lastNewsFetchTime < 45000)) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    return res.send(cachedNewsXml);
  }

  const sources = [
    'https://cointelegraph.com/rss',
    'https://decrypt.co/feed',
    'https://cryptoslate.com/feed/'
  ];

  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const xml = await response.text();
        if (xml && xml.includes('<item')) {
          cachedNewsXml = xml;
          lastNewsFetchTime = now;
          res.set('Content-Type', 'application/xml; charset=utf-8');
          return res.send(xml);
        }
      }
    } catch (e) {
      // try next source
    }
  }

  if (cachedNewsXml) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    return res.send(cachedNewsXml);
  }

  res.status(502).json({ error: 'All news feeds failed' });
});

// WebSocket Server for Real-Time Client Synchronization
const connectedClients = new Set();

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`🌐 [CLIENT CONNECTED] Total connected clients: ${connectedClients.size}`);

  // Send initial full state immediately upon connection
  ws.send(JSON.stringify({
    type: 'INIT_STATE',
    payload: {
      status: botEngine.getStatus(),
      analytics: serverDb.getAnalytics(),
      candles: botEngine.candles
    }
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

// Forward bot engine events to all connected WebSocket clients
botEngine.addListener((type, payload) => {
  const msg = JSON.stringify({ type, payload });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
});

// Start Bot Engine and Server
async function main() {
  await botEngine.start();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [KTAutoTrading SERVER] Backend daemon running at http://0.0.0.0:${PORT}`);
    console.log(`📡 [KTAutoTrading WS] WebSocket stream active at ws://0.0.0.0:${PORT}/ws`);
  });
}

main().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
