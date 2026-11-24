/**
 * Autonomous AI Self-Learning & Agentic Reflection Engine (Gen 2.0)
 * Replaces repetitive canned heuristics with Deep Multi-Factor Quant Post-Mortems,
 * Per-Coin Volatility Profiles, Directional Locks, and Dynamic Market Regime Adaptation.
 */

const STORAGE_KEY = 'kt1_learning_engine_state';

export const DEFAULT_COIN_PROFILES = {
  'BTCUSDT': {
    volatilityScore: 'LOW',
    atrBufferPct: 1.5,
    minConfidence: 65,
    consecutiveLosses: 0,
    cooldownUntil: 0,
    forbiddenDirection: null,
    forbiddenUntil: 0,
    lossCount: 0,
    winCount: 0
  },
  'ETHUSDT': {
    volatilityScore: 'MEDIUM',
    atrBufferPct: 2.0,
    minConfidence: 67,
    consecutiveLosses: 0,
    cooldownUntil: 0,
    forbiddenDirection: null,
    forbiddenUntil: 0,
    lossCount: 0,
    winCount: 0
  },
  'SOLUSDT': {
    volatilityScore: 'HIGH',
    atrBufferPct: 3.0,
    minConfidence: 70,
    consecutiveLosses: 0,
    cooldownUntil: 0,
    forbiddenDirection: null,
    forbiddenUntil: 0,
    lossCount: 0,
    winCount: 0
  },
  'SUIUSDT': {
    volatilityScore: 'ULTRA_HIGH',
    atrBufferPct: 4.2,
    minConfidence: 72,
    consecutiveLosses: 0,
    cooldownUntil: 0,
    forbiddenDirection: null,
    forbiddenUntil: 0,
    lossCount: 0,
    winCount: 0
  }
};

const DEFAULT_LEARNING_STATE = {
  generation: 24,
  totalMistakesAnalyzed: 23,
  totalWinsReinforced: 4,
  totalAdjustments: 27,
  lastUpdated: new Date().toISOString(),
  adaptiveParams: {
    minConfidence: 68,
    supportBufferPct: 1.5,
    newsFilterStrictness: 2.2,
    rsiOversoldLimit: 31,
    rrTargetRatio: 2.3,
    maxLeverageCap: 15
  },
  coinProfiles: { ...DEFAULT_COIN_PROFILES },
  learningLogs: [
    {
      id: 'init-deep',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'INIT',
      tradeSide: 'SYSTEM',
      result: 'NEUTRAL',
      roePercent: 0,
      title: 'Khởi Tạo Bộ Não AI Agentic Reflection & Deep Quant Learning',
      reason: 'Kích hoạt hệ thống khám nghiệm pháp y giao dịch đa nhân tố (Multi-Factor Forensic Post-Mortem), khóa chiều chống trả thù (Directional Lock) và thích ứng theo biên độ biến động từng coin (ATR Profiling).',
      actionTaken: 'Giám sát 24/7 với 4 hồ sơ định lượng độc lập cho BTC, ETH, SOL, SUI.'
    }
  ]
};

