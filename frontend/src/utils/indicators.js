/**
 * Technical Indicator Calculations for Crypto Trading (HTF & MTF Support/Resistance Focus)
 */

// Exponential Moving Average (EMA)
export function calculateEMA(data, period) {
  if (!data || data.length < period) return [];
  const k = 2 / (period + 1);
  const emaValues = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let prevEma = sum / period;
  emaValues.push({ time: data[period - 1].time, value: prevEma });

  for (let i = period; i < data.length; i++) {
    const currentClose = data[i].close;
    const currentEma = currentClose * k + prevEma * (1 - k);
    emaValues.push({ time: data[i].time, value: parseFloat(currentEma.toFixed(2)) });
    prevEma = currentEma;
  }

  return emaValues;
}

// Relative Strength Index (RSI)
export function calculateRSI(data, period = 14) {
  if (!data || data.length <= period) return [];
  const rsiValues = [];
  
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const firstRSI = 100 - (100 / (1 + firstRS));
  rsiValues.push({ time: data[period].time, value: parseFloat(firstRSI.toFixed(2)) });

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    rsiValues.push({ time: data[i].time, value: parseFloat(rsi.toFixed(2)) });
  }

  return rsiValues;
}

// MACD (12, 26, 9)
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!data || data.length < slowPeriod + signalPeriod) return null;

  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const fastMap = new Map(fastEMA.map(item => [item.time, item.value]));
  const macdLine = [];

  for (const slow of slowEMA) {
    const fastVal = fastMap.get(slow.time);
    if (fastVal !== undefined) {
      macdLine.push({ time: slow.time, close: fastVal - slow.value });
    }
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const signalMap = new Map(signalLine.map(item => [item.time, item.value]));

  const result = [];
  for (const m of macdLine) {
    const sig = signalMap.get(m.time);
    if (sig !== undefined) {
      const hist = m.close - sig;
      result.push({
        time: m.time,
        macd: parseFloat(m.close.toFixed(2)),
        signal: parseFloat(sig.toFixed(2)),
        histogram: parseFloat(hist.toFixed(2))
      });
    }
  }

  return result;
}

// Bollinger Bands (period = 20, multiplier = 2)
export function calculateBollingerBands(data, period = 20, multiplier = 2) {
  if (!data || data.length < period) return [];
  const bands = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((sum, c) => sum + c.close, 0) / period;
    const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    bands.push({
      time: data[i].time,
      upper: parseFloat((mean + multiplier * stdDev).toFixed(2)),
      middle: parseFloat(mean.toFixed(2)),
      lower: parseFloat((mean - multiplier * stdDev).toFixed(2))
    });
  }

  return bands;
}

export const SUPPORTED_PAIRS = [
  { symbol: 'BTCUSDT', name: 'BTC/USDT', coin: 'BTC', icon: '₿', decimals: 2, defaultLev: 15 },
  { symbol: 'ETHUSDT', name: 'ETH/USDT', coin: 'ETH', icon: 'Ξ', decimals: 2, defaultLev: 15 },
  { symbol: 'SOLUSDT', name: 'SOL/USDT', coin: 'SOL', icon: '◎', decimals: 2, defaultLev: 15 },
  { symbol: 'SUIUSDT', name: 'SUI/USDT', coin: 'SUI', icon: '💧', decimals: 4, defaultLev: 10 }
];

export function getPairConfig(symbol) {
  const clean = (symbol || 'BTCUSDT').replace('/', '').toUpperCase();
  return SUPPORTED_PAIRS.find(p => p.symbol === clean) || SUPPORTED_PAIRS[0];
}

export function formatPairPrice(price, symbol) {
  if (price === undefined || price === null || isNaN(price)) return '$0.00';
  const cfg = getPairConfig(symbol);
  const num = parseFloat(price);
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals
  });
}

/**
 * Concrete Support and Resistance Levels with Zone Widths
 * Evaluates swing highs and swing lows across lookback periods
 */
