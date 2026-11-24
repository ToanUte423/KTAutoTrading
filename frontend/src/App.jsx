import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, MessageSquare, BarChart3, BrainCircuit, Newspaper, Zap } from 'lucide-react';
import Header from './components/Header';
import Chart from './components/Chart';
import IndicatorsBar from './components/IndicatorsBar';
import SignalCard from './components/SignalCard';
import ChatBot from './components/ChatBot';
import NewsBot from './components/NewsBot';
import SignalJournal from './components/SignalJournal';
import ToastAlert from './components/ToastAlert';
import AutoTradeSimulator from './components/AutoTradeSimulator';
import SettingsModal from './components/SettingsModal';
import { fetchKlines, fetch24hrTicker, subscribeKlineWebSocket, getCachedKlines, prefetchPopularTimeframes } from './services/binance';
import { generateTechnicalSnapshot } from './utils/indicators';
import { askAIAdvisor, generateBuiltinSignal, generateBuiltinAnswer } from './services/aiService';
import { fetchCryptoNews } from './services/newsService';
import { soundAlert } from './utils/audioAlert';
import { simulator } from './services/simulatorService';
import SelfLearningPanel from './components/SelfLearningPanel';
import { learningEngine, DEFAULT_COIN_PROFILES } from './services/learningEngine';
import PerformanceAnalytics from './components/PerformanceAnalytics';
import { dbService } from './services/dbService';
import { serverSync } from './services/serverSync';
import './App.css';

const DEFAULT_CONFIG = {
  provider: 'gemini', // 'gemini' | 'openai' | 'builtin'
  geminiKey: '',
  geminiModel: 'gemini-3.8-flash',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini'
};

