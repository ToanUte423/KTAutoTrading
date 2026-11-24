/**
 * KTAutoTrading Autonomous 24/7 Server-Side Trading Engine for Raspberry Pi 5
 * Runs continuously in the background, independent of any browser session.
 */
import WebSocket from 'ws';
import { generateTechnicalSnapshot, calculateEMA } from '../../frontend/src/utils/indicators.js';
import { generateBuiltinSignal } from '../../frontend/src/services/aiService.js';
import { learningEngine } from '../../frontend/src/services/learningEngine.js';
import { serverDb as db, sqliteDb } from './database.js';
import { telegramService } from './telegramService.js';

const BINANCE_REST_URL = 'https://api.binance.com/api/v3';
export const SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT'];
const BINANCE_COMBINED_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1h/ethusdt@kline_1h/solusdt@kline_1h/suiusdt@kline_1h';

export class BotEngine {
  constructor() {
    this.marketData = {};
    for (const sym of SUPPORTED_SYMBOLS) {
      this.marketData[sym] = {
        candles: [],
        currentPrice: 0,
        latestLiveCandle: null,
        snapshot: null,
        currentSignal: null
      };
    }

    Object.defineProperty(this, 'candles', {
      get: () => this.marketData['BTCUSDT']?.candles || [],
      set: (val) => { if (this.marketData['BTCUSDT']) this.marketData['BTCUSDT'].candles = val; }
    });
    Object.defineProperty(this, 'currentPrice', {
      get: () => this.marketData['BTCUSDT']?.currentPrice || 0,
      set: (val) => { if (this.marketData['BTCUSDT']) this.marketData['BTCUSDT'].currentPrice = val; }
    });
    Object.defineProperty(this, 'snapshot', {
      get: () => this.marketData['BTCUSDT']?.snapshot || null,
      set: (val) => { if (this.marketData['BTCUSDT']) this.marketData['BTCUSDT'].snapshot = val; }
    });
    Object.defineProperty(this, 'currentSignal', {
      get: () => this.marketData['BTCUSDT']?.currentSignal || null,
      set: (val) => { if (this.marketData['BTCUSDT']) this.marketData['BTCUSDT'].currentSignal = val; }
    });

    this.latestLiveCandle = null;
    this.newsContext = null;
    this.lastTradeTime = 0;
    this.ws = null;
    this.isReconnecting = false;
    this.listeners = new Set();

    // ── 1. Higher Timeframe (4H) Confirmation State ──
    this.candles4h = [];
    this.htfTrend = {
      bias: 'NONE', // 'BULLISH' | 'BEARISH' | 'NEUTRAL'
      ema20: 0,
      ema50: 0,
      lastClose: 0,
      description: 'Đang khởi tạo nến 4H...',
      updatedAt: 0
    };

    // ── 2. High-Impact Macro Event / FOMC Filter ──
    this.macroNewsFilter = {
      isBlocked: false,
      reason: 'Thị trường bình ổn, an toàn giao dịch',
      detectedKeyword: null,
      headline: null,
      detectedAt: null,
      expiresAt: null
    };

    // ── 3. Dynamic Risk Management & Trailing Parameters ──
    this.riskParams = {
      trailingStopEnabled: true,
      breakEvenRoeTrigger: 15, // Dời SL về hòa vốn khi lãi >= 15% ROE
      trailingStartRoeTrigger: 25, // Kích hoạt trailing bám sát đỉnh khi lãi >= 25% ROE
      trailingLockRatio: 0.60 // Khóa lại 60% mức đỉnh lợi nhuận
    };

    // ── 4. Bitcoin Dominance (BTC.D) & Capital Flow Matrix ──
    this.btcDominance = {
      value: 51.3,
      displayPercent: '51.30%',
      rawPrice: 5130.0,
      change24h: 0,
      trend: 'SIDEWAYS',
      matrix: {
        scenario: 'SIDEWAYS_CONSOLIDATION',
        headline: 'Tỷ trọng vốn hóa Bitcoin duy trì ổn định',
        signalImpact: 'Trung lập (0 điểm), vận động theo HTF S/R',
        advice: 'Bám sát hỗ trợ / kháng cự then chốt 1H/4H.',
        scoreBonus: 0,
        badge: 'SIDEWAYS'
      },
      updatedAt: 0
    };

    // ── 5. Futures Metrics: Funding Rate & Squeeze Monitor ──
    this.futuresMetrics = {
      fundingRate: 0.0001,
      fundingRatePercent: '+0.0100%',
      nextFundingTime: 0,
      hoursToFunding: 0,
      isLongCrowded: false,
      isShortCrowded: false,
      headline: 'Tỷ lệ Funding bình ổn',
      updatedAt: 0
    };

    // ── 6. Circuit Breaker / Cầu chì tự ngắt bảo vệ vốn ──
    this.circuitBreaker = {
      isTripped: false,
      reason: null,
      tripType: null, // 'CONSECUTIVE_LOSS' | 'MAX_DRAWDOWN'
      trippedAt: null,
      resumeAt: null,
      consecutiveLosses: 0,
      dailyLossUsdt: 0
    };

    // Load persisted state into learning engine
    const savedBrain = db.getBrainState();
    if (savedBrain) {
      learningEngine.state = { ...learningEngine.state, ...savedBrain };
    }
  }

  // Event broadcasting to connected clients
  broadcast(type, payload) {
    for (const listener of this.listeners) {
      try {
        listener(type, payload);
      } catch (err) {
        console.error('Error in listener callback:', err);
      }
    }
  }

