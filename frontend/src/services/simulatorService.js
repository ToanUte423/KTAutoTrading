/**
 * Paper Trading / Auto-Trade Simulator Engine for Crypto Futures
 */

const STORAGE_KEY = 'kt1_simulator_state';

const DEFAULT_STATE = {
  initialBalance: 100,
  balance: 100, // Available cash
  leverage: 10,
  marginPerTrade: 10, // $10 margin per position
  isAutoTradeActive: true, // Auto execute when 24/7 bot finds signal
  positions: [], // Active open positions
  history: [] // Closed trade logs
};

export function calculateDynamicLeverage(currentPrice, stopLoss, maxCap = 20) {
  if (!currentPrice || !stopLoss) return 10;
  const slDistRatio = Math.abs(currentPrice - stopLoss) / currentPrice;
  if (slDistRatio <= 0.001) return 10;
  // Risk budgeting: Target max 20% margin loss if SL is hit
  const computedLev = Math.floor(0.20 / slDistRatio);
  return Math.max(5, Math.min(maxCap, computedLev));
}

export class SimulatorEngine {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const state = { ...DEFAULT_STATE, ...parsed };

        // Auto-sanitize existing positions to guarantee professional R:R >= 1:2 (TP always longer than SL)
        if (state.positions && state.positions.length > 0) {
          state.positions = state.positions.map(pos => {
            const isLong = pos.side === 'LONG';
            const riskDist = Math.abs(pos.entryPrice - pos.stopLoss);
            const targetDist = Math.abs(pos.takeProfit - pos.entryPrice);

            // If SL is inverted or R:R < 1.4, adjust TP to maintain healthy 1:2.2 R:R
            if (targetDist < riskDist * 1.4) {
              const properReward = riskDist * 2.2;
              const newTp = isLong ? roundP(pos.entryPrice + properReward) : roundP(pos.entryPrice - properReward);
              return {
                ...pos,
                takeProfit: newTp
              };
            }
            return pos;
          });
        }
        return state;
      }
    } catch (e) {
      console.error('Failed to load simulator state:', e);
    }
    return { ...DEFAULT_STATE };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save simulator state:', e);
    }
  }

  resetAccount(initial = 100) {
    this.state = {
      ...DEFAULT_STATE,
      initialBalance: initial,
      balance: initial,
      marginPerTrade: Math.max(5, Math.round(initial * 0.1)),
      positions: [],
      history: []
    };
    this.saveState();
    return this.getState();
  }

  getState() {
    return { ...this.state };
  }

  setLeverage(leverage) {
    this.state.leverage = leverage;
    this.saveState();
  }

  setMarginPerTrade(margin) {
    this.state.marginPerTrade = margin;
    this.saveState();
  }

  setAutoTrade(active) {
    this.state.isAutoTradeActive = active;
    this.saveState();
  }

  /**
   * Open a new position (Full Autonomous with Dynamic Leverage & Position Sizing)
   */
  openPosition({ symbol = 'BTC/USDT', side, currentPrice, stopLoss, takeProfit1, leverage, margin, candleTime }) {
    const cleanSym = (symbol || 'BTC/USDT').replace('/', '').toUpperCase();
    const decimals = cleanSym === 'SUIUSDT' ? 4 : (currentPrice < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));

    // Dynamic leverage automatically calculated based on Stop Loss distance
    const lev = leverage || calculateDynamicLeverage(currentPrice, stopLoss, 20);
    // Dynamic margin: 10% of available cash balance (min $200, max $2000) for compound risk management
    const autoMargin = Math.max(200, Math.min(2000, Math.floor(this.state.balance * 0.10)));
    const posMargin = margin || Math.min(autoMargin, this.state.balance);

    if (posMargin <= 0 || this.state.balance < posMargin) {
      return { success: false, reason: 'Số dư khả dụng không đủ để mở lệnh!' };
    }

    // Deduct margin from available balance
    this.state.balance -= posMargin;

    const notionalValue = posMargin * lev;
    const coinAmount = notionalValue / currentPrice;

    // Liquidation price estimate
    const liqDistance = (currentPrice / lev) * 0.92;
    const liqPrice = side === 'BUY' ? Math.max(0, currentPrice - liqDistance) : currentPrice + liqDistance;

    const isLong = side === 'BUY';
    let sl = stopLoss || (isLong ? roundP(currentPrice * 0.99) : roundP(currentPrice * 1.01));
    let tp = takeProfit1 || (isLong ? roundP(currentPrice * 1.022) : roundP(currentPrice * 0.978));

    // RISK-TO-REWARD VALIDATION: Ensure Take Profit offers at least 1.4x Reward over Risk if not set by S/R
    const riskDist = Math.abs(currentPrice - sl);
    const rewardDist = Math.abs(tp - currentPrice);
    if (!takeProfit1 && rewardDist < riskDist * 1.5) {
      const properReward = riskDist * 2.0; // 2.0x generous Take Profit (R:R 1:2.0)
      tp = isLong ? roundP(currentPrice + properReward) : roundP(currentPrice - properReward);
    }

    const newPosition = {
      id: `pos-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      symbol: symbol.includes('/') ? symbol : `${cleanSym.replace('USDT', '')}/USDT`,
      side: isLong ? 'LONG' : 'SHORT',
      entryPrice: roundP(currentPrice),
      currentPrice: roundP(currentPrice),
      leverage: lev,
      margin: posMargin,
      notionalValue: parseFloat(notionalValue.toFixed(2)),
      btcAmount: parseFloat(coinAmount.toFixed(4)),
      coinAmount: parseFloat(coinAmount.toFixed(4)),
      stopLoss: roundP(sl),
      takeProfit: roundP(tp),
      liqPrice: roundP(liqPrice),
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      openedTimestamp: Date.now(),
      candleTime: candleTime || Math.floor(Date.now() / 1000),
      unrealizedPnl: 0,
      roePercent: 0
    };

    this.state.positions.push(newPosition);
    this.saveState();

    return { success: true, position: newPosition };
  }

  /**
   * Close an open position
   */
  closePosition(positionId, currentPrice, reason = 'Đóng tay', candleTime = null) {
    const index = this.state.positions.findIndex(p => p.id === positionId);
    if (index === -1) return null;

    const pos = this.state.positions[index];
    const isLong = pos.side === 'LONG';
    const cleanSym = (pos.symbol || 'BTC/USDT').replace('/', '').toUpperCase();
    const decimals = cleanSym === 'SUIUSDT' ? 4 : (pos.entryPrice < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));

    // Ensure exit price accurately reflects real live market price
    let effectiveExitPrice = currentPrice || pos.currentPrice || pos.entryPrice;

    // Strict Cross-Coin & Outlier Protection Guard:
    // If the price deviates more than 300% from entry, it is guaranteed to be a cross-coin pollution bug!
    if (pos.entryPrice > 0 && Math.abs(effectiveExitPrice - pos.entryPrice) / pos.entryPrice > 3.0) {
      console.warn(`⚠️ [SIMULATOR SAFETY GUARD] Rejecting anomalous exit price $${effectiveExitPrice} for ${pos.symbol} (entry $${pos.entryPrice}). Falling back to pos.currentPrice ($${pos.currentPrice}).`);
      effectiveExitPrice = pos.currentPrice || pos.entryPrice;
    }

    // If exit price is mathematically identical to entry price, simulate realistic tick variation
    if (effectiveExitPrice === pos.entryPrice) {
      const spreadSlippage = (Math.random() * 0.0008 - 0.0003) * pos.entryPrice;
      effectiveExitPrice = roundP(pos.entryPrice + (isLong ? spreadSlippage : -spreadSlippage));
    } else {
      effectiveExitPrice = roundP(effectiveExitPrice);
    }

    // Calculate profit
    const priceDiffRatio = isLong
      ? (effectiveExitPrice - pos.entryPrice) / pos.entryPrice
      : (pos.entryPrice - effectiveExitPrice) / pos.entryPrice;

    const roePercent = parseFloat((priceDiffRatio * pos.leverage * 100).toFixed(2));
    const pnlUsdt = parseFloat((pos.margin * (roePercent / 100)).toFixed(2));

    // Return margin + PnL back to balance
    const returnedAmount = Math.max(0, pos.margin + pnlUsdt);
    this.state.balance = parseFloat((this.state.balance + returnedAmount).toFixed(2));

    // Remove from open positions
    this.state.positions.splice(index, 1);

    const closedTrade = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      leverage: pos.leverage,
      margin: pos.margin,
      entryPrice: pos.entryPrice,
      exitPrice: effectiveExitPrice,
      openedAt: pos.openedAt,
      candleTime: pos.candleTime || Math.floor((pos.openedTimestamp || Date.now()) / 1000),
      openedTimestamp: pos.openedTimestamp || Date.now(),
      closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      closedCandleTime: candleTime || Math.floor(Date.now() / 1000),
      closedTimestamp: Date.now(),
      pnlUsdt,
      roePercent,
      reason
    };

    this.state.history.unshift(closedTrade);
    if (this.state.history.length > 100) {
      this.state.history.pop();
    }

    this.saveState();
    return closedTrade;
  }

  /**
   * Update all open positions with current live price and check TP / SL / Liquidation triggers
   * Isolates checks by matching coin symbol!
   */
  updatePriceTick(currentPrice, symbol = 'BTC/USDT') {
    if (!currentPrice || this.state.positions.length === 0) {
      return { triggeredEvents: [] };
    }

    const cleanSym = (symbol || 'BTC/USDT').replace('/', '').toUpperCase();
    const decimals = cleanSym === 'SUIUSDT' ? 4 : (currentPrice < 10 ? 4 : 2);
    const roundP = (p) => parseFloat(Number(p).toFixed(decimals));
    const price = roundP(currentPrice);
    const triggeredEvents = [];

    // Clone positions array for safe iteration while closing
    const positionsList = [...this.state.positions];

    for (const pos of positionsList) {
      if (cleanSym && pos.symbol) {
        const posSym = pos.symbol.replace('/', '').toUpperCase();
        if (posSym !== cleanSym) continue; // Only process position for this symbol!
      }

      pos.currentPrice = price;
      const isLong = pos.side === 'LONG';

      const priceDiffRatio = isLong
        ? (price - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - price) / pos.entryPrice;

      const roePercent = parseFloat((priceDiffRatio * pos.leverage * 100).toFixed(2));
      const pnlUsdt = parseFloat((pos.margin * (roePercent / 100)).toFixed(2));

      pos.roePercent = roePercent;
      pos.unrealizedPnl = pnlUsdt;

      // 1. Check Take Profit Hit
      const isTpHit = isLong
        ? price >= pos.takeProfit
        : price <= pos.takeProfit;

      // 2. Check Stop Loss Hit
      const isSlHit = isLong
        ? price <= pos.stopLoss
        : price >= pos.stopLoss;

      // 3. Check Liquidation Hit
      const isLiqHit = isLong
        ? price <= pos.liqPrice
        : price >= pos.liqPrice;

      if (isTpHit) {
        const closed = this.closePosition(pos.id, price, '🎯 Chốt lời (TP Hit)');
        if (closed) triggeredEvents.push({ type: 'TP', trade: closed });
      } else if (isLiqHit) {
        const closed = this.closePosition(pos.id, price, '💥 Thanh lý (Liq Hit)');
        if (closed) triggeredEvents.push({ type: 'LIQ', trade: closed });
      } else if (isSlHit) {
        const closed = this.closePosition(pos.id, price, '🛑 Cắt lỗ (SL Hit)');
        if (closed) triggeredEvents.push({ type: 'SL', trade: closed });
      }
    }

    this.saveState();
    return { triggeredEvents };
  }

  /**
   * Get account performance summary
   */
  getAccountSummary() {
    const totalMarginInPositions = this.state.positions.reduce((sum, p) => sum + p.margin, 0);
    const totalUnrealizedPnl = this.state.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalEquity = this.state.balance + totalMarginInPositions + totalUnrealizedPnl;

    const closedTrades = this.state.history;
    const winTrades = closedTrades.filter(t => t.pnlUsdt > 0);
    const lossTrades = closedTrades.filter(t => t.pnlUsdt < 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

    const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + t.pnlUsdt, 0);
    const totalNetPnl = totalEquity - this.state.initialBalance;
    const totalRoi = (totalNetPnl / this.state.initialBalance) * 100;

    return {
      balance: parseFloat(this.state.balance.toFixed(2)),
      equity: parseFloat(totalEquity.toFixed(2)),
      totalMargin: parseFloat(totalMarginInPositions.toFixed(2)),
      unrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
      realizedPnl: parseFloat(totalRealizedPnl.toFixed(2)),
      netPnl: parseFloat(totalNetPnl.toFixed(2)),
      roiPercent: parseFloat(totalRoi.toFixed(2)),
      totalTrades: closedTrades.length,
      winTrades: winTrades.length,
      lossTrades: lossTrades.length,
      winRate: parseFloat(winRate.toFixed(1)),
      openPositionsCount: this.state.positions.length
    };
  }
}

export const simulator = new SimulatorEngine();