const INITIAL_WELCOME_MESSAGE = {
  role: 'assistant',
  content: `Chào bạn! Tôi là **AI Crypto Trading Advisor** (Chuyên gia Phân tích Khung Lớn 1H / 4H / 1D & Tin Tức). 
Tôi đã kết nối trực tiếp với dòng dữ liệu thời gian thực từ sàn **Binance (BTC, ETH, SOL, SUI)**.

🎯 **CHIẾN LƯỢC GIAO DỊCH THEO VÙNG HỖ TRỢ & KHÁNG CỰ (HTF 1H / 4H / 1D):**
1. 🟢 **Kẻ Vùng Hỗ Trợ & Kháng Cự:** Biểu đồ đã tự động kẻ sẵn các đường **Hỗ Trợ S1, S2 (Xanh)** và **Kháng Cự R1, R2 (Đỏ)**.
2. 🛡️ **Loại bỏ nhiễu sóng ngắn (1m/5m):** Hệ thống chỉ tập trung tìm điểm vào lệnh an toàn khi giá hồi (Pullback) về vùng Hỗ Trợ khung 1H/4H/1D.
3. 📰 **Hợp lưu yếu tố Tin Tức (News Sentiment):** Tự động đối chiếu sắc thái tin tức thị trường tại thời điểm đó để lọc bẫy giá giả (Bull/Bear trap).
4. ⚡ **Bot Giả Lập Auto Trade:** Tự động mở vị thế kèm đòn bẩy và tự động chốt lời / cắt lỗ khi giá chạm cản!`,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export default function App() {
  // Active Trading Pair State: 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'SUIUSDT'
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [multiTickers, setMultiTickers] = useState({});

  // Default to 1h as preferred by user for HTF Support/Resistance trading
  const [timeframe, setTimeframe] = useState('1h');
  const [candles, setCandles] = useState([]);
  const [ticker, setTicker] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [latestLiveCandle, setLatestLiveCandle] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [currentSignal, setCurrentSignal] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tab navigation: 'chart' | 'chat' | 'autotrade' | 'news' | 'journal' | 'analytics' | 'learning'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'chart';
    }
    return 'autotrade';
  });
  const [isServerOnline, setIsServerOnline] = useState(false);
  const isServerOnlineRef = useRef(false);

  // 24/7 Autonomous Scanner Bot state
  const [isBot247Active, setIsBot247Active] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanIntervalSec, setScanIntervalSec] = useState(60);
  const [signalJournal, setSignalJournal] = useState([]);
  const [toastAlert, setToastAlert] = useState(null);

  // Live real-time price tracking
  const [livePrice, setLivePrice] = useState(0);
  const livePriceRef = useRef(0);
  const multiTickersRef = useRef({});

  // News Context State (Sentiment & Breaking headlines)
  const [newsContext, setNewsContext] = useState(null);

  // Bitcoin Dominance State (BTC.D & Capital Flow Matrix)
  const [btcDominance, setBtcDominance] = useState(null);

  // Futures Metrics & Circuit Breaker States
  const [futuresMetrics, setFuturesMetrics] = useState(null);
  const [circuitBreaker, setCircuitBreaker] = useState(null);

  // Simulator / Paper Trading State
  const [simulatorState, setSimulatorState] = useState(() => simulator.getState());
  const [accountSummary, setAccountSummary] = useState(() => simulator.getAccountSummary());

  const prevSignalActionRef = useRef(null);
  const lastAutoTradeTimeRef = useRef(0);

  const refreshSimulator = useCallback(() => {
    setSimulatorState(simulator.getState());
    setAccountSummary(simulator.getAccountSummary());
  }, []);

  // Autonomous Self-Learning & Adaptive Strategy Engine State
  const [learningState, setLearningState] = useState(() => learningEngine.getState());
  const refreshLearning = useCallback(() => {
    setLearningState(learningEngine.getState());
  }, []);

  const handleTradeClosedOutcomeRef = useRef(null);
  const handleTradeClosedOutcome = useCallback((closedTrade, serverLesson = null) => {
    if (!closedTrade) return;
    const isProfit = closedTrade.pnlUsdt >= 0;

    // Enforce cooldown: do not enter new trade immediately after closing
    lastAutoTradeTimeRef.current = Date.now();

    // Persist into IndexedDB Database for Day / Month / Year performance analytics
    dbService.saveTrade(closedTrade).catch(e => console.warn('Failed to save trade to DB:', e));

    // Post-Mortem Analysis & Strategy Self-Improvement
    // If backend daemon already analyzed this trade, use server lesson directly without re-running
    let lesson = serverLesson;
    if (!lesson && !isServerOnlineRef.current) {
      lesson = learningEngine.analyzeClosedTrade(closedTrade, {
        newsContext,
        rsi: snapshot?.rsi,
        snapshot,
        symbol: closedTrade.symbol || selectedSymbol
      });
      if (lesson) {
        refreshLearning();
      }
    }

    if (soundEnabled) {
      if (isProfit) soundAlert.playBuyAlert();
      else soundAlert.playSellAlert();
    }

    setToastAlert({
      title: isProfit 
        ? `🎯 Chốt Lời! (${closedTrade.side} +${closedTrade.roePercent}%)` 
        : `🛑 Cắt Lỗ & AI Đã Tự Sửa Sai (Gen ${learningEngine.state.generation})`,
      message: isProfit 
        ? `Đã chốt lời $${closedTrade.pnlUsdt} USDT. Mẫu hình đã được củng cố vào bộ nhớ AI.`
        : `AI đã mổ xẻ nguyên nhân và hiệu chỉnh tham số: ${lesson?.actionTaken || 'Đã nới lỏng đệm hỗ trợ.'}`,
      action: isProfit ? 'BUY' : 'SELL',
      time: closedTrade.closedAt
    });

    // Post to ChatBot
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `🔔 **[BÁO CÁO KẾT QUẢ GIAO DỊCH]** (${closedTrade.closedAt})
- Lệnh: **${closedTrade.side} ${closedTrade.leverage}x (BTC/USDT)**
- Lý do đóng: **${closedTrade.reason}**
- Điểm vào: **$${closedTrade.entryPrice?.toLocaleString()}** ➜ Điểm ra: **$${closedTrade.exitPrice?.toLocaleString()}**
- 💰 **Lợi nhuận (ROE%):** **${isProfit ? '🟢 +' : '🔴 '}${closedTrade.roePercent}%**
- 💵 **P&L Ròng:** **${isProfit ? '+' : ''}$${closedTrade.pnlUsdt} USDT**
${lesson ? `\n🧠 **[AI TỰ HỌC & CẢI TIẾN CHIẾN LƯỢC - GEN ${learningEngine.state.generation}]:**\n- 🔍 *Phân tích sai lệch:* ${lesson.reason}\n- 🛠️ *Hành động tự sửa sai:* **${lesson.actionTaken}**` : ''}`,
        time: closedTrade.closedAt
      }
    ]);
  }, [newsContext, snapshot, soundEnabled, refreshLearning]);

  useEffect(() => {
    handleTradeClosedOutcomeRef.current = handleTradeClosedOutcome;
  }, [handleTradeClosedOutcome]);

  // Connect and sync with 24/7 Raspberry Pi 5 Backend Daemon
  useEffect(() => {
    serverSync.connect({
      onStatusChange: (online) => {
        setIsServerOnline(online);
        isServerOnlineRef.current = online;
      },
      onMessage: (type, payload) => {
        if (type === 'INIT_STATE') {
          if (payload?.status?.positions !== undefined) {
            simulator.state.positions = payload.status.positions || [];
            if (payload.status.balance !== undefined) simulator.state.balance = payload.status.balance;
            if (payload.analytics?.history && payload.analytics.history.length > 0) {
              simulator.state.history = payload.analytics.history;
            } else if (payload.status?.history) {
              simulator.state.history = payload.status.history;
            }
            simulator.saveState();
            refreshSimulator();
          }
          if (payload?.status?.brain) {
            learningEngine.state = {
              ...learningEngine.state,
              ...payload.status.brain,
              coinProfiles: {
                ...DEFAULT_COIN_PROFILES,
                ...(payload.status.brain.coinProfiles || {})
              }
            };
            learningEngine.saveState();
            refreshLearning();
          }
          if (payload?.status?.btcDominance) {
            setBtcDominance(payload.status.btcDominance);
          }
          if (payload?.status?.futuresMetrics) {
            setFuturesMetrics(payload.status.futuresMetrics);
          }
          if (payload?.status?.circuitBreaker) {
            setCircuitBreaker(payload.status.circuitBreaker);
          }
        } else if (type === 'BTCDOM_SYNC') {
          if (payload) {
            setBtcDominance(payload);
          }
        } else if (type === 'FUTURES_METRICS_SYNC') {
          if (payload) {
            setFuturesMetrics(payload);
          }
        } else if (type === 'CIRCUIT_BREAKER_SYNC') {
          if (payload) {
            setCircuitBreaker(payload);
            if (payload.isTripped) {
              setToastAlert({
                title: '🛡️ [CẦU CHÌ AN TOÀN KÍCH HOẠT]',
                message: payload.reason,
                action: 'SELL',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              });
            }
          }
        } else if (type === 'TRADE_OPENED') {
          const exists = (simulator.state.positions || []).some(p => p.id === payload.id);
          if (!exists) {
            simulator.state.positions = [...(simulator.state.positions || []), payload];
          }
          refreshSimulator();
          if (soundEnabled) {
            if (payload.side === 'LONG') soundAlert.playBuyAlert();
            else soundAlert.playSellAlert();
          }
          const pairName = payload.symbol || 'BTC/USDT';
          setToastAlert({
            title: `⚡ [PI 5 SERVER 24/7] Vừa Khớp Lệnh ${pairName}`,
            message: `Khớp ${payload.side} ${payload.leverage}x tại $${payload.entryPrice?.toLocaleString()} | TP: $${payload.takeProfit?.toLocaleString()} | SL: $${payload.stopLoss?.toLocaleString()}`,
            action: payload.side === 'LONG' ? 'BUY' : 'SELL',
            time: payload.openedAt
          });
        } else if (type === 'TRADE_CLOSED') {
          if (payload?.trade?.id) {
            simulator.state.positions = (simulator.state.positions || []).filter(p => p.id !== payload.trade.id);
          }
          if (payload?.simulator?.positions) {
            simulator.state.positions = payload.simulator.positions;
          }
          if (payload?.simulator?.balance !== undefined) {
            simulator.state.balance = payload.simulator.balance;
          }
          if (payload?.trade) {
            if (!simulator.state.history.some(h => h.id === payload.trade.id)) {
              simulator.state.history.unshift(payload.trade);
            }
          }
          if (payload?.brain) {
            learningEngine.state = {
              ...learningEngine.state,
              ...payload.brain,
              coinProfiles: {
                ...DEFAULT_COIN_PROFILES,
                ...(payload.brain.coinProfiles || {})
              }
            };
            learningEngine.saveState();
            refreshLearning();
          }
          refreshSimulator();
          if (payload?.trade) {
            handleTradeClosedOutcome(payload.trade, payload.lesson);
          }
        } else if (type === 'TICK') {
          const tickSym = (payload?.symbol || 'BTCUSDT').replace('/', '').toUpperCase();
          if (tickSym === selectedSymbol) {
            if (payload?.price) {
              setLivePrice(payload.price);
              livePriceRef.current = payload.price;
              setSnapshot((prev) => prev ? { ...prev, currentPrice: payload.price } : prev);
            }
            if (payload?.liveCandle) {
              const candle = payload.liveCandle;
              setLatestLiveCandle(candle);

              // Only advance historical candles on bar close with price magnitude guard
              if (candle.isClosed) {
                setCandles((prev) => {
                  if (!prev || prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  // Guard: never merge candles from different coins
                  if (last.close > 0) {
                    const ratio = candle.close / last.close;
                    if (ratio > 3 || ratio < 0.3) return prev;
                  }
                  if (candle.time === last.time) {
                    return [...prev.slice(0, -1), candle];
                  } else if (candle.time > last.time) {
                    return [...prev, candle];
                  }
                  return prev;
                });
              }
            }
          }
        }
      }
    });
  }, [selectedSymbol, refreshSimulator, refreshLearning, soundEnabled, handleTradeClosedOutcome]);



  const [aiConfig, setAiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('kt1_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          geminiKey: parsed.geminiKey || DEFAULT_CONFIG.geminiKey,
          provider: parsed.provider || DEFAULT_CONFIG.provider,
          geminiModel: (parsed.geminiModel && !parsed.geminiModel.includes('1.5') && !parsed.geminiModel.includes('2.5') && !parsed.geminiModel.includes('1.0'))
            ? parsed.geminiModel
            : 'gemini-3.8-flash'
        };
      }
      return DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [chatMessages, setChatMessages] = useState([INITIAL_WELCOME_MESSAGE]);

  // Save config to localStorage
  const handleSaveConfig = (newConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('kt1_ai_config', JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  // 0. Periodic News Context Fetcher (every 60s)
  useEffect(() => {
    let isMounted = true;
    async function loadNewsContext() {
      try {
        const newsList = await fetchCryptoNews();
        if (!isMounted || !newsList || newsList.length === 0) return;
        const total = newsList.length;
        const bulls = newsList.filter(n => n.sentiment === 'bullish').length;
        const bears = newsList.filter(n => n.sentiment === 'bearish').length;
        const bullPct = Math.round((bulls / total) * 100);
        const overallSentiment = bullPct >= 55 ? 'bullish' : (bullPct <= 45 ? 'bearish' : 'neutral');
        
        const ctx = {
          sentiment: overallSentiment,
          sentimentLabel: overallSentiment === 'bullish' ? 'Tích cực (Bullish)' : (overallSentiment === 'bearish' ? 'Tiêu cực (Bearish)' : 'Trung lập (Neutral)'),
          bullPercent: bullPct,
          topNewsTitle: newsList[0]?.title || ''
        };
        setNewsContext(ctx);
      } catch (e) {
        console.warn('Error loading news context:', e);
      }
    }

    loadNewsContext();
    const interval = setInterval(loadNewsContext, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-Trade execution handler: Enters trade immediately if conditions match and no trade is currently open for this coin
  const tryExecuteAutonomousTrade = useCallback((sig, currentCandles, currentSnap) => {
    if (!sig || !currentSnap) return false;
    if (!simulator.state.isAutoTradeActive) return false;

    const activeCoinSym = (sig.symbol || selectedSymbol).replace('/', '').toUpperCase();
    const hasOpenPosForCoin = (simulator.state.positions || []).some(p => (p.symbol || '').replace('/', '').toUpperCase() === activeCoinSym);
    if (hasOpenPosForCoin) return false;
    if (simulator.state.positions.length >= 3) return false;

    const minConfidence = learningState.adaptiveParams.minConfidence || 65;
    const isActionable = (sig.action === 'BUY' || sig.action === 'SELL') && sig.confidence >= minConfidence;
    if (!isActionable) return false;

    // Cooldown check (20 seconds between trade openings)
    const now = Date.now();
    if (lastAutoTradeTimeRef.current && (now - lastAutoTradeTimeRef.current < 20000)) {
      return false;
    }

    const autoExecutionPrice = livePriceRef.current || livePrice || currentSnap.currentPrice;
    const lastCandle = currentCandles && currentCandles.length > 0 ? currentCandles[currentCandles.length - 1] : null;
    const candleTime = lastCandle ? lastCandle.time : Math.floor(Date.now() / 1000);
    const safeLev = Math.min(simulator.state.leverage, learningState.adaptiveParams.maxLeverageCap || (activeCoinSym === 'SUIUSDT' ? 10 : 20));

    const tradeRes = simulator.openPosition({
      symbol: sig.pairName || `${activeCoinSym.replace('USDT', '')}/USDT`,
      side: sig.action,
      currentPrice: autoExecutionPrice,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit1,
      leverage: safeLev,
      candleTime
    });

    if (tradeRes.success) {
      lastAutoTradeTimeRef.current = now;
      refreshSimulator();

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (soundEnabled) {
        if (sig.action === 'BUY') soundAlert.playBuyAlert();
        else if (sig.action === 'SELL') soundAlert.playSellAlert();
      }

      setToastAlert({
        title: `⚡ [AUTO TRADE ĐÃ KHỚP LỆNH] ${sig.pairName || activeCoinSym}`,
        message: `Đã mở vị thế ${sig.action === 'BUY' ? 'LONG' : 'SHORT'} ${safeLev}x tại $${autoExecutionPrice.toLocaleString()} | SL: $${sig.stopLoss?.toLocaleString()} | TP: $${sig.takeProfit1?.toLocaleString()}`,
        action: sig.action,
        time: timestamp
      });

      // Post notice to ChatBot
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚡ **[AUTO TRADE VỪA KHỚP VỊ THẾ ${sig.action === 'BUY' ? 'LONG' : 'SHORT'} ${safeLev}x (${sig.pairName || activeCoinSym})]** (${timestamp})
- 🎯 **Entry:** **$${autoExecutionPrice.toLocaleString()}**
- 🛑 **Stop Loss (SL):** **$${sig.stopLoss?.toLocaleString()}**
- 🚀 **Take Profit (TP):** **$${sig.takeProfit1?.toLocaleString()}**
- 📊 **Hiển thị trực quan:** Đã mở tại **Bảng Vị Thế Đang Mở** và hiển thị **Mũi tên chỉ hướng** trực tiếp trên nến biểu đồ!`,
          time: timestamp
        }
      ]);

      return true;
    }
    return false;
  }, [learningState.adaptiveParams, livePrice, refreshSimulator, selectedSymbol, soundEnabled]);

  // Prefetch popular timeframes in background on app startup for 0ms instant switching
  useEffect(() => {
    prefetchPopularTimeframes(selectedSymbol);
  }, [selectedSymbol]);

  // Instant zero-latency timeframe switch handler
  const handleTimeframeChange = useCallback((newTf) => {
    if (newTf === timeframe) return;

    // ⚡ ZERO LATENCY: Update candles and snapshot immediately from in-memory cache
    const cached = getCachedKlines(selectedSymbol, newTf);
    if (cached && cached.length > 0) {
      setCandles(cached);
      const snap = generateTechnicalSnapshot(cached, newTf, selectedSymbol);
      setSnapshot(snap);
      if (snap) {
        const sig = generateBuiltinSignal(snap, cached, newsContext, learningState.adaptiveParams, btcDominance, selectedSymbol);
        setCurrentSignal(sig);
      }
    }
    setTimeframe(newTf);
  }, [timeframe, selectedSymbol, newsContext, learningState.adaptiveParams, btcDominance]);

  // Seamless zero-jitter coin switch handler
  const handleSelectSymbol = useCallback((newSymbol) => {
    if (newSymbol === selectedSymbol) return;

    // 1. Reset live candle and stale snapshot immediately to prevent mixing coins
    setLatestLiveCandle(null);
    setSnapshot(null);
    setCurrentSignal(null);

    // Immediately switch 24h ticker display to match the newly selected coin
    if (multiTickers && multiTickers[newSymbol]) {
      setTicker(multiTickers[newSymbol]);
      if (multiTickers[newSymbol].lastPrice) {
        setLivePrice(multiTickers[newSymbol].lastPrice);
        livePriceRef.current = multiTickers[newSymbol].lastPrice;
      }
    } else {
      setTicker(null);
    }

    // 2. Validate cache before using: ensure cached data belongs to the new coin
    const cached = getCachedKlines(newSymbol, timeframe);
    let validCache = false;
    if (cached && cached.length > 0) {
      const avgPrice = cached[cached.length - 1].close;
      if (newSymbol.startsWith('SUI') && avgPrice < 10) validCache = true;
      else if (newSymbol.startsWith('SOL') && avgPrice > 20 && avgPrice < 1000) validCache = true;
      else if (newSymbol.startsWith('ETH') && avgPrice > 1000 && avgPrice < 10000) validCache = true;
      else if (newSymbol.startsWith('BTC') && avgPrice > 20000) validCache = true;
    }

    if (validCache) {
      setCandles(cached);
      const initPrice = cached[cached.length - 1].close;
      setLivePrice(initPrice);
      livePriceRef.current = initPrice;
      const snap = generateTechnicalSnapshot(cached, timeframe, newSymbol);
      setSnapshot(snap);
      if (snap) {
        const sig = generateBuiltinSignal(snap, cached, newsContext, learningState.adaptiveParams, btcDominance, newSymbol);
        setCurrentSignal(sig);
      }
    } else {
      // Clear candles while loading fresh from API
      setCandles([]);
    }

    setSelectedSymbol(newSymbol);
  }, [selectedSymbol, timeframe, newsContext, learningState.adaptiveParams, btcDominance, multiTickers]);

  // 1. Initial Load & Timeframe/Coin Change
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const data = await fetchKlines(selectedSymbol, timeframe, 300);
        if (!isMounted) return;
        setCandles(data);

        if (data.length > 0) {
          const initPrice = data[data.length - 1].close;
          setLivePrice(initPrice);
          livePriceRef.current = initPrice;
        }

        const snap = generateTechnicalSnapshot(data, timeframe, selectedSymbol);
        setSnapshot(snap);

        if (snap) {
          const sig = generateBuiltinSignal(snap, data, newsContext, learningState.adaptiveParams, btcDominance, selectedSymbol);
          setCurrentSignal(sig);
          prevSignalActionRef.current = sig.action;
        }
      } catch (err) {
        console.error('Error fetching initial klines:', err);
      }
    }

    loadData();

    // Subscribe to WebSocket with auto REST fallback
    const unsubscribe = subscribeKlineWebSocket(
      selectedSymbol,
      timeframe,
      (liveCandle) => {
        if (!isMounted) return;
        setLatestLiveCandle(liveCandle);

        // Update live price reference immediately on every tick
        setLivePrice(liveCandle.close);
        livePriceRef.current = liveCandle.close;

        // Keep snapshot current price in sync with every tick
        setSnapshot((prev) => prev ? { ...prev, currentPrice: liveCandle.close } : prev);

        // Update simulator positions with latest price tick across all coins
        if (isServerOnlineRef.current) {
          // Connected to Pi 5 Daemon: Daemon is 24/7 authority for TP/SL execution.
          if (simulator.state.positions && simulator.state.positions.length > 0) {
            for (const pos of simulator.state.positions) {
              const posSym = (pos.symbol || 'BTC/USDT').replace('/', '').toUpperCase();
              let curP = null;
              if (posSym === selectedSymbol) {
                curP = liveCandle.close;
              } else if (multiTickersRef.current?.[posSym]?.lastPrice) {
                curP = multiTickersRef.current[posSym].lastPrice;
              }
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
            refreshSimulator();
          }
        } else {
          // Offline fallback mode: Client runs local simulator
          const { triggeredEvents } = simulator.updatePriceTick(liveCandle.close, selectedSymbol);
          if (triggeredEvents && triggeredEvents.length > 0) {
            refreshSimulator();
            for (const ev of triggeredEvents) {
              handleTradeClosedOutcomeRef.current?.(ev.trade);
            }
          } else {
            refreshSimulator();
          }
        }

        // Only advance candle historical array on bar close to prevent continuous chart canvas redraws
        if (liveCandle.isClosed) {
          setCandles((prev) => {
            if (!prev || prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            // Guard: never merge candles from different coins
            if (last.close > 0) {
              const ratio = liveCandle.close / last.close;
              if (ratio > 3 || ratio < 0.3) return prev;
            }
            let updated;

            if (liveCandle.time === last.time) {
              updated = [...prev.slice(0, -1), liveCandle];
            } else if (liveCandle.time > last.time) {
              updated = [...prev, liveCandle];
            } else {
              updated = prev;
            }

            const newSnap = generateTechnicalSnapshot(updated, timeframe, selectedSymbol);
            setSnapshot(newSnap);
            return updated;
          });
        }
      },
      (status) => {
        if (isMounted) setWsStatus(status);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedSymbol, timeframe, newsContext, learningState.adaptiveParams, btcDominance, refreshSimulator]);

  // 2. Fetch 24h Ticker periodically for all 4 supported pairs
  useEffect(() => {
    let isMounted = true;

    async function updateAllTickers() {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT'];
      const results = await Promise.allSettled(symbols.map(s => fetch24hrTicker(s)));
      if (!isMounted) return;

      const newTickers = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value) {
          newTickers[symbols[i]] = res.value;
        }
      });

      setMultiTickers(newTickers);
      multiTickersRef.current = newTickers;

      // Immediately sync all open positions (ETH, SOL, SUI, BTC) with latest market prices
      if (simulator.state.positions && simulator.state.positions.length > 0) {
        let hasUpdatedPositions = false;
        for (const pos of simulator.state.positions) {
          const posSym = (pos.symbol || 'BTC/USDT').replace('/', '').toUpperCase();
          const tickerForSym = newTickers[posSym];
          if (tickerForSym && tickerForSym.lastPrice && pos.entryPrice) {
            const p = tickerForSym.lastPrice;
            pos.currentPrice = p;
            const isLong = pos.side === 'LONG';
            const diffRatio = isLong
              ? (p - pos.entryPrice) / pos.entryPrice
              : (pos.entryPrice - p) / pos.entryPrice;
            pos.roePercent = parseFloat((diffRatio * pos.leverage * 100).toFixed(2));
            pos.unrealizedPnl = parseFloat((pos.margin * (pos.roePercent / 100)).toFixed(2));
            hasUpdatedPositions = true;
          }
        }
        if (hasUpdatedPositions) {
          refreshSimulator();
        }
      }

      const activeData = newTickers[selectedSymbol];
      if (activeData) {
        setTicker(activeData);
        if (activeData.lastPrice) {
          setLivePrice(activeData.lastPrice);
          livePriceRef.current = activeData.lastPrice;
          setSnapshot((prev) => prev ? { ...prev, currentPrice: activeData.lastPrice } : prev);
          const { triggeredEvents } = simulator.updatePriceTick(activeData.lastPrice, selectedSymbol);
          if (triggeredEvents && triggeredEvents.length > 0) {
            refreshSimulator();
            for (const ev of triggeredEvents) {
              handleTradeClosedOutcome(ev.trade);
            }
          }
        }
      }
    }

    updateAllTickers();
    const interval = setInterval(updateAllTickers, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedSymbol, refreshSimulator, handleTradeClosedOutcome]);

  // 3. Autonomous 24/7 Scanner Bot Engine (HTF Support/Resistance, News Confluence & Adaptive Learning)
  useEffect(() => {
    if (!isBot247Active || !snapshot || candles.length === 0) return;

    const botTimer = setInterval(() => {
      const currentSnap = generateTechnicalSnapshot(candles, timeframe, selectedSymbol);
      if (!currentSnap) return;

      const newSig = generateBuiltinSignal(currentSnap, candles, newsContext, learningState.adaptiveParams, btcDominance, selectedSymbol);
      setCurrentSignal(newSig);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Check if actionable signal detected using dynamically adapted confidence threshold
      const minConfidence = learningState.adaptiveParams.minConfidence || 65;
      const isActionable = (newSig.action === 'BUY' || newSig.action === 'SELL') && newSig.confidence >= minConfidence;
      const isNewAction = newSig.action !== prevSignalActionRef.current;

      // 1. Autonomous Entry & Reversal Exit: Only execute locally if server daemon is OFFLINE
      let didOpenTrade = false;
      if (!isServerOnlineRef.current) {
        didOpenTrade = tryExecuteAutonomousTrade(newSig, candles, currentSnap);

        // 2. Autonomous Exit / Capital Protection: If a position is open FOR THIS COIN, check if opposing strong signal triggers early exit
        if (simulator.state.positions.length > 0) {
          const currentCleanSym = selectedSymbol.replace('/', '').toUpperCase();
          const activePos = simulator.state.positions.find(p => (p.symbol || '').replace('/', '').toUpperCase() === currentCleanSym);
          if (activePos) {
            const isOpposingReversal = (activePos.side === 'LONG' && newSig.action === 'SELL' && newSig.confidence >= 75) ||
                                       (activePos.side === 'SHORT' && newSig.action === 'BUY' && newSig.confidence >= 75);
            if (isOpposingReversal) {
              const coinTicker = multiTickers?.[currentCleanSym];
              const autoExecutionPrice = coinTicker?.lastPrice || (livePriceRef.current || livePrice || currentSnap.currentPrice);
              const closed = simulator.closePosition(activePos.id, autoExecutionPrice, '🔄 AI Đảo Chiều Xu Hướng (Bảo Vệ Vốn)');
              if (closed) {
                refreshSimulator();
                handleTradeClosedOutcomeRef.current?.(closed);
              }
            }
          }
        }
      }

      if (isActionable && (isNewAction || didOpenTrade)) {
        if (soundEnabled && !didOpenTrade) {
          if (newSig.action === 'BUY') soundAlert.playBuyAlert();
          else if (newSig.action === 'SELL') soundAlert.playSellAlert();
        }

        const autoExecutionPrice = livePriceRef.current || livePrice || currentSnap.currentPrice;
        const pairName = selectedSymbol.replace('USDT', '/USDT');

        // Show Toast Popup if not already shown by trade opening
        if (!didOpenTrade) {
          setToastAlert({
            title: `Tín hiệu ${pairName} (${timeframe.toUpperCase()}): ${newSig.signalType} (Gen ${learningState.generation})`,
            message: `${pairName} ($${autoExecutionPrice.toLocaleString()}): Độ tin cậy ${newSig.confidence}% ≥ ${minConfidence}% chuẩn thích ứng!`,
            action: newSig.action,
            entryZone: newSig.entryZone,
            stopLoss: newSig.stopLoss,
            takeProfit1: newSig.takeProfit1,
            time: timestamp
          });
        }

        // Add to 24/7 Signal Journal
        setSignalJournal((prev) => [
          {
            ...newSig,
            price: autoExecutionPrice,
            timestamp,
            timeframe
          },
          ...prev.slice(0, 49)
        ]);

        prevSignalActionRef.current = newSig.action;
      }
    }, scanIntervalSec * 1000);

    return () => clearInterval(botTimer);
  }, [isBot247Active, snapshot, candles, timeframe, selectedSymbol, scanIntervalSec, soundEnabled, refreshSimulator, newsContext, livePrice, learningState.adaptiveParams, btcDominance, tryExecuteAutonomousTrade]);

  // 4. Trigger AI Analysis
  const handleTriggerAnalysis = useCallback(async (customQuery = null) => {
    if (isAnalyzing || !snapshot) return;

    setIsAnalyzing(true);
    const pairName = selectedSymbol.replace('USDT', '/USDT');
    const query = customQuery || `Dựa trên đồ thị nến ${pairName} khung lớn ${timeframe.toUpperCase()}, các vùng Hỗ Trợ/Kháng Cự cụ thể đã kẻ trên biểu đồ và tình hình tin tức thị trường lúc này, hãy phân tích toàn diện và đưa ra lời khuyên: vùng giá vào lệnh tối ưu tại Hỗ trợ, mức Cắt lỗ (SL), các mục tiêu Chốt lời (TP) và kịch bản ứng phó.`;

    if (customQuery) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: customQuery,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: `⚡ Phân tích chiến lược Hỗ Trợ & Kháng Cự ${pairName} khung lớn (${timeframe.toUpperCase()}) + Tin tức thị trường`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }

    try {
      const response = await askAIAdvisor({
        userPrompt: query,
        chatHistory: chatMessages.slice(-6),
        snapshot,
        candles,
        config: aiConfig,
        newsContext,
        btcDominance,
        selectedSymbol
      });

      const sig = generateBuiltinSignal(snapshot, candles, newsContext, learningEngine.state.adaptiveParams, btcDominance, selectedSymbol);
      setCurrentSignal(sig);

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      console.error('AI Analysis failed, falling back to Quant Engine:', err);
      const answer = generateBuiltinAnswer(query, snapshot, candles, newsContext, btcDominance, learningEngine.state.adaptiveParams, selectedSymbol);
      const sig = generateBuiltinSignal(snapshot, candles, newsContext, learningEngine.state.adaptiveParams, btcDominance, selectedSymbol);
      setCurrentSignal(sig);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, snapshot, timeframe, chatMessages, candles, aiConfig, newsContext]);

  // 5. Handle News Impact Analysis from NewsBot
  const handleAnalyzeNewsImpact = (newsItem) => {
    setActiveTab('chat');
    const prompt = `📰 PHÂN TÍCH TÁC ĐỘNG TIN TỨC ĐẾN VÙNG HỖ TRỢ & KHÁNG CỰ BITCOIN (BTC/USDT):
- Tiêu đề tin tức: "${newsItem.title}"
- Nội dung: "${newsItem.description}"
- Đánh giá sắc thái: ${newsItem.sentimentLabel}
- Giá BTC hiện tại: $${(livePriceRef.current || snapshot?.currentPrice)?.toLocaleString()}
- Vùng Hỗ Trợ 1 (S1): ${snapshot?.supportResistance?.supportZone1}
- Vùng Kháng Cự 1 (R1): ${snapshot?.supportResistance?.resistanceZone1}

Hãy phân tích chi tiết:
1. Tin tức này có đủ mạnh để bẻ gãy Vùng Hỗ Trợ S1 hoặc xuyên thủng Vùng Kháng Cự R1 không?
2. Kịch bản phản ứng giá BTC/USDT trên khung 1H/4H/1D?
3. Khuyến nghị hành động: Nên đặt lệnh chờ tại Hỗ trợ hay đứng ngoài quan sát?`;

    handleTriggerAnalysis(prompt);
  };

  // 6. Simulator Handlers
  const handleToggleAutoTrade = (active) => {
    simulator.setAutoTrade(active);
    refreshSimulator();
  };

  const handleResetAccount = () => {
    if (window.confirm('Khôi phục số dư về $100 USDT ban đầu và xóa lịch sử lệnh?')) {
      serverSync.resetAccount();
      simulator.resetAccount(100);
      refreshSimulator();
    }
  };

  const handleClosePosition = (id) => {
    const pos = (simulatorState.positions || []).find(p => p.id === id);
    const posSym = (pos?.symbol || selectedSymbol).replace('/', '').toUpperCase();
    const coinTicker = multiTickers?.[posSym];
    const isCurrentSelectedCoin = selectedSymbol.replace('/', '').toUpperCase() === posSym;
    const curPrice = coinTicker?.lastPrice || (isCurrentSelectedCoin ? (livePriceRef.current || livePrice) : null) || pos?.currentPrice || pos?.entryPrice || 0;

    serverSync.closePosition(id, '⚡ Đóng tay', curPrice);
    const closed = simulator.closePosition(id, curPrice, '⚡ Đóng tay');
    if (closed) {
      refreshSimulator();
      handleTradeClosedOutcome(closed);
    }
  };

  const handleResetLearning = () => {
    if (window.confirm('Khôi phục Bộ Não Tự Học về Generation 1 ban đầu?')) {
      learningEngine.resetLearning();
      refreshLearning();
      setToastAlert({
        title: 'Đã Đặt Lại Bộ Não Tự Học',
        message: 'Toàn bộ trọng số thích ứng đã khôi phục về Generation 1 nguyên bản.',
        action: 'BUY',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  };

  const handleClearChat = () => {
    setChatMessages([INITIAL_WELCOME_MESSAGE]);
  };

  return (
    <div className="terminal-layout">
      {/* Top Header */}
      <Header
        ticker={ticker}
        wsStatus={wsStatus}
        isServerOnline={isServerOnline}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerAnalysis={() => handleTriggerAnalysis()}
        isAnalyzing={isAnalyzing}
        aiConfig={aiConfig}
        isBot247Active={isBot247Active}
        onToggleBot247={() => setIsBot247Active(!isBot247Active)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        learningGeneration={learningState.generation}
        btcDominance={btcDominance}
        futuresMetrics={futuresMetrics}
        circuitBreaker={circuitBreaker}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        multiTickers={multiTickers}
      />

      {/* Main Workspace */}
      <div className="terminal-body">
        {/* Left Column: Trading Chart & Technical Indicators */}
        <div className={`terminal-left-pane ${activeTab !== 'chart' ? 'hide-mobile-pane' : ''}`}>
          <IndicatorsBar 
            snapshot={snapshot} 
            btcDominance={btcDominance} 
            futuresMetrics={futuresMetrics} 
          />

          <div className="chart-section">
            <Chart
              candles={candles}
              timeframe={timeframe}
              onTimeframeChange={handleTimeframeChange}
              signal={currentSignal}
              latestLiveCandle={latestLiveCandle}
              snapshot={snapshot}
              positions={simulatorState.positions}
              trades={simulatorState.history}
              livePrice={livePriceRef.current || livePrice || snapshot?.currentPrice}
              symbol={selectedSymbol}
            />
          </div>

          <div className="signal-card-section">
            <SignalCard 
              signal={currentSignal} 
              onRefresh={() => handleTriggerAnalysis()}
              isAnalyzing={isAnalyzing}
              newsContext={newsContext}
            />
          </div>
        </div>

        {/* Right Column: Multi-tab Panel */}
        <div className={`terminal-right-pane ${activeTab === 'chart' ? 'hide-mobile-pane' : ''}`}>
          {activeTab === 'chat' && (
            <ChatBot
              messages={chatMessages}
              onSendMessage={(msg) => handleTriggerAnalysis(msg)}
              onClearChat={handleClearChat}
              isLoading={isAnalyzing}
              aiConfig={aiConfig}
              selectedSymbol={selectedSymbol}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'autotrade' && (
            <AutoTradeSimulator
              simulatorState={simulatorState}
              accountSummary={accountSummary}
              currentPrice={livePrice || ticker?.lastPrice || snapshot?.currentPrice}
              multiTickers={multiTickers}
              selectedSymbol={selectedSymbol}
              onToggleAutoTrade={handleToggleAutoTrade}
              onResetAccount={handleResetAccount}
              onClosePosition={handleClosePosition}
            />
          )}

          {activeTab === 'news' && (
            <NewsBot
              onAnalyzeNewsImpact={handleAnalyzeNewsImpact}
              isAnalyzing={isAnalyzing}
            />
          )}

          {activeTab === 'journal' && (
            <SignalJournal
              journal={signalJournal}
              onClearJournal={() => setSignalJournal([])}
              isBotActive={isBot247Active}
              scanIntervalSec={scanIntervalSec}
            />
          )}

          {activeTab === 'analytics' && (
            <PerformanceAnalytics />
          )}

          {activeTab === 'learning' && (
            <SelfLearningPanel
              learningState={learningState}
              onResetLearning={handleResetLearning}
              marketRegime={snapshot?.regime}
              selectedSymbol={selectedSymbol}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile screens < 1024px) */}
      <nav className="mobile-bottom-nav show-mobile-only">
        <button 
          className={`mobile-nav-btn ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
        >
          <TrendingUp size={18} />
          <span>Biểu Đồ</span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'autotrade' ? 'active' : ''}`}
          onClick={() => setActiveTab('autotrade')}
        >
          <Zap size={18} className="text-cyan" />
          <span>Auto Trade</span>
          {simulatorState.positions?.length > 0 && (
            <span className="mobile-nav-badge">{simulatorState.positions.length}</span>
          )}
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={18} />
          <span>AI Chat</span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={18} />
          <span>Hiệu Suất</span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'learning' ? 'active' : ''}`}
          onClick={() => setActiveTab('learning')}
        >
          <BrainCircuit size={18} />
          <span>Tự Học</span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'news' || activeTab === 'journal' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'news' ? 'journal' : 'news')}
        >
          <Newspaper size={18} />
          <span>{activeTab === 'journal' ? 'Nhật Ký' : 'Tin Tức'}</span>
        </button>
      </nav>

      {/* Floating Real-time Toast Alert */}
      {toastAlert && (
        <ToastAlert 
          toast={toastAlert} 
          onClose={() => setToastAlert(null)} 
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={aiConfig}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