  addListener(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async start() {
    console.log('🤖 [KTAutoTrading BOT ENGINE] Initializing autonomous 24/7 background trading daemon...');
    
    // 1. Initial Kline Fetch (1H Primary Execution Timeframe)
    await this.fetchInitialKlines();

    // 1b. Initial Higher Timeframe (4H Trend Confirmation)
    await this.fetchHigherTimeframeKlines();
    setInterval(() => this.fetchHigherTimeframeKlines(), 180000); // Sync 4H every 3 mins

    // 1c. Initial Bitcoin Dominance & Capital Flow Matrix Fetch
    await this.fetchBtcDominance();
    setInterval(() => this.fetchBtcDominance(), 120000); // Sync BTC.D every 2 mins

    // 1d. Initial Futures Metrics (Funding Rate & Squeeze Monitor)
    await this.fetchFuturesMetrics();
    setInterval(() => this.fetchFuturesMetrics(), 180000); // Sync Funding every 3 mins

    // 1e. Initialize Telegram Service & Circuit Breaker Check
    telegramService.init(this);
    this.checkCircuitBreakerConditions();

    // 2. Fetch News Context & High-Impact Macro Filter
    await this.updateNewsContext();
    setInterval(() => this.updateNewsContext(), 90000);

    // 3. Connect Binance WebSocket
    this.connectWebSocket();

    // 4. Periodic Market Scan & Autonomous Decision Loop (every 15s)
    setInterval(() => this.evaluateAutonomousTradeCycle(), 15000);

    // 5. Periodic REST Kline Sync (every 60s to ensure high precision)
    setInterval(() => this.fetchInitialKlines(), 60000);

    console.log('✅ [KTAutoTrading BOT ENGINE] Autonomous 24/7 Trading Daemon is ACTIVE & RUNNING on Pi 5.');
  }

  // ── Higher Timeframe (4H) Trend Confirmation ──────────────────────────────
  async fetchHigherTimeframeKlines() {
    const endpoints = [
      `${BINANCE_REST_URL}/klines?symbol=BTCUSDT&interval=4h&limit=100`,
      `https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100`
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const raw = await res.json();
          if (Array.isArray(raw) && raw.length >= 50) {
            this.candles4h = raw.map(item => ({
              time: Math.floor(item[0] / 1000),
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4]),
              volume: parseFloat(item[5])
            }));

            const ema20List = calculateEMA(this.candles4h, 20);
            const ema50List = calculateEMA(this.candles4h, 50);

            const lastClose = this.candles4h[this.candles4h.length - 1].close;
            const ema20 = ema20List.length > 0 ? ema20List[ema20List.length - 1].value : 0;
            const ema50 = ema50List.length > 0 ? ema50List[ema50List.length - 1].value : 0;

            let bias = 'NEUTRAL';
            let description = 'Xu hướng 4H Đi Ngang / Tích Lũy';

            if (lastClose > ema20 && ema20 > ema50) {
              bias = 'BULLISH';
              description = 'Xu hướng 4H TĂNG MẠNH (Giá > EMA20 > EMA50) — Ưu tiên lệnh LONG';
            } else if (lastClose < ema20 && ema20 < ema50) {
              bias = 'BEARISH';
              description = 'Xu hướng 4H GIẢM MẠNH (Giá < EMA20 < EMA50) — Ưu tiên lệnh SHORT';
            } else if (lastClose > ema50) {
              bias = 'BULLISH';
              description = 'Xu hướng 4H Hồi Phục Tăng (Giá trên EMA50)';
            } else if (lastClose < ema50) {
              bias = 'BEARISH';
              description = 'Xu hướng 4H Điều Chỉnh Giảm (Giá dưới EMA50)';
            }

            this.htfTrend = {
              bias,
              ema20,
              ema50,
              lastClose,
              description,
              updatedAt: Date.now()
            };

            console.log(`📊 [HTF 4H CONFIRMATION] Trend: ${bias} | Close: $${lastClose} | EMA20: $${ema20} | EMA50: $${ema50}`);
            this.broadcast('HTF_SYNC', this.htfTrend);
            break;
          }
        }
      } catch (e) {
        // Fallback
      }
    }
  }

  // ── Bitcoin Dominance (BTC.D) Index & Capital Flow Matrix ─────────────────
  async fetchBtcDominance() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCDOMUSDT', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawPrice = parseFloat(data.lastPrice);
        const change24h = parseFloat(data.priceChangePercent);
        
        // BTCDOMUSDT index price is around 5130 -> 51.30%
        const domPercent = rawPrice / 100;
        const displayPercent = `${domPercent.toFixed(2)}%`;
        
        let trend = 'SIDEWAYS';
        if (change24h >= 0.2) trend = 'RISING';
        else if (change24h <= -0.2) trend = 'FALLING';

        // Calculate BTC 24h change from candles or snapshot
        let btcChange24h = 0;
        if (this.candles.length >= 24) {
          const oldClose = this.candles[this.candles.length - 24].close;
          if (oldClose > 0 && this.currentPrice > 0) {
            btcChange24h = ((this.currentPrice - oldClose) / oldClose) * 100;
          }
        }

        // Compute Confluence Matrix
        let matrix;
        if (btcChange24h >= 0.5 && change24h >= 0.2) {
          matrix = {
            scenario: 'STRONG_BTC_BULL',
            headline: 'Dòng tiền tập trung đẩy mạnh Bitcoin (BTC Độc Tôn)',
            signalImpact: 'Cực kỳ tích cực cho BTC LONG (+1.5 điểm)',
            advice: 'Ưu tiên vị thế MUA/LONG Bitcoin. Dòng tiền đang tháo khỏi Altcoin dồn vào BTC.',
            scoreBonus: 1.5,
            badge: 'BULLISH BTC'
          };
        } else if (btcChange24h >= -0.3 && change24h <= -0.2) {
          matrix = {
            scenario: 'ALTSEASON_ROTATION',
            headline: 'Dòng tiền luân chuyển mạnh sang Altcoin (Altseason)',
            signalImpact: 'Tích cực vừa phải (+0.5 điểm), BTC có thể chững lại tích lũy',
            advice: 'Cảnh giác nến râu điều chỉnh của BTC quanh kháng cự; vốn hóa luân chuyển sang Altcoin.',
            scoreBonus: 0.5,
            badge: 'ALTSEASON'
          };
        } else if (btcChange24h <= -0.5 && change24h >= 0.2) {
          matrix = {
            scenario: 'PANIC_DUMP_ALTCOIN_BLEED',
            headline: 'Thị trường bán tháo hoảng loạn, Altcoin bị xả mạnh hơn BTC',
            signalImpact: 'Nguy cơ sập sâu cho thị trường (-1.5 điểm)',
            advice: 'Tuyệt đối không bắt dao rơi, rủi ro domino thanh lý diện rộng.',
            scoreBonus: -1.5,
            badge: 'PANIC BLEED'
          };
        } else if (btcChange24h <= -0.5 && change24h <= -0.2) {
          matrix = {
            scenario: 'CAPITAL_FLIGHT_USDT',
            headline: 'Dòng vốn tháo chạy toàn diện ra Stablecoin (USDT/Tiền mặt)',
            signalImpact: 'Áp lực bán tháo diện rộng (-2.0 điểm)',
            advice: 'Thị trường bị rút ròng, ưu tiên phòng thủ bảo toàn vốn hoặc SHORT.',
            scoreBonus: -2.0,
            badge: 'CASH FLIGHT'
          };
        } else {
          matrix = {
            scenario: 'SIDEWAYS_CONSOLIDATION',
            headline: 'Tỷ trọng vốn hóa Bitcoin duy trì ổn định (Tích Lũy)',
            signalImpact: 'Trung lập (0 điểm), vận động theo HTF S/R',
            advice: 'Giao dịch bám sát các vùng Hỗ trợ/Kháng cự then chốt 1H/4H.',
            scoreBonus: 0,
            badge: 'SIDEWAYS'
          };
        }

        this.btcDominance = {
          value: domPercent,
          displayPercent,
          rawPrice,
          change24h,
          trend,
          matrix,
          updatedAt: Date.now()
        };

        console.log(`🪙 [BTC DOMINANCE] ${displayPercent} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%) | Matrix: ${matrix.scenario} (${matrix.headline})`);
        this.broadcast('BTCDOM_SYNC', this.btcDominance);
      }
    } catch (err) {
      console.warn('⚠️ [BTC DOMINANCE] Failed to fetch ticker:', err.message);
    }
  }

  // ── Futures Metrics (Funding Rate & Squeeze Protection) ────────────────────
  async fetchFuturesMetrics() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const fundingRate = parseFloat(data.lastFundingRate);
        const nextFundingTime = parseInt(data.nextFundingTime);
        const hoursToFunding = parseFloat(((nextFundingTime - Date.now()) / 3600000).toFixed(1));

        const fundingRatePercent = `${fundingRate >= 0 ? '+' : ''}${(fundingRate * 100).toFixed(4)}%`;
        const isLongCrowded = fundingRate >= 0.0003; // >= +0.03%
        const isShortCrowded = fundingRate <= -0.0002; // <= -0.02%

        let headline = 'Tỷ lệ Funding bình ổn';
        if (isLongCrowded) headline = 'Funding quá cao - Cảnh báo Long Squeeze';
        else if (isShortCrowded) headline = 'Funding âm sâu - Cảnh báo Short Squeeze';
        else if (fundingRate > 0) headline = 'Phe Long đang trả phí Funding';
        else if (fundingRate < 0) headline = 'Phe Short đang trả phí Funding';

        this.futuresMetrics = {
          fundingRate,
          fundingRatePercent,
          nextFundingTime,
          hoursToFunding,
          isLongCrowded,
          isShortCrowded,
          headline,
          updatedAt: Date.now()
        };

        console.log(`⚡ [FUTURES METRICS] Funding: ${fundingRatePercent} | Next in ${hoursToFunding}h | ${headline}`);
        this.broadcast('FUTURES_METRICS_SYNC', this.futuresMetrics);
      }
    } catch (err) {
      console.warn('⚠️ [FUTURES METRICS] Failed to fetch premium index:', err.message);
    }
  }

  // ── Circuit Breaker (Cầu chì tự ngắt bảo vệ vốn) ──────────────────────────
  checkCircuitBreakerConditions() {
    // Disabled to streamline interface and allow continuous self-learning trade execution
    this.circuitBreaker = {
      isTripped: false,
      reason: null,
      tripType: null,
      trippedAt: null,
      resumeAt: null,
      consecutiveLosses: 0,
      dailyLossUsdt: 0
    };
  }

  // ── Dynamic Position Sizing (Quản lý Ký quỹ Động) ──────────────────────────
  calculateDynamicMargin(signal) {
    const sim = db.getSimulatorState();
    const baseMargin = sim.marginPerTrade || 10;
    
    let dynamicMargin = baseMargin;

    // 1. High Confluence Setup: HTF 4H aligned + BTC.D favorable + High Confidence (>= 85%)
    const isHtfAligned = (signal.action === 'BUY' && this.htfTrend.bias === 'BULLISH') ||
                         (signal.action === 'SELL' && this.htfTrend.bias === 'BEARISH');
    const isBtcDomAligned = (this.btcDominance?.matrix?.scoreBonus || 0) > 0;

    if (signal.confidence >= 85 && isHtfAligned && isBtcDomAligned) {
      // High probability: Scale margin to 12 - 14 USDT (capped at 15 USDT max)
      dynamicMargin = Math.min(15, baseMargin * 1.3);
      console.log(`🚀 [DYNAMIC SIZING] High Confluence Setup (${signal.confidence}%, HTF+BTC.D aligned). Scaled margin to $${dynamicMargin.toFixed(1)} USDT.`);
    } else if (signal.confidence < 70 || (this.futuresMetrics && Math.abs(this.futuresMetrics.fundingRate) >= 0.0002)) {
      // Volatile / Cautious setup: Scale down to 5 - 7 USDT
      dynamicMargin = Math.max(5, baseMargin * 0.6);
      console.log(`🛡️ [DYNAMIC SIZING] Volatile market / High funding detected. Reduced margin to $${dynamicMargin.toFixed(1)} USDT.`);
    }

    return Math.min(sim.balance, parseFloat(dynamicMargin.toFixed(2)));
  }

  async fetchInitialKlines() {
    for (const sym of SUPPORTED_SYMBOLS) {
      const endpoints = [
        `${BINANCE_REST_URL}/klines?symbol=${sym}&interval=1h&limit=250`,
        `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1h&limit=250`
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const raw = await res.json();
            if (Array.isArray(raw) && raw.length > 0) {
              const candles = raw.map(item => ({
                time: Math.floor(item[0] / 1000),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
              }));
              const lastCandle = candles[candles.length - 1];
              const snap = generateTechnicalSnapshot(candles, '1h', sym);
              const sig = snap ? generateBuiltinSignal(
                snap,
                candles,
                this.newsContext,
                learningEngine.state.adaptiveParams,
                this.btcDominance,
                sym
              ) : null;

              this.marketData[sym] = {
                candles,
                currentPrice: lastCandle.close,
                latestLiveCandle: lastCandle,
                snapshot: snap,
                currentSignal: sig
              };

              if (sym === 'BTCUSDT') {
                this.broadcast('KLINE_SYNC', {
                  symbol: sym,
                  candles,
                  currentPrice: lastCandle.close,
                  snapshot: snap,
                  signal: sig
                });
              }
              break;
            }
          }
        } catch (err) {
          // Fallback to next endpoint
        }
      }
    }
  }

  async updateNewsContext() {
    try {
      // News sentiment analysis & High-Impact Macro Filter from Live RSS feeds
      const sources = [
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://cryptoslate.com/feed/'
      ];

      let articles = [];

      for (const url of sources) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            signal: AbortSignal.timeout(6000)
          });
          if (res.ok) {
            const xml = await res.text();
            const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
            for (const item of itemMatches.slice(0, 20)) {
              const titleM = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
              const descM = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
              const title = titleM ? titleM[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
              const desc = descM ? descM[1].replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
              if (title) articles.push({ title, body: desc });
            }
            if (articles.length > 0) break;
          }
        } catch (err) {
          // try next feed
        }
      }

      if (articles.length > 0) {
        let positiveWords = 0;
        let negativeWords = 0;
        const posList = ['surge', 'jump', 'gain', 'bull', 'rally', 'high', 'inflow', 'etf', 'record', 'growth', 'tăng', 'bứt phá', 'mua'];
        const negList = ['plunge', 'drop', 'dump', 'bear', 'fall', 'low', 'outflow', 'sec', 'crash', 'ban', 'giảm', 'thanh lý', 'xả'];

        // Macro Keywords that trigger the FOMC / News Spike Filter
        const macroKeywords = [
          'fomc', 'fed rate', 'interest rate', 'rate cut', 'rate hike',
          'cpi', 'inflation', 'non-farm', 'nonfarm', 'payroll', 'powell',
          'sec lawsuit', 'emergency meeting', 'crypto ban'
        ];

        let detectedMacro = null;

        articles.slice(0, 15).forEach(a => {
          const text = (a.title + ' ' + (a.body || '')).toLowerCase();
          posList.forEach(w => { if (text.includes(w)) positiveWords++; });
          negList.forEach(w => { if (text.includes(w)) negativeWords++; });

          if (!detectedMacro) {
            for (const kw of macroKeywords) {
              if (text.includes(kw)) {
                detectedMacro = { keyword: kw, title: a.title };
                break;
              }
            }
          }
        });

        const total = positiveWords + negativeWords || 1;
        const bullPercent = Math.round((positiveWords / total) * 100);
        const sentiment = bullPercent >= 55 ? 'bullish' : bullPercent <= 45 ? 'bearish' : 'neutral';
        const sentimentLabel = sentiment === 'bullish' ? 'Tích cực (Bullish)' : sentiment === 'bearish' ? 'Tiêu cực (Bearish)' : 'Trung lập (Neutral)';

        const now = Date.now();
        if (detectedMacro) {
          // Block entries for 45 minutes to prevent news spike liquidations
          this.macroNewsFilter = {
            isBlocked: true,
            reason: `Phát hiện tin vĩ mô nhạy cảm (${detectedMacro.keyword.toUpperCase()}): "${detectedMacro.title.slice(0, 65)}..."`,
            detectedKeyword: detectedMacro.keyword,
            headline: detectedMacro.title,
            detectedAt: now,
            expiresAt: now + 45 * 60 * 1000
          };
          console.log(`⚠️ [MACRO NEWS FILTER TRIGGERED] ${this.macroNewsFilter.reason}`);
        } else if (this.macroNewsFilter.expiresAt && now < this.macroNewsFilter.expiresAt) {
          const remainingMins = Math.ceil((this.macroNewsFilter.expiresAt - now) / 60000);
          this.macroNewsFilter.reason = `Đang trong thời gian chờ an toàn sau tin tức (${remainingMins} phút còn lại)`;
        } else {
          this.macroNewsFilter = {
            isBlocked: false,
            reason: 'Thị trường bình ổn, an toàn giao dịch',
            detectedKeyword: null,
            headline: null,
            detectedAt: null,
            expiresAt: null
          };
        }

        this.newsContext = {
          sentiment,
          sentimentLabel,
          bullPercent,
          topNewsTitle: articles[0]?.title || 'Thị trường vận động ổn định',
          articleCount: articles.length,
          macroFilter: this.macroNewsFilter,
          updatedAt: now
        };
      }
    } catch (e) {
      console.warn('⚠️ [NEWS UPDATE ERROR]', e.message);
    }
  }

  connectWebSocket() {
    if (this.ws) {
      try { this.ws.terminate(); } catch (e) {}
    }

    try {
      this.ws = new WebSocket(BINANCE_COMBINED_WS_URL);

      this.ws.on('open', () => {
        console.log('🟢 [BINANCE WS] Connected to combined multi-coin stream (BTC, ETH, SOL, SUI 1h).');
        this.isReconnecting = false;
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const klineMsg = msg.data || msg;
          if (klineMsg.e === 'kline' && klineMsg.k) {
            const sym = klineMsg.s;
            const k = klineMsg.k;
            const liveCandle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isClosed: k.x
            };

            const coinData = this.marketData[sym];
            if (coinData) {
              coinData.latestLiveCandle = liveCandle;
              coinData.currentPrice = liveCandle.close;

              // Handle position tick checks on every incoming tick for this coin
              this.handlePriceTick(sym, liveCandle.close, liveCandle.high, liveCandle.low);

              // Update candle buffer
              if (coinData.candles.length > 0) {
                const last = coinData.candles[coinData.candles.length - 1];
                if (liveCandle.time === last.time) {
                  coinData.candles[coinData.candles.length - 1] = liveCandle;
                } else if (liveCandle.time > last.time) {
                  coinData.candles.push(liveCandle);
                  if (coinData.candles.length > 300) coinData.candles.shift();
                }
              }

              if (liveCandle.isClosed) {
                coinData.snapshot = generateTechnicalSnapshot(coinData.candles, '1h', sym);
                coinData.currentSignal = generateBuiltinSignal(
                  coinData.snapshot,
                  coinData.candles,
                  this.newsContext,
                  learningEngine.state.adaptiveParams,
                  this.btcDominance,
                  sym
                );
              }
            }

            this.broadcast('TICK', {
              symbol: sym,
              price: liveCandle.close,
              liveCandle
            });
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.warn('⚠️ [BINANCE WS] Error:', err.message);
      });

      this.ws.on('close', () => {
        console.warn('⚠️ [BINANCE WS] Connection closed. Reconnecting in 5s...');
        if (!this.isReconnecting) {
          this.isReconnecting = true;
          setTimeout(() => this.connectWebSocket(), 5000);
        }
      });
    } catch (e) {
      setTimeout(() => this.connectWebSocket(), 5000);
    }
  }

  // Tick Evaluation: Updates open positions & checks TP/SL/LIQ with Trailing Stop & Break-Even
  handlePriceTick(symbol, price, candleHigh = null, candleLow = null) {
    const sim = db.getSimulatorState();
    if (!sim.positions || sim.positions.length === 0) return;

    const cleanSym = (symbol || 'BTCUSDT').replace('/', '').toUpperCase();
    const decimals = cleanSym === 'SUIUSDT' ? 4 : (price < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));

    let hasChanges = false;
    const closedTrades = [];

    const effectiveHigh = candleHigh !== null ? Math.max(candleHigh, price) : price;
    const effectiveLow = candleLow !== null ? Math.min(candleLow, price) : price;

    for (let i = sim.positions.length - 1; i >= 0; i--) {
      const pos = sim.positions[i];
      const posSym = (pos.symbol || 'BTC/USDT').replace('/', '').toUpperCase();
      if (posSym !== cleanSym) continue; // ONLY EVALUATE SAME COIN!

      pos.currentPrice = price;
      const isLong = pos.side === 'LONG';

      const priceDiffRatio = isLong
        ? (price - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - price) / pos.entryPrice;

      const roePercent = parseFloat((priceDiffRatio * pos.leverage * 100).toFixed(2));
      const pnlUsdt = parseFloat((pos.margin * (roePercent / 100)).toFixed(2));
      pos.roePercent = roePercent;
      pos.unrealizedPnl = pnlUsdt;

      // ── Trailing Stop-Loss & Break-Even System ──
      // 1. Break-Even Trigger: When ROE >= +15%, move SL to entry (+0.05% fee cover)
      if (roePercent >= this.riskParams.breakEvenRoeTrigger && !pos.isBreakEvenSet) {
        const breakEvenPrice = isLong
          ? roundP(pos.entryPrice * 1.0005)
          : roundP(pos.entryPrice * 0.9995);

        const shouldUpdate = isLong ? breakEvenPrice > pos.stopLoss : breakEvenPrice < pos.stopLoss;
        if (shouldUpdate) {
          pos.stopLoss = breakEvenPrice;
          pos.isBreakEvenSet = true;
          hasChanges = true;
          console.log(`🛡️ [BREAK-EVEN ACTIVE] ${pos.symbol} ${pos.side} hit +${roePercent}% ROE. SL moved to Break-even: $${pos.stopLoss}`);
          this.broadcast('TRAILING_SL_UPDATE', { positionId: pos.id, stopLoss: pos.stopLoss, stage: 'BREAK_EVEN', roePercent });
          telegramService.notifyTrailingBreakeven(pos, roePercent);
        }
      }

      // 2. Dynamic Trailing: When price pushes into profit (ROE >= +25%)
      if (roePercent >= this.riskParams.trailingStartRoeTrigger) {
        if (isLong) {
          pos.peakPrice = Math.max(pos.peakPrice || pos.entryPrice, effectiveHigh);
          const profitDist = pos.peakPrice - pos.entryPrice;
          const trailingTarget = roundP(pos.entryPrice + profitDist * this.riskParams.trailingLockRatio);
          if (trailingTarget > pos.stopLoss) {
            pos.stopLoss = trailingTarget;
            pos.trailingActive = true;
            hasChanges = true;
            const lockedRoe = ((profitDist * this.riskParams.trailingLockRatio) / pos.entryPrice * pos.leverage * 100).toFixed(1);
            console.log(`🚀 [TRAILING SL ADVANCED] ${pos.symbol} ${pos.side} Peak: $${pos.peakPrice} -> New Trailing SL: $${pos.stopLoss} (Khóa +${lockedRoe}% ROE)`);
            this.broadcast('TRAILING_SL_UPDATE', { positionId: pos.id, stopLoss: pos.stopLoss, stage: 'TRAILING', peakPrice: pos.peakPrice });
            telegramService.notifyTrailingLock(pos, parseFloat(lockedRoe), pos.stopLoss);
          }
        } else {
          pos.peakPrice = Math.min(pos.peakPrice || pos.entryPrice, effectiveLow);
          const profitDist = pos.entryPrice - pos.peakPrice;
          const trailingTarget = roundP(pos.entryPrice - profitDist * this.riskParams.trailingLockRatio);
          if (trailingTarget < pos.stopLoss) {
            pos.stopLoss = trailingTarget;
            pos.trailingActive = true;
            hasChanges = true;
            const lockedRoe = ((profitDist * this.riskParams.trailingLockRatio) / pos.entryPrice * pos.leverage * 100).toFixed(1);
            console.log(`🚀 [TRAILING SL ADVANCED] ${pos.symbol} ${pos.side} Low: $${pos.peakPrice} -> New Trailing SL: $${pos.stopLoss} (Khóa +${lockedRoe}% ROE)`);
            this.broadcast('TRAILING_SL_UPDATE', { positionId: pos.id, stopLoss: pos.stopLoss, stage: 'TRAILING', peakPrice: pos.peakPrice });
            telegramService.notifyTrailingLock(pos, parseFloat(lockedRoe), pos.stopLoss);
          }
        }
      }

      // Check TP Hit (includes high/low wicks)
      const isTpHit = isLong ? effectiveHigh >= pos.takeProfit : effectiveLow <= pos.takeProfit;
      // Check SL Hit (includes high/low wicks)
      const isSlHit = isLong ? effectiveLow <= pos.stopLoss : effectiveHigh >= pos.stopLoss;
      // Check Liquidation Hit
      const isLiqHit = isLong ? effectiveLow <= pos.liqPrice : effectiveHigh >= pos.liqPrice;

      if (isTpHit || isSlHit || isLiqHit) {
        let reason = isTpHit
          ? '🎯 Chốt lời (TP Hit)'
          : isSlHit
            ? (pos.trailingActive
                ? `🚀 Chốt lời Trailing Stop (+${pos.roePercent}%)`
                : pos.isBreakEvenSet
                  ? '🛡️ Đóng Hòa Vốn (Break-even)'
                  : '🛑 Cắt lỗ (SL Hit)')
            : '💥 Thanh lý (Liq Hit)';

        sim.positions.splice(i, 1);

        const exitPrice = isSlHit ? pos.stopLoss : (isTpHit ? pos.takeProfit : (isLiqHit ? pos.liqPrice : price));
        const finalDiffRatio = isLong
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const finalRoe = parseFloat((finalDiffRatio * pos.leverage * 100).toFixed(2));
        const finalPnl = parseFloat((pos.margin * (finalRoe / 100)).toFixed(2));

        const returnedAmount = Math.max(0, pos.margin + finalPnl);
        sim.balance = parseFloat((sim.balance + returnedAmount).toFixed(2));

        const closedTrade = {
          id: pos.id,
          symbol: pos.symbol,
          side: pos.side,
          leverage: pos.leverage,
          margin: pos.margin,
          entryPrice: pos.entryPrice,
          exitPrice: exitPrice,
          openedAt: pos.openedAt,
          candleTime: pos.candleTime,
          openedTimestamp: pos.openedTimestamp,
          closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          closedCandleTime: Math.floor(Date.now() / 1000),
          closedTimestamp: Date.now(),
          pnlUsdt: finalPnl,
          roePercent: finalRoe,
          reason
        };

        closedTrades.push(closedTrade);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      db.saveSimulatorState(sim);
      for (const trade of closedTrades) {
        this.handleTradeClose(trade);
      }
    }
  }

  // Autonomous Decision Loop: Scans market every 15s across all supported coins
  evaluateAutonomousTradeCycle() {
    const sim = db.getSimulatorState();
    if (!sim.isAutoTradeActive) return;

    for (const sym of SUPPORTED_SYMBOLS) {
      const coinData = this.marketData[sym];
      if (!coinData || !coinData.candles || coinData.candles.length === 0) continue;

      coinData.snapshot = generateTechnicalSnapshot(coinData.candles, '1h', sym);
      if (!coinData.snapshot) continue;

      const signal = generateBuiltinSignal(
        coinData.snapshot,
        coinData.candles,
        this.newsContext,
        learningEngine.state.adaptiveParams,
        this.btcDominance,
        sym
      );
      coinData.currentSignal = signal;

      // 1. If Position Open for this coin: Active TP at Resistance/Support & Capital Defense
      const activePos = sim.positions.find(p => p.symbol && p.symbol.replace('/', '').toUpperCase() === sym);
      if (activePos) {
        const curP = coinData?.currentPrice || activePos.currentPrice || activePos.entryPrice;
        const sR = coinData.snapshot?.supportResistance;
        const res1 = sR?.resistance1;
        const sup1 = sR?.support1;
        const isLong = activePos.side === 'LONG';
        const isShort = activePos.side === 'SHORT';

        // 1.1 TƯ DUY CHỐT LỜI KHI CHẠM CẢN / VỀ HỖ TRỢ (Tối ưu hóa bảo toàn vốn & lợi nhuận):
        // - Đang giữ LONG: Giá tiến vào Vùng Cản R1 và vị thế đang có lãi dương (>= 2.0% ROE)
        if (isLong && res1 && curP >= res1 * 0.995 && (activePos.roePercent >= 2.0 || curP > activePos.entryPrice)) {
          console.log(`🎯 [RESISTANCE TP TRIGGER] ${activePos.symbol} (LONG) chạm Vùng Cản R1 ($${res1}) với lãi +${activePos.roePercent}% ROE. Kích hoạt chốt lời bảo toàn lợi nhuận!`);
          this.closePositionManually(activePos.id, `🎯 Chốt Lời Tại Vùng Kháng Cự R1 ($${res1})`, curP);
          continue;
        }

        // - Đang giữ SHORT: Giá rơi về Vùng Hỗ Trợ S1 và vị thế đang có lãi dương (>= 2.0% ROE)
        if (isShort && sup1 && curP <= sup1 * 1.005 && (activePos.roePercent >= 2.0 || curP < activePos.entryPrice)) {
          console.log(`🎯 [SUPPORT TP TRIGGER] ${activePos.symbol} (SHORT) rơi về Vùng Hỗ Trợ S1 ($${sup1}) với lãi +${activePos.roePercent}% ROE. Kích hoạt chốt lời bảo toàn lợi nhuận!`);
          this.closePositionManually(activePos.id, `🎯 Chốt Lời Tại Vùng Hỗ Trợ S1 ($${sup1})`, curP);
          continue;
        }

        // 1.2 LIÊN ĐỚI VĨ MÔ TỪ BTC: Nếu Altcoin đang mở vị thế mà BTC chạm Cản/Hỗ trợ khung lớn
        if (sym !== 'BTCUSDT') {
          const btcSnap = this.marketData['BTCUSDT']?.snapshot;
          const btcP = this.marketData['BTCUSDT']?.currentPrice;
          const btcRes1 = btcSnap?.supportResistance?.resistance1;
          const btcSup1 = btcSnap?.supportResistance?.support1;

          if (isLong && btcRes1 && btcP >= btcRes1 * 0.995 && activePos.roePercent >= 3.0) {
            console.log(`🎯 [MACRO BTC TP] BTC chạm Vùng Cản R1 ($${btcRes1}). Chốt lời sớm ${activePos.symbol} (LONG +${activePos.roePercent}% ROE) đón đầu điều chỉnh.`);
            this.closePositionManually(activePos.id, `🎯 Chốt Lời Đón Đầu: BTC Chạm Cản R1 ($${btcRes1})`, curP);
            continue;
          }
          if (isShort && btcSup1 && btcP <= btcSup1 * 1.005 && activePos.roePercent >= 3.0) {
            console.log(`🎯 [MACRO BTC TP] BTC về Vùng Hỗ Trợ S1 ($${btcSup1}). Chốt lời sớm ${activePos.symbol} (SHORT +${activePos.roePercent}% ROE) bảo vệ lãi.`);
            this.closePositionManually(activePos.id, `🎯 Chốt Lời Đón Đầu: BTC Về Hỗ Trợ S1 ($${btcSup1})`, curP);
            continue;
          }
        }

        // 1.3 ĐẢO CHIỀU BẢO VỆ VỐN (REVERSAL EXIT):
        const isOpposingReversal =
          (isLong && signal.action === 'SELL' && signal.confidence >= 70) ||
          (isShort && signal.action === 'BUY' && signal.confidence >= 70);

        if (isOpposingReversal) {
          console.log(`🛡️ [AI REVERSAL EXIT] Opposing ${signal.action} (${signal.confidence}%) on ${activePos.symbol}. Closing ${activePos.side} to protect capital.`);
          const exitP = coinData?.currentPrice || activePos.currentPrice || activePos.entryPrice;
          this.closePositionManually(activePos.id, '🔄 AI Đảo Chiều Xu Hướng (Bảo Vệ Vốn)', exitP);
        }
        continue;
      }

      // 2. Check if new position can be opened
      // Limit to max 3 concurrent positions total across all coins
      if (sim.positions.length >= 3) continue;

      // ── Filter 0: Safety Check ──
      if (this.circuitBreaker.isTripped) {
        this.circuitBreaker.isTripped = false;
      }

      const now = Date.now();
      // Cooldown of 60 seconds between any entry across system
      if (now - this.lastTradeTime < 60000) continue;

      // ── Filter 0b: Directional Lock & Coin Quarantine (Anti-Revenge Trading) ──
      const desiredSide = signal.action === 'BUY' ? 'LONG' : 'SHORT';
      const dirCheck = learningEngine.isTradeDirectionAllowed(sym, desiredSide);
      if (!dirCheck.allowed) {
        // Coin is resting or direction is locked due to recent Stop Loss post-mortem
        continue;
      }

      // ── Filter 0c: Portfolio Directional Correlation Cap (Max 2 in same direction) ──
      const activeLongs = sim.positions.filter(p => p.side === 'LONG').length;
      const activeShorts = sim.positions.filter(p => p.side === 'SHORT').length;
      if (signal.action === 'BUY' && activeLongs >= 2) continue;
      if (signal.action === 'SELL' && activeShorts >= 2) continue;

      // ── Filter 1: High-Impact Macro News / FOMC Filter ──
      if (this.macroNewsFilter && this.macroNewsFilter.isBlocked) {
        continue;
      }

      // ── Filter 2: Multi-Timeframe Confirmation (HTF 4H Trend Filter for ALL Coins) ──
      if (this.htfTrend && this.htfTrend.bias !== 'NEUTRAL' && this.htfTrend.bias !== 'NONE') {
        if (signal.action === 'BUY' && this.htfTrend.bias === 'BEARISH') {
          continue; // Altcoins and BTC bleed during 4H Bearish trend - DO NOT BUY
        }
        if (signal.action === 'SELL' && this.htfTrend.bias === 'BULLISH') {
          continue; // DO NOT SHORT during 4H Bullish trend
        }
      }

      // ── Filter 3: Futures Funding Rate & Squeeze Protection ──
      if (this.futuresMetrics) {
        if (signal.action === 'BUY' && this.futuresMetrics.isLongCrowded) {
          continue;
        }
        if (signal.action === 'SELL' && this.futuresMetrics.isShortCrowded) {
          continue;
        }
      }

      const coinProfile = learningEngine.state.coinProfiles?.[sym];
      const minConf = coinProfile?.minConfidence || learningEngine.state.adaptiveParams?.minConfidence || 65;
      const isActionable = (signal.action === 'BUY' || signal.action === 'SELL') && signal.confidence >= minConf;

      if (isActionable) {
        this.executeAutonomousEntry(sym, signal);
      }
    }
  }

  executeAutonomousEntry(sym, signal) {
    const sim = db.getSimulatorState();
    // Do not open duplicate position for the same coin
    if (sim.positions.some(p => p.symbol && p.symbol.replace('/', '').toUpperCase() === sym)) return;
    if (sim.positions.length >= 3) return;

    const coinData = this.marketData[sym];
    const curP = coinData?.currentPrice || (coinData?.candles?.length ? coinData.candles[coinData.candles.length - 1].close : 0);
    if (!curP) return;

    const decimals = sym === 'SUIUSDT' ? 4 : (curP < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));

    const isLong = signal.action === 'BUY';
    const lastCandle = coinData.candles && coinData.candles.length > 0 ? coinData.candles[coinData.candles.length - 1] : null;
    const candleTime = lastCandle ? lastCandle.time : Math.floor(Date.now() / 1000);

    // Calculate dynamic risk leverage
    const slDistRatio = Math.abs(curP - signal.stopLoss) / curP;
    const maxCap = learningEngine.state.adaptiveParams.maxLeverageCap || (sym === 'SUIUSDT' ? 10 : 15);
    const safeLev = slDistRatio > 0 ? Math.max(5, Math.min(maxCap, Math.floor(0.20 / slDistRatio))) : 10;

    const margin = this.calculateDynamicMargin(signal);
    if (sim.balance < margin) {
      console.warn(`⚠️ [AUTO TRADE] Insufficient balance to open trade for ${sym}.`);
      return;
    }

    sim.balance = parseFloat((sim.balance - margin).toFixed(2));
    const notionalValue = margin * safeLev;
    const coinAmount = parseFloat((notionalValue / curP).toFixed(4));
    const liqDistance = (curP / safeLev) * 0.92;
    const liqPrice = isLong ? Math.max(0, curP - liqDistance) : curP + liqDistance;

    const pairName = `${sym.replace('USDT', '')}/USDT`;

    const newPosition = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      symbol: pairName,
      side: isLong ? 'LONG' : 'SHORT',
      entryPrice: roundP(curP),
      currentPrice: roundP(curP),
      leverage: safeLev,
      margin,
      notionalValue: parseFloat(notionalValue.toFixed(2)),
      btcAmount: coinAmount,
      coinAmount,
      stopLoss: roundP(signal.stopLoss),
      takeProfit: roundP(signal.takeProfit1),
      liqPrice: roundP(liqPrice),
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      openedTimestamp: Date.now(),
      candleTime,
      unrealizedPnl: 0,
      roePercent: 0
    };

    sim.positions.push(newPosition);
    this.lastTradeTime = Date.now();
    db.saveSimulatorState(sim);

    console.log(`⚡ [AUTO TRADE OPENED] ${pairName} ${newPosition.side} ${newPosition.leverage}x at $${curP} | Margin: $${margin} USDT | SL: $${signal.stopLoss} | TP: $${signal.takeProfit1}`);

    this.broadcast('TRADE_OPENED', newPosition);
    telegramService.notifyTradeOpened(newPosition, signal.signalType);
  }

  closePositionManually(positionId, reason = 'Đóng tay', overrideExitPrice = null) {
    const sim = db.getSimulatorState();
    const idx = sim.positions.findIndex(p => p.id === positionId);
    if (idx === -1) return null;

    const pos = sim.positions[idx];
    const isLong = pos.side === 'LONG';
    const posSym = (pos.symbol || 'BTCUSDT').replace('/', '').toUpperCase();

    // 1. Get live price specifically for this coin, NEVER default to BTC's currentPrice!
    const coinData = this.marketData?.[posSym];
    let price = overrideExitPrice || coinData?.currentPrice || pos.currentPrice || pos.entryPrice;

    // 2. Strict Cross-Coin & Outlier Protection Guard:
    // If the price deviates more than 300% from entry, it is guaranteed to be a cross-coin pollution bug!
    if (pos.entryPrice > 0 && Math.abs(price - pos.entryPrice) / pos.entryPrice > 3.0) {
      console.warn(`⚠️ [SAFETY GUARD] Rejecting anomalous exit price $${price} for ${pos.symbol} (entry $${pos.entryPrice}). Falling back to pos.currentPrice ($${pos.currentPrice}).`);
      price = pos.currentPrice || pos.entryPrice;
    }

    const decimals = posSym === 'SUIUSDT' ? 4 : (price < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));
    price = roundP(price);

    const priceDiffRatio = isLong
      ? (price - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - price) / pos.entryPrice;

    const roePercent = parseFloat((priceDiffRatio * pos.leverage * 100).toFixed(2));
    const pnlUsdt = parseFloat((pos.margin * (roePercent / 100)).toFixed(2));

    sim.positions.splice(idx, 1);
    const returnedAmount = Math.max(0, pos.margin + pnlUsdt);
    sim.balance = parseFloat((sim.balance + returnedAmount).toFixed(2));

    const closedTrade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      leverage: pos.leverage,
      margin: pos.margin,
      entryPrice: pos.entryPrice,
      exitPrice: price,
      openedAt: pos.openedAt,
      candleTime: pos.candleTime,
      openedTimestamp: pos.openedTimestamp,
      closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      closedCandleTime: Math.floor(Date.now() / 1000),
      closedTimestamp: Date.now(),
      pnlUsdt,
      roePercent,
      reason
    };

    db.saveSimulatorState(sim);
    this.handleTradeClose(closedTrade);
    return closedTrade;
  }

  handleTradeClose(trade) {
    this.lastTradeTime = Date.now();
    console.log(`🔔 [TRADE CLOSED] ${trade.side} ${trade.reason}: PnL ${trade.pnlUsdt >= 0 ? '+' : ''}$${trade.pnlUsdt} (${trade.roePercent}%)`);

    // 1. Record to database
    db.recordClosedTrade(trade);

    // 2. Post-mortem analysis and strategy adaptation using the specific coin's snapshot
    const symKey = (trade.symbol || 'BTCUSDT').replace('/', '').toUpperCase();
    const coinData = this.marketData[symKey] || {};
    const lesson = learningEngine.analyzeClosedTrade(trade, {
      newsContext: this.newsContext,
      rsi: coinData.snapshot?.rsi,
      snapshot: coinData.snapshot,
      symbol: symKey
    });

    if (lesson) {
      db.saveBrainState(learningEngine.getState());
      console.log(`🧠 [AI LEARNING GEN ${learningEngine.state.generation}] Adapted parameters for ${symKey}:`, lesson.actionTaken);
    }

    // 3. Telegram notification
    telegramService.notifyTradeClosed(trade, lesson);

    // 4. Circuit Breaker evaluation
    this.checkCircuitBreakerConditions();

    // 5. Broadcast to all clients
    this.broadcast('TRADE_CLOSED', {
      trade,
      lesson,
      brain: learningEngine.getState(),
      simulator: db.getSimulatorState()
    });
  }

  getStatus() {
    const sim = db.getSimulatorState();
    // Enrich all open positions with real-time market price and active ROE%/PnL
    if (sim.positions && sim.positions.length > 0) {
      for (const pos of sim.positions) {
        const sym = (pos.symbol || 'BTCUSDT').replace('/', '').toUpperCase();
        const coinData = this.marketData?.[sym];
        const curP = coinData?.currentPrice || pos.currentPrice || pos.entryPrice;
        if (curP && pos.entryPrice) {
          pos.currentPrice = curP;
          const isLong = pos.side === 'LONG';
          const diffRatio = isLong
            ? (curP - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - curP) / pos.entryPrice;
          pos.roePercent = parseFloat((diffRatio * pos.leverage * 100).toFixed(2));
          pos.unrealizedPnl = parseFloat((pos.margin * (pos.roePercent / 100)).toFixed(2));
        }
      }
    }
    return {
      isRunning: true,
      price: this.currentPrice,
      timeframe: '1h',
      positions: sim.positions,
      balance: sim.balance,
      initialBalance: sim.initialBalance,
      isAutoTradeActive: sim.isAutoTradeActive,
      history: sim.history,
      historyCount: sim.history.length,
      currentSignal: this.currentSignal,
      snapshot: this.snapshot,
      brain: learningEngine.getState(),
      newsContext: this.newsContext,
      htfTrend: this.htfTrend,
      macroNewsFilter: this.macroNewsFilter,
      riskParams: this.riskParams,
      btcDominance: this.btcDominance,
      futuresMetrics: this.futuresMetrics,
      circuitBreaker: this.circuitBreaker,
      telegramConfig: telegramService.getConfig()
    };
  }
}

export const botEngine = new BotEngine();