export function findSupportResistance(data, lookback = 80, symbol = 'BTCUSDT') {
  if (!data || data.length < 20) {
    return {
      support1: 0,
      support2: 0,
      resistance1: 0,
      resistance2: 0,
      supportZone1: '',
      supportZone2: '',
      resistanceZone1: '',
      resistanceZone2: '',
      allSupports: [],
      allResistances: []
    };
  }

  const cfg = getPairConfig(symbol);
  const roundLevel = (val) => parseFloat(Number(val).toFixed(cfg.decimals));

  const subset = data.slice(-lookback);
  const currentPrice = subset[subset.length - 1].close;
  const weightedHighs = [];
  const weightedLows = [];

  // Helper: Analyze candlestick wick rejection magnitude
  const analyzeCandleWick = (c) => {
    const range = c.high - c.low;
    if (range <= 0) return { upperRatio: 0, lowerRatio: 0, isUpperReject: false, isLowerReject: false };
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const body = Math.abs(c.close - c.open);
    const upperRatio = upperWick / range;
    const lowerRatio = lowerWick / range;
    const isUpperReject = upperRatio >= 0.38 || (body > 0 && upperWick >= body * 1.3);
    const isLowerReject = lowerRatio >= 0.38 || (body > 0 && lowerWick >= body * 1.3);
    return { upperRatio, lowerRatio, isUpperReject, isLowerReject };
  };

  // 1. Synthesize 4H and 1D candles to identify Higher-Timeframe (HTF) Pinbars / Rejections
  const aggregateCandles = (candles, period) => {
    const agg = [];
    for (let i = 0; i < candles.length; i += period) {
      const chunk = candles.slice(i, i + period);
      if (chunk.length === 0) continue;
      agg.push({
        open: chunk[0].open,
        high: Math.max(...chunk.map(k => k.high)),
        low: Math.min(...chunk.map(k => k.low)),
        close: chunk[chunk.length - 1].close
      });
    }
    return agg;
  };

  const candles4h = aggregateCandles(subset, 4);
  const candles1d = aggregateCandles(subset, 24);

  // Scan 1D Rejections (Weight 5.0 - Highest Priority Cản/Hỗ Trợ Tối Thượng)
  for (const c of candles1d) {
    const { isUpperReject, isLowerReject } = analyzeCandleWick(c);
    if (isUpperReject) {
      weightedHighs.push({ price: c.high, weight: 5.0, isHtfReject: true, htfLabel: '1D Pinbar Đỉnh' });
    }
    if (isLowerReject) {
      weightedLows.push({ price: c.low, weight: 5.0, isHtfReject: true, htfLabel: '1D Pinbar Đáy' });
    }
  }

  // Scan 4H Rejections (Weight 3.5 - Vùng Cản/Hỗ Trợ Khung 4H)
  for (const c of candles4h) {
    const { isUpperReject, isLowerReject } = analyzeCandleWick(c);
    if (isUpperReject) {
      weightedHighs.push({ price: c.high, weight: 3.5, isHtfReject: true, htfLabel: '4H Rút Râu Đỉnh' });
    }
    if (isLowerReject) {
      weightedLows.push({ price: c.low, weight: 3.5, isHtfReject: true, htfLabel: '4H Rút Chân Đáy' });
    }
  }

  // 2. Scan 1H Fractal Swings with Wick Rejection weighting
  for (let i = 2; i < subset.length - 2; i++) {
    const c = subset[i];
    const high = c.high;
    const low = c.low;

    if (
      high >= subset[i - 1].high &&
      high >= subset[i - 2].high &&
      high >= subset[i + 1].high &&
      high >= subset[i + 2].high
    ) {
      const { isUpperReject } = analyzeCandleWick(c);
      weightedHighs.push({
        price: high,
        weight: isUpperReject ? 2.5 : 1.0,
        isHtfReject: isUpperReject,
        htfLabel: isUpperReject ? '1H Rút Râu Đỉnh' : 'Đỉnh Kỹ Thuật'
      });
    }

    if (
      low <= subset[i - 1].low &&
      low <= subset[i - 2].low &&
      low <= subset[i + 1].low &&
      low <= subset[i + 2].low
    ) {
      const { isLowerReject } = analyzeCandleWick(c);
      weightedLows.push({
        price: low,
        weight: isLowerReject ? 2.5 : 1.0,
        isHtfReject: isLowerReject,
        htfLabel: isLowerReject ? '1H Rút Chân Đáy' : 'Đáy Kỹ Thuật'
      });
    }
  }

  // 3. Group nearby levels into weighted clusters (proximity within 0.8%)
  const clusterLevels = (items) => {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => a.price - b.price);
    const clusters = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = current[current.length - 1];
      if ((sorted[i].price - prev.price) / prev.price < 0.008) {
        current.push(sorted[i]);
      } else {
        const totalW = current.reduce((sum, item) => sum + item.weight, 0);
        const weightedAvg = current.reduce((sum, item) => sum + item.price * item.weight, 0) / totalW;
        const hasHtf = current.some(item => item.isHtfReject);
        const htfLabel = current.find(item => item.isHtfReject)?.htfLabel || '';

        clusters.push({
          price: roundLevel(weightedAvg),
          totalWeight: totalW,
          touches: current.length,
          hasHtfReject: hasHtf,
          htfLabel,
          min: Math.min(...current.map(k => k.price)),
          max: Math.max(...current.map(k => k.price))
        });
        current = [sorted[i]];
      }
    }
    if (current.length > 0) {
      const totalW = current.reduce((sum, item) => sum + item.weight, 0);
      const weightedAvg = current.reduce((sum, item) => sum + item.price * item.weight, 0) / totalW;
      const hasHtf = current.some(item => item.isHtfReject);
      const htfLabel = current.find(item => item.isHtfReject)?.htfLabel || '';

      clusters.push({
        price: roundLevel(weightedAvg),
        totalWeight: totalW,
        touches: current.length,
        hasHtfReject: hasHtf,
        htfLabel,
        min: Math.min(...current.map(k => k.price)),
        max: Math.max(...current.map(k => k.price))
      });
    }
    return clusters;
  };

  const supportClusters = clusterLevels(weightedLows).filter(c => c.price < currentPrice);
  const resistanceClusters = clusterLevels(weightedHighs).filter(c => c.price > currentPrice);

  // Sort supports: prioritize nearby clusters, with bonus for HTF 1D/4H wick rejections
  supportClusters.sort((a, b) => {
    const distA = Math.abs(currentPrice - a.price) / currentPrice;
    const distB = Math.abs(currentPrice - b.price) / currentPrice;
    // Score combines proximity (70%) and wick rejection weight (30%)
    const scoreA = (a.totalWeight * 0.02) - distA;
    const scoreB = (b.totalWeight * 0.02) - distB;
    return scoreB - scoreA;
  });

  // Sort resistances: prioritize nearby clusters, with bonus for HTF 1D/4H wick rejections
  resistanceClusters.sort((a, b) => {
    const distA = Math.abs(a.price - currentPrice) / currentPrice;
    const distB = Math.abs(b.price - currentPrice) / currentPrice;
    const scoreA = (a.totalWeight * 0.02) - distA;
    const scoreB = (b.totalWeight * 0.02) - distB;
    return scoreB - scoreA;
  });

  // S1: Primary Support (Prioritizing closest HTF wick rejection or highest weight)
  const s1Obj = supportClusters.length > 0 ? supportClusters[0] : null;
  const s1 = s1Obj ? s1Obj.price : roundLevel(currentPrice * 0.98);

  // S2: Major / Deeper Support
  const s2Obj = supportClusters.length > 1 ? supportClusters[1] : null;
  const s2 = s2Obj ? s2Obj.price : roundLevel(currentPrice * 0.955);

  // R1: Primary Resistance (Prioritizing closest HTF wick rejection or highest weight)
  const r1Obj = resistanceClusters.length > 0 ? resistanceClusters[0] : null;
  const r1 = r1Obj ? r1Obj.price : roundLevel(currentPrice * 1.02);

  // R2: Major / Higher Resistance
  const r2Obj = resistanceClusters.length > 1 ? resistanceClusters[1] : null;
  const r2 = r2Obj ? r2Obj.price : roundLevel(currentPrice * 1.045);

  const makeZone = (center) => {
    const low = roundLevel(center * 0.997);
    const high = roundLevel(center * 1.003);
    return `${formatPairPrice(low, symbol)} - ${formatPairPrice(high, symbol)}`;
  };

  return {
    support1: s1,
    support2: s2,
    resistance1: r1,
    resistance2: r2,
    supportZone1: makeZone(s1),
    supportZone2: makeZone(s2),
    resistanceZone1: makeZone(r1),
    resistanceZone2: makeZone(r2),
    allSupports: supportClusters.map(c => c.price),
    allResistances: resistanceClusters.map(c => c.price),
    r1Rejection: r1Obj?.htfLabel || null,
    s1Rejection: s1Obj?.htfLabel || null
  };
}