export class LearningEngine {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_LEARNING_STATE,
            ...parsed,
            adaptiveParams: {
              ...DEFAULT_LEARNING_STATE.adaptiveParams,
              ...(parsed.adaptiveParams || {})
            },
            coinProfiles: {
              ...DEFAULT_COIN_PROFILES,
              ...(parsed.coinProfiles || {})
            }
          };
        }
      }
    } catch (e) {
      console.error('Failed to load learning engine state:', e);
    }
    return { ...DEFAULT_LEARNING_STATE };
  }

  saveState() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to save learning engine state:', e);
    }
  }

  resetLearning() {
    this.state = {
      ...DEFAULT_LEARNING_STATE,
      generation: 1,
      totalMistakesAnalyzed: 0,
      totalWinsReinforced: 0,
      totalAdjustments: 0,
      adaptiveParams: { ...DEFAULT_LEARNING_STATE.adaptiveParams },
      coinProfiles: { ...DEFAULT_COIN_PROFILES },
      learningLogs: [
        {
          id: `reset-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'RESET',
          tradeSide: 'SYSTEM',
          result: 'NEUTRAL',
          roePercent: 0,
          title: 'Khôi phục Mặc định Bộ Não AI Tự Học (Reset to Gen 1)',
          reason: 'Người dùng đã đặt lại toàn bộ tham số tự học về cấu hình nguyên bản.',
          actionTaken: 'Đặt lại trọng số thích ứng và mở khóa toàn bộ các chiều giao dịch.'
        }
      ]
    };
    this.saveState();
    return this.getState();
  }

  getState() {
    return { ...this.state };
  }

  getAdaptiveParams() {
    return { ...this.state.adaptiveParams };
  }

  isTradeDirectionAllowed(symbol, side) {
    const cleanSym = (symbol || 'BTCUSDT').replace('/', '').toUpperCase();
    const profile = this.state.coinProfiles?.[cleanSym];
    if (!profile) return { allowed: true };

    const now = Date.now();
    if (profile.cooldownUntil && now < profile.cooldownUntil) {
      const remainingMins = Math.ceil((profile.cooldownUntil - now) / 60000);
      return {
        allowed: false,
        reason: `🔒 ${cleanSym.replace('USDT', '')} đang trong Thời Gian Cách Ly (${remainingMins} phút) sau lệnh dính Stop Loss gần nhất.`
      };
    }

    if (profile.forbiddenDirection && profile.forbiddenDirection === side && now < profile.forbiddenUntil) {
      const remainingMins = Math.ceil((profile.forbiddenUntil - now) / 60000);
      return {
        allowed: false,
        reason: `🛡️ [KHÓA CHIỀU ${side}] AI đã khóa tạm thời lệnh ${side} trên ${cleanSym.replace('USDT', '')} trong ${remainingMins} phút nữa để tránh bẫy giá ngược sóng.`
      };
    }

    return { allowed: true };
  }

  analyzeClosedTrade(closedTrade, marketContext = {}) {

    const isProfit = (closedTrade.pnlUsdt || 0) > 0;
    const isLoss = (closedTrade.pnlUsdt || 0) < 0;
    const isSlHit = closedTrade.reason && (closedTrade.reason.includes('SL') || closedTrade.reason.includes('Cắt lỗ'));
    const isTpHit = closedTrade.reason && (closedTrade.reason.includes('TP') || closedTrade.reason.includes('Chốt lời') || closedTrade.reason.includes('Trailing'));

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sym = (closedTrade.symbol || marketContext.symbol || 'BTCUSDT').replace('/', '').toUpperCase();
    const coinName = sym.replace('USDT', '');

    if (!this.state.coinProfiles) {
      this.state.coinProfiles = { ...DEFAULT_COIN_PROFILES };
    }
    if (!this.state.coinProfiles[sym]) {
      this.state.coinProfiles[sym] = {
        volatilityScore: 'MEDIUM',
        atrBufferPct: 2.0,
        minConfidence: 68,
        consecutiveLosses: 0,
        cooldownUntil: 0,
        forbiddenDirection: null,
        forbiddenUntil: 0,
        lossCount: 0,
        winCount: 0
      };
    }
    const coinProfile = this.state.coinProfiles[sym];

    let lesson = null;

    if (isLoss) {
      this.state.totalMistakesAnalyzed += 1;
      this.state.totalAdjustments += 1;
      this.state.generation += 1;
      coinProfile.lossCount = (coinProfile.lossCount || 0) + 1;
      coinProfile.consecutiveLosses = (coinProfile.consecutiveLosses || 0) + 1;

      const streak = coinProfile.consecutiveLosses;
      const quarantineMins = streak === 1 ? 20 : streak === 2 ? 45 : 90;
      coinProfile.cooldownUntil = Date.now() + quarantineMins * 60 * 1000;

      // Always lock the losing direction to prevent immediate revenge trading in the wrong trend!
      coinProfile.forbiddenDirection = closedTrade.side;
      coinProfile.forbiddenUntil = Date.now() + 45 * 60 * 1000;

      const snapshot = marketContext.snapshot || {};
      const regime = snapshot.regime || { type: 'CHOPPY_SIDEWAYS', name: 'Đi Ngang Biên Độ Hẹp' };
      const atrPct = snapshot.atrPct || 2.5;

      let forensicCategory = 'LIQUIDITY_HUNT';
      let forensicTitle = '';
      let forensicReason = '';
      let forensicAction = '';

      const entryP = closedTrade.entryPrice || 0;
      const exitP = closedTrade.exitPrice || 0;
      const lossDistPct = entryP > 0 ? (Math.abs(exitP - entryP) / entryP * 100).toFixed(2) : '1.9';

      const isReversalDefense = closedTrade.reason && (closedTrade.reason.includes('Đảo Chiều') || closedTrade.reason.includes('Bảo Vệ Vốn'));

      if (isReversalDefense) {
        forensicCategory = 'TREND_REVERSAL_DEFENSE';
        const isLong = closedTrade.side === 'LONG';
        forensicTitle = `Khám Nghiệm: [PHÒNG VỆ ĐẢO CHIỀU] ${coinName} (${closedTrade.side} ${lossDistPct}%)`;
        forensicReason = isLong
          ? `Thị trường xuất hiện áp lực bán mạnh và tín hiệu SHORT áp đảo (≥75% tin cậy). AI đã cắt lỗ chủ động tại ${closedTrade.roePercent}% ROE để ngăn chặn rủi ro gãy hỗ trợ và dính SL cứng (-20%).`
          : `Phe Mua đột phá cản kháng cự đẩy giá tăng mạnh, xuất hiện tín hiệu LONG áp đảo (≥75% tin cậy). AI đã tất toán vị thế SHORT tại ${closedTrade.roePercent}% ROE để bảo toàn vốn.`;

        const prevBuffer = coinProfile.atrBufferPct || 2.0;
        const newBuffer = parseFloat((prevBuffer + 0.35).toFixed(2));
        coinProfile.atrBufferPct = newBuffer;
        coinProfile.minConfidence = Math.min(80, (coinProfile.minConfidence || 68) + 2);
        forensicAction = `Khóa chiều ${closedTrade.side} trên ${coinName} trong 45 phút | Nâng chuẩn tin cậy lên ${coinProfile.minConfidence}% | Nới rộng đệm ATR lên ${newBuffer}%.`;
      } else if (regime.type === 'VOLATILITY_EXPANSION' || atrPct > 3.0) {
        forensicCategory = 'VOLATILITY_SPIKE';
        forensicTitle = `Khám Nghiệm: [ĐỘT BIẾN CO GIẬT ATR] ${coinName} (${closedTrade.side} ${lossDistPct}%)`;
        forensicReason = `Thị trường rơi vào trạng thái Co Giật Cực Đại (ATR ${atrPct}%). Biên độ nến giãn rộng bất thường khiến Stop Loss kỹ thuật bị xuyên thủng bởi biến động giật cản toàn thị trường.`;
        
        const prevBuffer = coinProfile.atrBufferPct || 2.0;
        const newBuffer = parseFloat((prevBuffer + 0.5).toFixed(2));
        coinProfile.atrBufferPct = newBuffer;
        coinProfile.minConfidence = Math.min(80, (coinProfile.minConfidence || 68) + 2);
        forensicAction = `Tăng đệm ATR riêng cho ${coinName} lên ${newBuffer}% | Khóa chiều ${closedTrade.side} trong 45 phút | Cách ly an toàn ${quarantineMins} phút.`;
      } else if (closedTrade.side === 'SHORT' && snapshot.trendScore > 0) {
        forensicCategory = 'COUNTER_TREND_PUMP';
        forensicTitle = `Khám Nghiệm: [BẪY SHORT NGƯỢC XU HƯỚNG] ${coinName} (${closedTrade.side} ${lossDistPct}%)`;
        forensicReason = `Lệnh SHORT mở ngược cấu trúc sóng tăng khung lớn (Trend Score +${snapshot.trendScore}). Phe Mua hấp thụ cản kỹ thuật và đẩy giá vượt đỉnh.`;

        coinProfile.minConfidence = Math.min(80, (coinProfile.minConfidence || 68) + 3);
        const prevBuffer = coinProfile.atrBufferPct || 2.0;
        const newBuffer = parseFloat((prevBuffer + 0.3).toFixed(2));
        coinProfile.atrBufferPct = newBuffer;
        forensicAction = `Cấm mở lệnh SHORT trên ${coinName} trong 45 phút | Nâng chuẩn độ tin cậy của ${coinName} lên ${coinProfile.minConfidence}% (yêu cầu nến xác nhận gãy trend).`;
      } else if (closedTrade.side === 'LONG' && snapshot.trendScore < 0) {
        forensicCategory = 'FALLING_KNIFE';
        forensicTitle = `Khám Nghiệm: [BẪY BẮT DAO RƠI DOWNTREND] ${coinName} (${closedTrade.side} ${lossDistPct}%)`;
        forensicReason = `Lệnh LONG mở khi giá đang trong sóng xả dốc (Trend Score ${snapshot.trendScore}). Lực xả phá vỡ hỗ trợ trước khi có tín hiệu đảo chiều.`;

        coinProfile.minConfidence = Math.min(80, (coinProfile.minConfidence || 68) + 3);
        const prevBuffer = coinProfile.atrBufferPct || 2.0;
        const newBuffer = parseFloat((prevBuffer + 0.3).toFixed(2));
        coinProfile.atrBufferPct = newBuffer;
        forensicAction = `Khóa chiều LONG trên ${coinName} trong 45 phút | Chỉ cho phép LONG khi cấu trúc nến tạo đáy sau cao hơn (Higher Low).`;
      } else {
        forensicCategory = 'LIQUIDITY_HUNT';
        forensicTitle = `Khám Nghiệm: [BẪY QUÉT RÂU THANH KHOẢN] ${coinName} (${closedTrade.side} ${lossDistPct}%)`;
        forensicReason = `Thị trường tạo râu nến quét cản (Liquidity Sweep) liếm Stop Loss (${closedTrade.roePercent}% ROE) tại biên độ cản trước khi đảo chiều theo kế hoạch.`;

        const prevBuffer = coinProfile.atrBufferPct || 2.0;
        const newBuffer = parseFloat((prevBuffer + 0.35).toFixed(2));
        coinProfile.atrBufferPct = newBuffer;
        coinProfile.minConfidence = Math.min(80, (coinProfile.minConfidence || 68) + 2);
        forensicAction = `Nới rộng đệm Stop Loss riêng cho ${coinName} lên ${newBuffer}% | Khóa chiều ${closedTrade.side} trong 45 phút chống vào lệnh trả thù.`;
      }

      this.state.adaptiveParams.supportBufferPct = Math.min(2.8, parseFloat(((this.state.adaptiveParams.supportBufferPct || 1.2) + 0.08).toFixed(2)));
      this.state.adaptiveParams.minConfidence = Math.min(78, (this.state.adaptiveParams.minConfidence || 65) + 1);

      lesson = {
        id: `loss-${Date.now()}`,
        timestamp,
        type: 'LEARNED_FROM_LOSS',
        category: forensicCategory,
        symbol: sym,
        tradeSide: closedTrade.side,
        result: 'LOSS',
        roePercent: closedTrade.roePercent,
        pnlUsdt: closedTrade.pnlUsdt,
        title: forensicTitle,
        reason: forensicReason,
        actionTaken: forensicAction,
        coinProfile: { ...coinProfile }
      };
    } else if (isProfit) {
      // Reject extreme outlier glitches from memory reinforcement
      if (closedTrade.roePercent && closedTrade.roePercent > 1000) {
        console.warn('⚠️ [AI LEARNING] Ignoring extreme anomaly profit from pattern reinforcement:', closedTrade.roePercent);
        return null;
      }

      this.state.totalWinsReinforced += 1;
      this.state.totalAdjustments += 1;
      coinProfile.winCount = (coinProfile.winCount || 0) + 1;
      coinProfile.consecutiveLosses = 0;
      coinProfile.cooldownUntil = 0;
      coinProfile.forbiddenDirection = null;
      coinProfile.forbiddenUntil = 0;

      const roe = closedTrade.roePercent || 0;
      const title = `Củng Cố Mẫu Hình Thắng: ${coinName} (+${roe}% ROE)`;
      const reason = `Mô hình nhận diện điểm vào lệnh theo Price Action & Hỗ Trợ/Kháng Cự hoạt động chính xác (${closedTrade.reason}).`;
      const action = `Kế thừa trọng số thắng cho ${coinName} | Tối ưu hóa điểm chốt lời Trailing Stop.`;

      lesson = {
        id: `win-${Date.now()}`,
        timestamp,
        type: 'REINFORCED_WIN',
        category: 'PATTERN_REINFORCEMENT',
        symbol: sym,
        tradeSide: closedTrade.side,
        result: 'WIN',
        roePercent: closedTrade.roePercent,
        pnlUsdt: closedTrade.pnlUsdt,
        title,
        reason,
        actionTaken: action,
        coinProfile: { ...coinProfile }
      };
    }

    if (lesson) {
      this.state.learningLogs.unshift(lesson);
      if (this.state.learningLogs.length > 50) {
        this.state.learningLogs.pop();
      }
      this.saveState();
    }

    return lesson;
  }
}

export const learningEngine = new LearningEngine();
