/**
 * AI Trading Analysis Service (HTF 1h/4h/1d Support-Resistance & News Confluence Engine)
 */

/**
 * Built-in Quantitative Trading Engine with HTF Support/Resistance & News Sentiment Confluence
 */
import { learningEngine } from './learningEngine.js';

/**
 * Built-in Quantitative Trading Engine with HTF Support/Resistance, News Confluence & Adaptive Self-Learning
 */
export function generateBuiltinSignal(snapshot, candles = [], newsContext = null, customParams = null, btcDominance = null, symbol = 'BTCUSDT') {
  const cleanSymbol = (symbol || 'BTCUSDT').replace('/', '').toUpperCase();
  const pairName = cleanSymbol.replace('USDT', '/USDT');
  const decimals = cleanSymbol === 'SUIUSDT' ? 4 : (snapshot?.currentPrice < 10 ? 4 : 2);

  const roundPrice = (p) => parseFloat(Number(p).toFixed(decimals));
  const formatPrice = (p) => {
    if (p === undefined || p === null || isNaN(p)) return 'N/A';
    return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  if (!snapshot) {
    return {
      symbol: cleanSymbol,
      pairName,
      action: 'WAIT',
      signalType: 'QUAN SÁT',
      confidence: 50,
      entryZone: 'Chưa đủ dữ liệu',
      stopLoss: 'N/A',
      takeProfit1: 'N/A',
      takeProfit2: 'N/A',
      riskRewardRatio: '1:1',
      summary: 'Đang đồng bộ dữ liệu đồ thị...'
    };
  }

  const learningState = learningEngine.getState();
  const adaptiveParams = customParams || learningState.adaptiveParams;

  const { currentPrice, ema, rsi, macd, supportResistance, trendScore, timeframe } = snapshot;
  const { support1, support2, resistance1, resistance2, supportZone1, supportZone2, resistanceZone1, resistanceZone2 } = supportResistance;

  let score = 0; // -10 (Strong Short) to +10 (Strong Long)
  const reasons = [];

  // 1. HTF Support & Resistance Reaction (PRIMARY FACTOR)
  const isAtSupport1 = currentPrice >= support1 * 0.994 && currentPrice <= support1 * 1.015;
  const isAtSupport2 = support2 && currentPrice < support1 && currentPrice >= support2 * 0.992;
  const isAtResistance1 = currentPrice <= resistance1 * 1.008 && currentPrice >= resistance1 * 0.985;
  const isAtResistance2 = resistance2 && currentPrice >= resistance2 * 0.985 && currentPrice <= resistance2 * 1.015;

  const r1RejectLabel = supportResistance.r1Rejection ? ` [${supportResistance.r1Rejection}]` : '';
  const s1RejectLabel = supportResistance.s1Rejection ? ` [${supportResistance.s1Rejection}]` : '';

  if (isAtSupport1) {
    score += 5.0;
    reasons.push(`🎯 **Vùng Hỗ Trợ Khung Lớn S1${s1RejectLabel} (${supportZone1})**: Giá phản ứng tại đáy hỗ trợ${s1RejectLabel ? ' (vùng rút chân nến 4H/1D gom hàng mạnh)' : ''}. Phe Mua hấp thụ lực bán, ưu tiên kịch bản LONG tại hỗ trợ.`);
  } else if (isAtSupport2) {
    score += 4.0;
    reasons.push(`🛡️ **Hỗ Trợ Cứng S2 (${supportZone2})**: Giá chiết khấu sâu về đáy chiến lược 4H/1D, biên an toàn cao cho vị thế LONG.`);
  } else if (isAtResistance1) {
    score -= 5.0;
    reasons.push(`⚠️ **Vùng Kháng Cự Khung Lớn R1${r1RejectLabel} (${resistanceZone1})**: Giá chạm trần cản bán mạnh${r1RejectLabel ? ' (vùng đỉnh rút râu nến 4H/1D xả hàng quyết liệt)' : ''}. Ưu tiên kịch bản SHORT tại cản.`);
  } else if (isAtResistance2) {
    score -= 6.0;
    reasons.push(`🛑 **Đỉnh Kháng Cự Cứng R2 (${resistanceZone2})**: Giá đối mặt với tường cản phân phối chính khung lớn. Rủi ro đảo chiều xả hàng cực cao, ưu tiên SHORT.`);
  } else {
    reasons.push(`⚖️ **Vùng Trung Gian**: Giá đang dao động giữa Hỗ trợ ${formatPrice(support1)} và Kháng cự ${formatPrice(resistance1)}. Kiên nhẫn chờ hồi về cản hoặc hỗ trợ.`);
  }

  // 2. Trend & EMA Structure
  if (currentPrice > ema.ema20 && ema.ema20 > ema.ema50) {
    score += 2.5;
    reasons.push(`📈 **Cấu trúc Xu Hướng**: Nến nằm trên cả EMA20 (${formatPrice(ema.ema20)}) và EMA50 (${formatPrice(ema.ema50)}) xác nhận phe Mua (Bulls) kiểm soát.`);
  } else if (currentPrice < ema.ema20 && ema.ema20 < ema.ema50) {
    score -= 2.5;
    reasons.push(`📉 **Cấu trúc Xu Hướng**: Nến nằm dưới EMA20 và EMA50, cấu trúc đỉnh đáy thấp dần (Bearish Structure).`);
  }

  // 3. Momentum (RSI & MACD) using dynamically adapted rsiOversoldLimit
  const rsiOversoldThreshold = adaptiveParams.rsiOversoldLimit || 32;
  const rsiOverboughtThreshold = 100 - rsiOversoldThreshold;

  if (rsi.value <= rsiOversoldThreshold) {
    score += 3;
    reasons.push(`🔥 **Động lượng Quá Bán (Ngưỡng tự học ≤${rsiOversoldThreshold})**: RSI(${rsi.value.toFixed(1)}) rơi vào vùng quá bán sâu trên khung ${timeframe.toUpperCase()}, xác suất bật tăng kỹ thuật rất cao.`);
  } else if (rsi.value >= rsiOverboughtThreshold) {
    score -= 3;
    reasons.push(`🛑 **Động lượng Quá Mua (≥${rsiOverboughtThreshold})**: RSI(${rsi.value.toFixed(1)}) chạm ngưỡng quá mua, cảnh báo suy kiệt lực mua.`);
  } else if (rsi.value > 50 && macd.histogram > 0) {
    score += 1.5;
    reasons.push(`Động lượng MACD dương mở rộng, hỗ trợ đà tăng tiếp diễn.`);
  } else if (rsi.value < 50 && macd.histogram < 0) {
    score -= 1.5;
    reasons.push(`MACD Histogram âm, áp lực phân phối vẫn đang tiếp diễn.`);
  }

  // 4. NEWS CONFLUENCE FACTOR with Adaptive Strictness
  const newsWeight = adaptiveParams.newsFilterStrictness || 2.0;
  let newsNote = '';
  if (newsContext) {
    const { sentiment, sentimentLabel, bullPercent, topNewsTitle } = newsContext;
    if (sentiment === 'bullish' || bullPercent >= 60) {
      score += newsWeight;
      newsNote = `🟢 **Yếu tố Tin Tức Tích Cực (Trọng số thích ứng x${newsWeight})**: Thị trường đón nhận thông tin lạc quan (${bullPercent}% tin tức tích cực). Củng cố kịch bản Long tại vùng hỗ trợ.`;
      reasons.push(newsNote);
    } else if (sentiment === 'bearish' || bullPercent <= 40) {
      score -= newsWeight;
      newsNote = `🔴 **Yếu tố Tin Tức Tiêu Cực (Bộ lọc phạt thích ứng -${newsWeight} điểm)**: Tâm lý thị trường tiêu cực. Tuyệt đối không bắt dao rơi.`;
      reasons.push(newsNote);
    } else {
      newsNote = `🟡 **Tâm Lý Tin Tức Trung Lập**: Không có sự kiện đột biến, đồ thị thuần túy vận động theo phân tích kỹ thuật và Price Action.`;
      reasons.push(newsNote);
    }
  }

  // 5. BITCOIN DOMINANCE (BTC.D) CONFLUENCE FACTOR
  if (btcDominance && btcDominance.matrix) {
    score += btcDominance.matrix.scoreBonus || 0;
    reasons.push(`🪙 **Tỷ Trọng Vốn Hóa Bitcoin (BTC.D ${btcDominance.displayPercent})**: ${btcDominance.matrix.headline} — ${btcDominance.matrix.signalImpact}.`);
  }

  // STRICT SUPPLY & DEMAND DISCIPLINE:
  // - Khi giá ở Vùng Cản (R1 / R2): Nghiêm cấm mở BUY/LONG (chống FOMO mua đỉnh). Ưu tiên SHORT nếu có tín hiệu đảo chiều.
  if ((isAtResistance1 || isAtResistance2) && score > 0) {
    score = -2.0;
    reasons.push(`⛔ **Chặn Mua Tại Cản**: Giá đang nằm ngay dưới Vùng Kháng Cự (${resistanceZone1}), nghiêm cấm mở lệnh BUY/LONG để phòng ngừa bẫy xả hàng.`);
  }
  // - Khi giá ở Vùng Hỗ Trợ (S1 / S2): Nghiêm cấm mở SELL/SHORT (chống bán tháo ở đáy). Ưu tiên LONG nếu có tín hiệu phục hồi.
  if ((isAtSupport1 || isAtSupport2) && score < 0) {
    score = 2.0;
    reasons.push(`⛔ **Chặn Bán Tại Hỗ Trợ**: Giá đang nằm ngay trên Vùng Hỗ Trợ (${supportZone1}), nghiêm cấm mở lệnh SELL/SHORT để tránh bán tháo trúng đáy.`);
  }

  // Determine Action & Trade Setup based on Adaptive Parameters
  let action = 'WAIT';
  let signalType = 'QUAN SÁT CHỜ VÙNG GIÁ TỐT';
  let badgeColor = '#f59e0b';
  let confidence = Math.min(95, Math.max(55, Math.round(50 + Math.abs(score) * 4)));
  let entryZone = '';
  let stopLoss = 0;
  let takeProfit1 = 0;
  let takeProfit2 = 0;

  const targetRr = Math.max(2.0, adaptiveParams.rrTargetRatio || 2.2);

  // Coin-specific Volatility Multiplier: Altcoins have higher ATR than BTC
  const coinMultipliers = {
    'BTCUSDT': 1.0,
    'ETHUSDT': 1.35,
    'SOLUSDT': 1.85,
    'SUIUSDT': 2.35
  };
  const coinMult = coinMultipliers[cleanSymbol] || 1.3;

  const coinProfile = customParams?._coinProfiles?.[cleanSymbol] || learningState?.coinProfiles?.[cleanSymbol];
  // 1. Incorporate the dynamic learned ATR cushion for this specific coin!
  const learnedAtrBuffer = coinProfile?.atrBufferPct || (adaptiveParams.supportBufferPct || 1.2) * coinMult;
  const bufferRatio = (learnedAtrBuffer / 100);

  // 2. Allow risk distance to expand dynamically if the agent learned that volatility is high
  const maxRiskScale = Math.max(1.0, (learnedAtrBuffer / 2.0));
  const minRiskPct = 0.012 * coinMult; // BTC: 1.2%, ETH: 1.6%, SOL: 2.2%, SUI: 2.8%
  const maxRiskPct = 0.026 * coinMult * maxRiskScale;
  const minRiskDist = currentPrice * minRiskPct;
  const maxRiskDist = currentPrice * maxRiskPct;

  if (score >= 4) {
    action = 'BUY';
    signalType = 'LONG / MUA TẠI HỖ TRỢ';
    badgeColor = '#00e676';
    entryZone = supportZone1;

    // Volatility-aware Stop Loss below S1 with adaptive cushion
    const rawSlDist = Math.max(minRiskDist, currentPrice - support1 * (1 - bufferRatio));
    const slDist = Math.min(maxRiskDist, rawSlDist);
    stopLoss = roundPrice(currentPrice - slDist);

    const risk = currentPrice - stopLoss;

    // Tự động neo Take Profit 1 sát dưới Vùng Cản R1 (Target chốt lời tự nhiên trước cản)
    const naturalTp1 = resistance1 ? roundPrice(resistance1 * 0.997) : 0;
    const standardTp1 = roundPrice(currentPrice + risk * targetRr);
    if (naturalTp1 > currentPrice && (naturalTp1 - currentPrice) >= risk * 1.4) {
      takeProfit1 = naturalTp1;
      takeProfit2 = resistance2 ? roundPrice(resistance2 * 0.995) : roundPrice(currentPrice + risk * (targetRr * 1.4));
    } else {
      takeProfit1 = standardTp1;
      takeProfit2 = roundPrice(currentPrice + risk * (targetRr * 1.4));
    }
  } else if (score <= -4) {
    action = 'SELL';
    signalType = 'SHORT / BÁN TẠI KHÁNG CỰ';
    badgeColor = '#ff3366';
    entryZone = resistanceZone1;

    // Volatility-aware Stop Loss above R1 with adaptive cushion
    const rawSlDist = Math.max(minRiskDist, resistance1 * (1 + bufferRatio) - currentPrice);
    const slDist = Math.min(maxRiskDist, rawSlDist);
    stopLoss = roundPrice(currentPrice + slDist);

    const risk = stopLoss - currentPrice;

    // Tự động neo Take Profit 1 sát trên Vùng Hỗ Trợ S1 (Target chốt lời tự nhiên trước hỗ trợ)
    const naturalTp1 = support1 ? roundPrice(support1 * 1.003) : 0;
    const standardTp1 = roundPrice(currentPrice - risk * targetRr);
    if (naturalTp1 < currentPrice && (currentPrice - naturalTp1) >= risk * 1.5) {
      takeProfit1 = naturalTp1;
      takeProfit2 = support2 ? roundPrice(support2 * 1.005) : roundPrice(currentPrice - risk * (targetRr * 1.4));
    } else {
      takeProfit1 = standardTp1;
      takeProfit2 = roundPrice(currentPrice - risk * (targetRr * 1.4));
    }
  } else {
    action = 'WAIT';
    signalType = 'QUAN SÁT (ĐỨNG NGOÀI)';
    badgeColor = '#f59e0b';
    entryZone = `Chờ giá test lại Vùng Hỗ Trợ (${supportZone1})`;
    const defaultRiskDist = currentPrice * (0.015 * coinMult);
    stopLoss = roundPrice(currentPrice - defaultRiskDist);
    takeProfit1 = roundPrice(currentPrice + defaultRiskDist * targetRr);
    takeProfit2 = roundPrice(currentPrice + defaultRiskDist * targetRr * 1.4);
  }

  const effectiveRisk = Math.abs(currentPrice - stopLoss);
  const effectiveReward = Math.abs(takeProfit1 - currentPrice);
  const rrRatio = effectiveRisk > 0 ? `1 : ${(effectiveReward / effectiveRisk).toFixed(1)}` : `1 : ${targetRr}`;

  const analysisReport = `### 📊 PHÂN TÍCH HỢP LƯU ĐA KHUNG (1H / 4H / 1D) & TIN TỨC ${pairName}

**Tín hiệu đề xuất**: **${signalType}** (Độ tin cậy: **${confidence}%**)
- 🎯 **Vùng Vào Lệnh (Entry Zone)**: **${entryZone}**
- 🛑 **Cắt Lỗ (Stop Loss)**: **${formatPrice(stopLoss)}** (Bảo toàn vốn tuyệt đối)
- 🚀 **Chốt Lời 1 (TP1)**: **${formatPrice(takeProfit1)}** (Chốt 50% vị thế, dời SL về Hòa vốn)
- 🏆 **Chốt Lời 2 (TP2)**: **${formatPrice(takeProfit2)}** (Theo sóng chính khung 4H/1D)
- ⚖️ **Tỷ lệ R:R (Risk/Reward)**: **${rrRatio}**

---
#### 📍 CÁC MỐC HỖ TRỢ & KHÁNG CỰ CỤ THỂ ĐÃ KẺ TRÊN BIỂU ĐỒ:
- 🟢 **Vùng Hỗ Trợ 1 (S1)**: **${supportZone1}** (Ngưỡng đỡ giá ngắn hạn)
- 🟢 **Vùng Hỗ Trợ Cứng 2 (S2)**: **${supportZone2}** (Đáy hỗ trợ vững chắc khung lớn)
- 🔴 **Vùng Kháng Cự 1 (R1)**: **${resistanceZone1}** (Cản phản ứng chốt lời)
- 🔴 **Vùng Kháng Cự Mạnh 2 (R2)**: **${resistanceZone2}** (Đỉnh phân phối quan trọng)

---
#### 🔍 CĂN CỨ KỸ THUẬT & TIN TỨC:
${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

💡 *Lời khuyên giao dịch:* Giao dịch theo khung lớn (1h/4h/1d) loại bỏ hoàn toàn nhiễu sóng nến ngắn hạn. Chỉ mở vị thế khi giá hồi về đúng Vùng Hỗ Trợ và xuất hiện phản ứng nến xác nhận!`;

  return {
    symbol: cleanSymbol,
    pairName,
    action,
    signalType,
    badgeColor,
    confidence,
    entryZone,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio: rrRatio,
    reasons,
    support1,
    support2,
    resistance1,
    resistance2,
    supportZone1,
    supportZone2,
    resistanceZone1,
    resistanceZone2,
    generation: learningState.generation,
    adaptiveParams,
    report: analysisReport
  };
}

/**
 * Dynamic, context-aware Built-in Quant Engine that answers specific user questions
 */
export function generateBuiltinAnswer(userPrompt, snapshot, candles, newsContext, btcDominance, customParams, selectedSymbol) {
  const signal = generateBuiltinSignal(snapshot, candles, newsContext, customParams, btcDominance, selectedSymbol);
  if (!snapshot) return signal.report;

  const q = (userPrompt || '').toLowerCase();
  const pairName = (selectedSymbol || 'BTCUSDT').replace('USDT', '/USDT');
  const price = snapshot.currentPrice;
  const fmt = (p) => (p !== undefined && p !== null && !isNaN(p)) ? '$' + Number(p).toLocaleString('en-US') : 'N/A';

  const ema = snapshot.ema || {};
  const rsi = snapshot.rsi || {};
  const macd = snapshot.macd || {};
  const sr = snapshot.supportResistance || {};

  // 1. EMA & HTF 1H / 4H / 1D Trend Consensus
  if (q.includes('ema') || q.includes('đa khung') || q.includes('đồng thuận') || q.includes('xu hướng') || (q.includes('1h') && q.includes('4h'))) {
    const isAboveEma20 = price > (ema.ema20 || 0);
    const isAboveEma50 = price > (ema.ema50 || 0);
    const isAboveEma200 = price > (ema.ema200 || 0);
    const isBullStack = (ema.ema20 || 0) > (ema.ema50 || 0) && (ema.ema50 || 0) > (ema.ema200 || 0);
    const isBearStack = (ema.ema20 || 0) < (ema.ema50 || 0) && (ema.ema50 || 0) < (ema.ema200 || 0);

    let trendLabel = 'TÍCH LŨY / ĐI NGANG (SIDEWAY)';
    let trendDesc = 'Các đường EMA đang xoắn lại, giá dao động trong biên độ hẹp.';
    if (isBullStack && isAboveEma20) {
      trendLabel = 'TĂNG MẠNH MẼ (BULLISH CONTINUATION)';
      trendDesc = `Giá ${fmt(price)} nằm trên toàn bộ dải EMA20 > EMA50 > EMA200. Phe Mua (Bulls) đang kiểm soát hoàn toàn thế trận.`;
    } else if (isBearStack && !isAboveEma20) {
      trendLabel = 'GIẢM RÕ RỆT (BEARISH CONTINUATION)';
      trendDesc = `Giá ${fmt(price)} nằm dưới EMA20 < EMA50 < EMA200. Cấu trúc đỉnh đáy thấp dần, áp lực bán chi phối.`;
    } else if (isAboveEma200) {
      trendLabel = 'TĂNG TRUNG HẠN (PULLBACK RETEST)';
      trendDesc = `Giá vẫn giữ vững trên đường xu hướng lớn EMA200 (${fmt(ema.ema200)}), nhịp điều chỉnh hiện tại chỉ là sóng hồi lành mạnh.`;
    }

    return `### 📈 PHÂN TÍCH ĐA KHUNG (1H / 4H / 1D) & ĐƯỜNG EMA CHO ${pairName}

**1. Trạng thái các đường EMA hiện tại:**
- 🔹 **EMA 20 ngắn hạn**: **${fmt(ema.ema20)}** ${isAboveEma20 ? '(Giá nằm TRÊN 🟢 - Lực đẩy tốt)' : '(Giá nằm DƯỚI 🔴 - Kháng cự động)'}
- 🔸 **EMA 50 trung hạn**: **${fmt(ema.ema50)}** ${isAboveEma50 ? '(Giá nằm TRÊN 🟢)' : '(Giá nằm DƯỚI 🔴)'}
- 🟣 **EMA 200 dài hạn**: **${fmt(ema.ema200)}** ${isAboveEma200 ? '(Xu hướng lớn 4H/1D là TĂNG 🟢)' : '(Xu hướng lớn 4H/1D là GIẢM 🔴)'}

**2. Đánh giá sự đồng thuận giữa khung 1H và xu hướng lớn 4H/1D:**
- **Nhận định chung:** **${trendLabel}**
- ${trendDesc}
- **Chỉ báo động lượng RSI (14):** **${rsi.value?.toFixed(1) || 'N/A'}** (${rsi.state || 'Bình thường'}) - ${rsi.value < 35 ? 'Đã chiết khấu về vùng quá bán, rủi ro bán đuổi rất cao.' : rsi.value > 65 ? 'Đang tiệm cận vùng quá mua, hạn chế FOMO giá cao.' : 'Động lượng cân bằng, phù hợp giao dịch theo biên độ cản.'}
- **MACD Histogram:** **${macd.histogram?.toFixed(2) || '0'}** (${macd.signalType || 'Trung lập'}).

💡 **Chiến lược hành động:** ${isBullStack ? `Ưu tiên mở lệnh **LONG** khi nến 1H kiểm tra lại vùng hỗ trợ **${sr.supportZone1 || fmt(sr.support1)}** hoặc nảy lên từ EMA50.` : `Kiên nhẫn quan sát, chỉ giao dịch khi xuất hiện nến từ chối giá (Pinbar/Engulfing) rõ ràng tại các vùng cản quan trọng!`}`;
  }

  // 2. Bitcoin Dominance (BTC.D) & Smart Money Flow
  if (q.includes('dominance') || q.includes('btc.d') || q.includes('dòng tiền') || q.includes('altseason') || q.includes('tháo chạy')) {
    const btcD = btcDominance || {};
    const matrix = btcD.matrix || {};

    return `### 🪙 PHÂN TÍCH DÒNG TIỀN & BITCOIN DOMINANCE (BTC.D)

- 📊 **Tỷ trọng vốn hóa Bitcoin (BTC.D):** **${btcD.displayPercent || '54.5%'}** (24h: **${btcD.change24h > 0 ? '+' : ''}${btcD.change24h || 0}%**)
- 🌊 **Xu hướng dòng vốn:** **${btcD.trend || 'Ổn định'}**
- 🎯 **Ma trận kịch bản:** **${matrix.headline || 'Dòng vốn luân chuyển bình thường'}** (${matrix.signalImpact || 'Trung lập'})

**Nhận định chi tiết về dòng tiền:**
- ${matrix.description || 'Thị trường đang ở giai đoạn cân bằng giữa dòng tiền tập trung vào Bitcoin và các Altcoin vốn hóa lớn.'}
- **Tác động tới Altcoin (ETH, SOL, SUI):** ${btcD.trend === 'TĂNG MẠNH' ? 'BTC.D tăng hút vốn khiến Altcoin dễ bị đè giá hoặc tăng chậm hơn BTC. Nên ưu tiên lệnh BTC.' : 'BTC.D hạ nhiệt tạo dư địa cho Altcoin bứt phá tăng trưởng mạnh.'}
- **Khuyến nghị phân bổ:** Không all-in vào 1 đồng coin duy nhất, duy trì đòn bẩy an toàn từ 10x-15x theo cấu trúc rủi ro của hệ thống.`;
  }

  // 3. Support & Resistance Zones
  if (q.includes('hỗ trợ') || q.includes('kháng cự') || q.includes('s1') || q.includes('r1') || q.includes('cản') || q.includes('s2') || q.includes('r2')) {
    const distS1 = price && sr.support1 ? (((price - sr.support1) / price) * 100).toFixed(2) : '0';
    const distR1 = price && sr.resistance1 ? (((sr.resistance1 - price) / price) * 100).toFixed(2) : '0';

    return `### 🛡️ CÁC MỐC HỖ TRỢ & KHÁNG CỰ QUAN TRỌNG (${pairName})

- 🟢 **Vùng Hỗ Trợ 1 (S1):** **${sr.supportZone1 || fmt(sr.support1)}** (Cách giá hiện tại **${distS1}%**)
  ➜ *Đây là mốc đỡ giá gần nhất của khung 1H. Nếu giá giữ vững trên mốc này, cấu trúc tăng ngắn hạn được bảo toàn.*
- 🟢 **Vùng Hỗ Trợ Cứng 2 (S2):** **${sr.supportZone2 || fmt(sr.support2)}**
  ➜ *Vùng cầu chiến lược của khung 4H/1D. Nơi phe cá mập gom hàng, là ngưỡng phòng thủ tối thượng.*
- 🔴 **Vùng Kháng Cự 1 (R1):** **${sr.resistanceZone1 || fmt(sr.resistance1)}** (Cách giá hiện tại **${distR1}%**)
  ➜ *Cản chốt lời ngắn hạn. Khi giá chạm vùng này thường có phản ứng rút râu hoặc rung lắc.*
- 🔴 **Vùng Kháng Cự Mạnh 2 (R2):** **${sr.resistanceZone2 || fmt(sr.resistance2)}**
  ➜ *Đỉnh phân phối quan trọng. Vượt qua mốc này sẽ kích hoạt sóng bùng nổ mạnh mẽ.*

🎯 **Mốc quan trọng nhất lúc này:** Vùng **${sr.supportZone1 || fmt(sr.support1)}** là điểm cốt lõi để canh nhịp hồi (Pullback) mở lệnh MUA với tỷ lệ R:R tối ưu nhất!`;
  }

  // 4. News & Macro / FOMC / CPI
  if (q.includes('tin tức') || q.includes('fomc') || q.includes('cpi') || q.includes('vĩ mô') || q.includes('lịch') || q.includes('sentiment')) {
    const news = newsContext || {};
    return `### 📰 ĐÁNH GIÁ TIN TỨC THỊ TRƯỜNG & TÂM LÝ VĨ MÔ

- 🌡️ **Chỉ số tâm lý tin tức:** **${news.sentimentLabel || 'TRUNG LẬP'}** (**${news.bullPercent || 50}% Bullish**)
- 📢 **Tin tức thị trường nóng nhất:** "${news.topNewsTitle || 'Không có sự kiện bất thường gây sốc giá'}"
- ⚠️ **Lịch vĩ mô & Rủi ro biến động:**
  - Tin tức CPI và biên bản cuộc họp Fed/FOMC luôn tiềm ẩn nguy cơ "quét thanh khoản hai đầu" (Liquidity Hunt) bằng các râu nến dài quét Stop Loss.
  - Bộ não AI KT1 đã tích hợp **bộ lọc tin tức vĩ mô (News Sentiment Strictness)** để tự động nâng khoảng cách SL khi có tin tức lớn.

💡 **Lời khuyên an toàn:** Trước thời điểm công bố tin tức nhạy cảm 15-30 phút, nên dời Stop Loss về vùng an toàn hoặc hạn chế nhồi thêm vị thế mới.`;
  }

  // 5. Trailing Stop & Risk Management
  if (q.includes('trailing') || q.includes('hòa vốn') || q.includes('dời sl') || q.includes('quản lý vốn') || q.includes('r:r')) {
    return `### 🎯 KẾ HOẠCH DỜI STOP LOSS & TRAILING STOP TỐI ĐA HÓA LỢI NHUẬN

Hệ thống Bot KT1 vận hành cơ chế quản lý lệnh chuyên nghiệp gồm 3 giai đoạn:
1. 🛡️ **Giai đoạn 1: Kích hoạt Hòa Vốn (Break-even):**
   - Khi vị thế đạt mức lợi nhuận **+1.5R** hoặc giá tiến được **50% quãng đường tới TP1**, Bot sẽ tự động dời Stop Loss lên bằng đúng giá mở lệnh (Entry Price).
   - *Kết quả:* Lệnh trở thành "Free-risk Trade" - loại bỏ hoàn toàn khả năng thua lỗ.
2. 🚀 **Giai đoạn 2: Chốt lời từng phần (Scale-out):**
   - Chốt **50% khối lượng** tại mục tiêu **TP1** để hiện thực hóa lợi nhuận bỏ vào túi.
3. 🏆 **Giai đoạn 3: Trailing Stop theo xu hướng lớn:**
   - 50% khối lượng còn lại thả trôi theo sóng chính khung 4H/1D. Stop Loss được dời tự động bám theo đường **EMA20** hoặc đáy cao dần (Higher Low).
   - Chỉ thoát toàn bộ vị thế khi xuất hiện nến đảo chiều đóng cửa gãy mốc EMA20!`;
  }

  // Default: Return complete structured trade plan
  return signal.report;
}

/**
 * Format system prompt context with live chart data, HTF S/R zones and News sentiment
 */
function createSystemPrompt(snapshot, candles, newsContext = null, btcDominance = null, symbol = 'BTCUSDT') {
  const recentCandlesText = candles.slice(-8).map(c => 
    `Time: ${new Date(c.time * 1000).toLocaleTimeString()} | O: ${c.open} | H: ${c.high} | L: ${c.low} | C: ${c.close} | Vol: ${c.volume.toFixed(1)}`
  ).join('\n');

  const sr = snapshot?.supportResistance || {};
  const cleanSymbol = (symbol || 'BTCUSDT').replace('/', '').toUpperCase();
  const pairName = cleanSymbol.replace('USDT', '/USDT');

  return `Bạn là một Chuyên gia Phân tích Kỹ thuật Cấp cao & Trader Khung Lớn (HTF Swing Trader & Price Action Master) chuyên phân tích đồ thị cặp ${pairName} trên các khung thời gian 1H, 4H, 1D.
Chiến lược giao dịch của bạn KHÔNG dựa vào nhiễu sóng nến ngắn hạn (1m/5m), mà tập trung vào:
1. Xác định chính xác các **VÙNG HỖ TRỢ (Support Zones)** và **VÙNG KHÁNG CỰ (Resistance Zones)** cụ thể của khung lớn 1H, 4H, 1D cho ${pairName}.
2. Kiên nhẫn chờ giá hồi (Pullback) về vùng Hỗ trợ để mở lệnh MUA (LONG), hoặc chạm Kháng cự để BÁN (SHORT/CHỐT LỜI).
3. Kết hợp chặt chẽ **YẾU TỐ TIN TỨC VĨ MÔ & TÂM LÝ THỊ TRƯỜNG** tại thời điểm hiện tại để lọc tín hiệu giả.
4. ĐỐI CHIẾU **TỶ TRỌNG VỐN HÓA BITCOIN (BTC DOMINANCE - BTC.D)** để nắm bắt dòng tiền thông minh (Smart Money Flow) đang hút vào Bitcoin hay lan tỏa sang Altcoin (${cleanSymbol}).

DỮ LIỆU THỊ TRƯỜNG THỜI GIAN THỰC HIỆN TẠI:
- Cặp giao dịch: ${pairName}
- Khung thời gian đồ thị: ${snapshot?.timeframe?.toUpperCase() || '1H'}
- Giá ${pairName} hiện tại: $${snapshot?.currentPrice?.toLocaleString() || 'N/A'}
- Biến động 24h: ${snapshot?.priceChange24h || 0}%
- VÙNG HỖ TRỢ 1 (S1): ${sr.supportZone1 || 'N/A'} (Mốc: $${sr.support1?.toLocaleString()})
- VÙNG HỖ TRỢ CỨNG 2 (S2): ${sr.supportZone2 || 'N/A'} (Mốc: $${sr.support2?.toLocaleString()})
- VÙNG KHÁNG CỰ 1 (R1): ${sr.resistanceZone1 || 'N/A'} (Mốc: $${sr.resistance1?.toLocaleString()})
- VÙNG KHÁNG CỰ MẠNH 2 (R2): ${sr.resistanceZone2 || 'N/A'} (Mốc: $${sr.resistance2?.toLocaleString()})
- RSI (14): ${snapshot?.rsi?.value?.toFixed(1) || 'N/A'} (${snapshot?.rsi?.state || 'N/A'})
- EMA 20: $${snapshot?.ema?.ema20?.toLocaleString()} | EMA 50: $${snapshot?.ema?.ema50?.toLocaleString()} | EMA 200: $${snapshot?.ema?.ema200?.toLocaleString()}
- MACD Histogram: ${snapshot?.macd?.histogram || 0} (${snapshot?.macd?.signalType || 'N/A'})

THÔNG TIN BITCOIN DOMINANCE (BTC.D) & DÒNG VỐN:
${btcDominance ? `- Chỉ số BTC.D: ${btcDominance.displayPercent} (24h: ${btcDominance.change24h > 0 ? '+' : ''}${btcDominance.change24h}%) | Xu hướng: ${btcDominance.trend}
- Đánh giá dòng tiền: ${btcDominance.matrix?.headline || 'Bình thường'} (${btcDominance.matrix?.signalImpact || 'Trung lập'})` : '- Chỉ số BTC.D: Ổn định'}

THÔNG TIN TÂM LÝ TIN TỨC THỊ TRƯỜNG HIỆN TẠI:
${newsContext ? `- Tâm lý tin tức: ${newsContext.sentimentLabel} (${newsContext.bullPercent}% Bullish)
- Tin tức nóng nhất: "${newsContext.topNewsTitle || 'Không có sự kiện bất thường'}"` : '- Tâm lý tin tức: Trung lập'}

8 CÂY NẾN GẦN NHẤT:
${recentCandlesText}

QUY TẮC PHẢN HỒI:
1. TRẢ LỜI ĐÚNG TRỌNG TÂM CÂU HỎI MỚI NHẤT CỦA USER. Nếu user hỏi về EMA, hãy tập trung vào EMA. Nếu hỏi về BTC.D, hãy tập trung vào dòng tiền. Nếu hỏi về điểm vào lệnh, hãy cung cấp Entry/SL/TP đầy đủ.
2. Trả lời chuyên nghiệp bằng tiếng Việt, dùng Markdown chuẩn, đẹp mắt.`;
}

/**
 * Call Google Gemini API
 */
export async function callGemini(apiKey, modelName, messages, snapshot, candles, newsContext, btcDominance = null, symbol = 'BTCUSDT') {
  let targetModel = modelName || 'gemini-3.8-flash';
  if (targetModel.includes('1.5') || targetModel.includes('2.5') || targetModel.includes('1.0')) {
    targetModel = 'gemini-3.8-flash';
  }

  const candidateModels = [
    targetModel,
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];
  // Deduplicate
  const uniqueModels = [...new Set(candidateModels)];

  const systemInstruction = createSystemPrompt(snapshot, candles, newsContext, btcDominance, symbol);

  // Gemini API requires the conversation to start with 'user' role and strictly alternate
  const firstUserIdx = messages.findIndex(m => m.role === 'user');
  const validMessages = firstUserIdx >= 0 ? messages.slice(firstUserIdx) : [{ role: 'user', content: 'Phân tích kỹ thuật thị trường hiện tại' }];

  const contents = [];
  for (const msg of validMessages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n\n${msg.content}`;
    } else {
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }
  }

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1500
    }
  };

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const candidate = result.candidates?.[0];
        const replyText = candidate?.content?.parts?.[0]?.text;
        if (replyText) {
          return replyText;
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        lastError = new Error(errData.error?.message || `Gemini API error ${response.status} on model ${model}`);
        // If 400, 404, 500, 502, 503, 429 try next candidate model
        if ([400, 404, 429, 500, 502, 503].includes(response.status)) continue;
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Không nhận được phản hồi từ Gemini API');
}

/**
 * Call OpenAI API
 */
export async function callOpenAI(apiKey, modelName, messages, snapshot, candles, newsContext, btcDominance = null, symbol = 'BTCUSDT') {
  const model = modelName || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const systemInstruction = createSystemPrompt(snapshot, candles, newsContext, btcDominance, symbol);

  const formattedMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature: 0.3,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'Không có phản hồi từ OpenAI';
}

/**
 * Main dispatch function for AI Analysis with intelligent question-specific responses
 */
export async function askAIAdvisor({ userPrompt, chatHistory, snapshot, candles, config, newsContext, btcDominance, selectedSymbol }) {
  const messages = [...chatHistory, { role: 'user', content: userPrompt }];

  if (config.provider === 'gemini' && config.geminiKey) {
    try {
      return await callGemini(config.geminiKey, config.geminiModel, messages, snapshot, candles, newsContext, btcDominance, selectedSymbol);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to Quant Engine:', err.message);
      return generateBuiltinAnswer(userPrompt, snapshot, candles, newsContext, btcDominance, null, selectedSymbol);
    }
  } else if (config.provider === 'openai' && config.openaiKey) {
    try {
      return await callOpenAI(config.openaiKey, config.openaiModel, messages, snapshot, candles, newsContext, btcDominance, selectedSymbol);
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to Quant Engine:', err.message);
      return generateBuiltinAnswer(userPrompt, snapshot, candles, newsContext, btcDominance, null, selectedSymbol);
    }
  } else {
    return generateBuiltinAnswer(userPrompt, snapshot, candles, newsContext, btcDominance, null, selectedSymbol);
  }
}