// Comprehensive Technical Analysis Snapshot
export function generateTechnicalSnapshot(candles, timeframe = '1h', symbol = 'BTCUSDT') {
  if (!candles || candles.length < 30) return null;

  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle.close;

  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, Math.min(200, Math.floor(candles.length * 0.9)));
  const rsiList = calculateRSI(candles, 14);
  const macdList = calculateMACD(candles);
  const bbList = calculateBollingerBands(candles, 20, 2);
  const sr = findSupportResistance(candles, 90, symbol);

  const lastEMA20 = ema20.length ? ema20[ema20.length - 1].value : currentPrice;
  const lastEMA50 = ema50.length ? ema50[ema50.length - 1].value : currentPrice;
  const lastEMA200 = ema200.length ? ema200[ema200.length - 1].value : currentPrice;
  const lastRSI = rsiList.length ? rsiList[rsiList.length - 1].value : 50;
  const lastMACD = macdList && macdList.length ? macdList[macdList.length - 1] : { macd: 0, signal: 0, histogram: 0 };
  const lastBB = bbList.length ? bbList[bbList.length - 1] : { upper: 0, middle: 0, lower: 0 };

  // Trend detection
  let trend = 'NEUTRAL / TÍCH LŨY';
  let trendScore = 0; // -3 to +3

  if (currentPrice > lastEMA20 && lastEMA20 > lastEMA50) {
    trend = 'STRONG BULLISH (TĂNG MẠNH)';
    trendScore = 3;
  } else if (currentPrice > lastEMA50) {
    trend = 'BULLISH (XU HƯỚNG TĂNG)';
    trendScore = 2;
  } else if (currentPrice < lastEMA20 && lastEMA20 < lastEMA50) {
    trend = 'STRONG BEARISH (GIẢM MẠNH)';
    trendScore = -3;
  } else if (currentPrice < lastEMA50) {
    trend = 'BEARISH (XU HƯỚNG GIẢM)';
    trendScore = -2;
  }

  // RSI status
  let rsiState = 'Trung tính (Neutral)';
  if (lastRSI >= 70) rsiState = 'Quá mua (Overbought)';
  else if (lastRSI <= 30) rsiState = 'Quá bán (Oversold)';
  else if (lastRSI > 55) rsiState = 'Đà tăng chiếm ưu thế';
  else if (lastRSI < 45) rsiState = 'Đà giảm chiếm ưu thế';

  const dayCandles = candles.slice(-24);
  const open24h = dayCandles[0].open;
  const priceChange24h = ((currentPrice - open24h) / open24h) * 100;

  const atrValues = calculateATR(candles, 14);
  const latestATR = atrValues.length ? atrValues[atrValues.length - 1].value : currentPrice * 0.02;
  const atrPct = parseFloat(((latestATR / currentPrice) * 100).toFixed(2));

  const regime = detectMarketRegime(candles, {
    currentPrice,
    trendScore,
    ema: { ema20: lastEMA20, ema50: lastEMA50, ema200: lastEMA200 },
    atrPct,
    bollingerBands: lastBB,
    rsi: { value: lastRSI }
  });

  return {
    timeframe,
    currentPrice,
    open: latestCandle.open,
    high: latestCandle.high,
    low: latestCandle.low,
    volume: latestCandle.volume,
    priceChange24h: parseFloat(priceChange24h.toFixed(2)),
    ema: {
      ema20: lastEMA20,
      ema50: lastEMA50,
      ema200: lastEMA200,
      alignment: lastEMA20 > lastEMA50 ? 'EMA20 > EMA50 (Tín hiệu Bullish)' : 'EMA20 < EMA50 (Tín hiệu Bearish)'
    },
    rsi: {
      value: lastRSI,
      state: rsiState
    },
    macd: {
      macd: lastMACD.macd,
      signal: lastMACD.signal,
      histogram: lastMACD.histogram,
      signalType: lastMACD.histogram > 0 ? 'Bullish Histogram (+)' : 'Bearish Histogram (-)'
    },
    bollingerBands: lastBB,
    supportResistance: sr,
    trend,
    trendScore,
    atr: latestATR,
    atrPct,
    regime
  };
}

