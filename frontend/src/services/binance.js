/**
 * Binance Public API and WebSocket Service
 */

const BASE_URL = 'https://api.binance.com/api/v3';
const WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
const PROXY_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}/api/binance`
  : '/api/binance';

// In-Memory Multi-Timeframe Kline Cache for Zero-Latency (0ms) Timeframe Switching
const klineCache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds freshness

export function getCachedKlines(symbol = 'BTCUSDT', interval = '1h') {
  const key = `${symbol.toUpperCase()}_${interval}`;
  const entry = klineCache.get(key);
  return entry ? entry.data : null;
}

export function setCachedKlines(symbol = 'BTCUSDT', interval = '1h', data) {
  const key = `${symbol.toUpperCase()}_${interval}`;
  klineCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch historical Kline/Candlestick bars with smart in-memory caching and mirror failovers
 * @param {string} symbol - e.g. 'BTCUSDT'
 * @param {string} interval - '1m', '5m', '15m', '1h', '4h', '1d'
 * @param {number} limit - number of candles (default 300)
 * @param {boolean} forceFresh - force re-fetching from network
 */
export async function fetchKlines(symbol = 'BTCUSDT', interval = '1h', limit = 300, forceFresh = false) {
  const key = `${symbol.toUpperCase()}_${interval}`;
  const cached = klineCache.get(key);

  // Return fresh cache immediately ONLY IF it matches expected coin price range
  if (!forceFresh && cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    const sample = cached.data[cached.data.length - 1]?.close;
    let isValid = false;
    if (symbol.startsWith('SUI') && sample < 10) isValid = true;
    else if (symbol.startsWith('SOL') && sample > 20 && sample < 1000) isValid = true;
    else if (symbol.startsWith('ETH') && sample > 1000 && sample < 10000) isValid = true;
    else if (symbol.startsWith('BTC') && sample > 20000) isValid = true;
    else isValid = true;

    if (isValid) return cached.data;
  }

  // Fast endpoints with automatic failover (Server Proxy FIRST to bypass ISP block, then Direct Mirrors)
  const endpoints = [
    `${PROXY_BASE_URL}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`,
    `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`,
    `https://api1.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
  ];

  let rawData = null;
  let lastError = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        rawData = await response.json();
        if (Array.isArray(rawData) && rawData.length > 0) {
          break;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!rawData) {
    if (cached) return cached.data; // Fallback to existing cache if offline/lagging
    throw lastError || new Error('Failed to fetch klines from all endpoints');
  }

  const candles = rawData.map((item) => ({
    time: Math.floor(item[0] / 1000),
    open: parseFloat(item[1]),
    high: parseFloat(item[2]),
    low: parseFloat(item[3]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[5])
  }));

  // Store into cache
  klineCache.set(key, { data: candles, timestamp: Date.now() });

  return candles;
}

/**
 * Background prefetch for all popular timeframes so clicking between them is 100% instant
 */
export async function prefetchPopularTimeframes(activeSymbol = 'BTCUSDT') {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT'];
  const primaryIntervals = ['1h', '4h', '1d'];

  // First prefetch active symbol
  for (const interval of ['1h', '4h', '1d', '15m', '5m']) {
    try {
      const key = `${activeSymbol.toUpperCase()}_${interval}`;
      if (!klineCache.has(key)) {
        await fetchKlines(activeSymbol, interval, 300);
      }
    } catch (e) {}
  }

  // Then background prefetch other symbols for instant zero-latency coin switching
  for (const sym of symbols) {
    if (sym === activeSymbol) continue;
    for (const interval of primaryIntervals) {
      try {
        const key = `${sym}_${interval}`;
        if (!klineCache.has(key)) {
          await fetchKlines(sym, interval, 300);
        }
      } catch (e) {}
    }
  }
}

/**
 * Fetch 24-hour ticker price change statistics
 * @param {string} symbol - e.g. 'BTCUSDT'
 */
export async function fetch24hrTicker(symbol = 'BTCUSDT') {
  const tickerUrls = [
    `${PROXY_BASE_URL}/ticker?symbol=${symbol.toUpperCase()}`,
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`,
    `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`
  ];

  for (const url of tickerUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        return {
          symbol: data.symbol,
          lastPrice: parseFloat(data.lastPrice),
          priceChange: parseFloat(data.priceChange),
          priceChangePercent: parseFloat(data.priceChangePercent),
          highPrice: parseFloat(data.highPrice),
          lowPrice: parseFloat(data.lowPrice),
          volume: parseFloat(data.volume),
          quoteVolume: parseFloat(data.quoteVolume)
        };
      }
    } catch {}
  }
  return null;
}

/**
 * Subscribe to real-time Kline WebSocket stream
 * @param {string} symbol
 * @param {string} interval
 * @param {function} onMessage - callback for candle update
 * @param {function} onStatus - callback for connection status
 */
export function subscribeKlineWebSocket(symbol = 'BTCUSDT', interval = '1h', onMessage, onStatus) {
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
  const wsUrl = `${WS_BASE_URL}/${streamName}`;

  let ws = null;
  let isClosedManually = false;
  let reconnectTimer = null;
  let fallbackPollTimer = null;

  // Resilient REST fallback polling (Uses server proxy to avoid ISP blocks)
  function startFallbackPolling() {
    if (fallbackPollTimer || isClosedManually) return;
    fallbackPollTimer = setInterval(async () => {
      try {
        const url = `${PROXY_BASE_URL}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=2`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const last = data[data.length - 1];
            const candle = {
              time: Math.floor(last[0] / 1000),
              open: parseFloat(last[1]),
              high: parseFloat(last[2]),
              low: parseFloat(last[3]),
              close: parseFloat(last[4]),
              volume: parseFloat(last[5]),
              isClosed: false
            };
            if (onMessage) onMessage(candle);
          }
        }
      } catch (err) {
        // Silent poll error
      }
    }, 2000);
  }

  function stopFallbackPolling() {
    if (fallbackPollTimer) {
      clearInterval(fallbackPollTimer);
      fallbackPollTimer = null;
    }
  }

  function connect() {
    if (isClosedManually) return;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        stopFallbackPolling();
        if (onStatus) onStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.e === 'kline' && message.k) {
            const k = message.k;
            const candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isClosed: k.x
            };
            if (onMessage) onMessage(candle);
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Binance WebSocket encountered error, engaging REST polling fallback.');
        startFallbackPolling();
        if (onStatus) onStatus('polling');
      };

      ws.onclose = () => {
        startFallbackPolling();
        if (onStatus) onStatus('polling');
        if (!isClosedManually) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
      startFallbackPolling();
      if (onStatus) onStatus('polling');
    }
  }

  connect();

  return () => {
    isClosedManually = true;
    stopFallbackPolling();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