// Average True Range (ATR)
export function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return [];
  const trList = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trList.push({ time: cur.time, tr });
  }

  const atrList = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trList[i].tr;
  }
  let prevATR = sum / period;
  atrList.push({ time: trList[period - 1].time, value: parseFloat(prevATR.toFixed(4)) });

  for (let i = period; i < trList.length; i++) {
    const currentATR = (prevATR * (period - 1) + trList[i].tr) / period;
    atrList.push({ time: trList[i].time, value: parseFloat(currentATR.toFixed(4)) });
    prevATR = currentATR;
  }

  return atrList;
}

// Market Regime Detection (Trend vs Range vs High Volatility Burst)
export function detectMarketRegime(candles, metrics) {
  const { currentPrice, trendScore, ema, atrPct, bollingerBands, rsi } = metrics;
  const emaSpread = Math.abs(ema.ema20 - ema.ema50) / currentPrice * 100;
  const bbWidth = bollingerBands.middle > 0 ? ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle) * 100 : 3;

  // 1. High Volatility Expansion / News Shock
  if (atrPct >= 3.8 || bbWidth >= 6.5) {
    return {
      type: 'VOLATILITY_EXPANSION',
      name: 'Co Giật Biến Động Mạnh (High Volatility)',
      badge: 'VOLATILE',
      color: '#f43f5e',
      description: 'Biên độ nến dãn rộng bất thường (ATR > 3.8%). Cần nới rộng Stop Loss tối đa và hạ đòn bẩy.',
      recommendedBufferMult: 1.6,
      maxLeverage: 8,
      allowTrading: true
    };
  }

  // 2. Strong Directional Trend
  if (Math.abs(trendScore) >= 2 && emaSpread >= 0.8) {
    const isBull = trendScore > 0;
    return {
      type: isBull ? 'STRONG_BULL_TREND' : 'STRONG_BEAR_TREND',
      name: isBull ? 'Xu Hướng Tăng Mạnh (Strong Bull Trend)' : 'Xu Hướng Giảm Mạnh (Strong Bear Trend)',
      badge: isBull ? 'BULL TREND' : 'BEAR TREND',
      color: isBull ? '#22c55e' : '#ff3366',
      description: `Động lượng nến dốc theo sóng lớn 4H (${isBull ? 'Thuận Long' : 'Thuận Short'}). Nghiêm cấm bắt đỉnh/đáy ngược xu hướng.`,
      recommendedBufferMult: 1.1,
      maxLeverage: 15,
      allowTrading: true
    };
  }

  // 3. Choppy Sideways / Accumulation Range
  return {
    type: 'CHOPPY_SIDEWAYS',
    name: 'Đi Ngang Quét Cản (Choppy Range)',
    badge: 'SIDEWAYS',
    color: '#06b6d4',
    description: 'Thị trường tích lũy giằng co giữa 2 biên cản. Cảnh giác bẫy quét râu Stop Loss (Liquidity Hunt).',
    recommendedBufferMult: 1.35,
    maxLeverage: 10,
    allowTrading: true
  };
}
