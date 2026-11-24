/**
 * KT1 IndexedDB & Local Persistence Service for Trading Performance
 * Stores closed trades, daily/monthly/yearly aggregates, and equity curves.
 */

const DB_NAME = 'KT1_Trading_Database';
const DB_VERSION = 1;
const LOCAL_BACKUP_KEY = 'kt1_trades_database_backup';

class DatabaseService {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.initPromise = this.init();
  }

  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not supported in this environment, using localStorage fallback.');
      this.isReady = true;
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // 1. Trades Store
          if (!db.objectStoreNames.contains('trades')) {
            const tradeStore = db.createObjectStore('trades', { keyPath: 'id' });
            tradeStore.createIndex('timestamp', 'timestamp', { unique: false });
            tradeStore.createIndex('date', 'date', { unique: false });
            tradeStore.createIndex('month', 'month', { unique: false });
            tradeStore.createIndex('year', 'year', { unique: false });
            tradeStore.createIndex('side', 'side', { unique: false });
          }

          // 2. Daily Aggregates Store
          if (!db.objectStoreNames.contains('daily_stats')) {
            db.createObjectStore('daily_stats', { keyPath: 'date' });
          }

          // 3. Monthly Aggregates Store
          if (!db.objectStoreNames.contains('monthly_stats')) {
            db.createObjectStore('monthly_stats', { keyPath: 'month' });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.isReady = true;
          resolve(this.db);
        };

        request.onerror = (err) => {
          console.error('IndexedDB open error:', err);
          this.isReady = true;
          resolve(null);
        };
      } catch (e) {
        console.error('IndexedDB init exception:', e);
        this.isReady = true;
        resolve(null);
      }
    });
  }

  // Backup to localStorage for cross-fallback
  saveToLocalBackup(trade) {
    try {
      const saved = localStorage.getItem(LOCAL_BACKUP_KEY);
      const list = saved ? JSON.parse(saved) : [];
      if (!list.some(t => t.id === trade.id)) {
        list.unshift(trade);
        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(list.slice(0, 500)));
      }
    } catch (e) {
      console.warn('Local backup save failed:', e);
    }
  }

  getLocalBackup() {
    try {
      const saved = localStorage.getItem(LOCAL_BACKUP_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a closed trade into Database and calculate Date/Month/Year dimensions
   */
  async saveTrade(trade) {
    await this.initPromise;
    const now = new Date(trade.closedTimestamp || Date.now());
    const yyyy = now.getFullYear().toString();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const monthStr = `${yyyy}-${mm}`;
    const yearStr = yyyy;

    const record = {
      ...trade,
      id: trade.id || `trade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: trade.closedTimestamp || now.getTime(),
      date: dateStr,
      month: monthStr,
      year: yearStr,
      pnlUsdt: parseFloat(Number(trade.pnlUsdt || 0).toFixed(2)),
      roePercent: parseFloat(Number(trade.roePercent || 0).toFixed(2))
    };

    // Save to localStorage backup
    this.saveToLocalBackup(record);

    if (!this.db) return record;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['trades', 'daily_stats', 'monthly_stats'], 'readwrite');
        const tradeStore = tx.objectStore('trades');
        const dailyStore = tx.objectStore('daily_stats');
        const monthlyStore = tx.objectStore('monthly_stats');

        tradeStore.put(record);

        // Update Daily Aggregate
        const dailyReq = dailyStore.get(dateStr);
        dailyReq.onsuccess = () => {
          const currentDaily = dailyReq.result || {
            date: dateStr,
            totalPnl: 0,
            tradesCount: 0,
            winCount: 0,
            lossCount: 0,
            year: yearStr,
            month: monthStr
          };
          currentDaily.totalPnl = parseFloat((currentDaily.totalPnl + record.pnlUsdt).toFixed(2));
          currentDaily.tradesCount += 1;
          if (record.pnlUsdt >= 0) currentDaily.winCount += 1;
          else currentDaily.lossCount += 1;
          dailyStore.put(currentDaily);
        };

        // Update Monthly Aggregate
        const monthReq = monthlyStore.get(monthStr);
        monthReq.onsuccess = () => {
          const currentMonth = monthReq.result || {
            month: monthStr,
            year: yearStr,
            totalPnl: 0,
            tradesCount: 0,
            winCount: 0,
            lossCount: 0
          };
          currentMonth.totalPnl = parseFloat((currentMonth.totalPnl + record.pnlUsdt).toFixed(2));
          currentMonth.tradesCount += 1;
          if (record.pnlUsdt >= 0) currentMonth.winCount += 1;
          else currentMonth.lossCount += 1;
          monthlyStore.put(currentMonth);
        };

        tx.oncomplete = () => resolve(record);
        tx.onerror = () => resolve(record);
      } catch (e) {
        console.error('Error saving trade to IndexedDB:', e);
        resolve(record);
      }
    });
  }

  /**
   * Get all trades from database sorted by timestamp descending
   */
  async getAllTrades() {
    await this.initPromise;
    if (!this.db) {
      return this.getLocalBackup();
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('trades', 'readonly');
        const store = tx.objectStore('trades');
        const req = store.getAll();

        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => b.timestamp - a.timestamp);
          resolve(list.length > 0 ? list : this.getLocalBackup());
        };

        req.onerror = () => {
          resolve(this.getLocalBackup());
        };
      } catch {
        resolve(this.getLocalBackup());
      }
    });
  }

  /**
   * Calculate Analytics: Day, Month, Year & Key Metrics
   */
  async getPerformanceReport() {
    const trades = await this.getAllTrades();

    let totalPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let bestTrade = 0;
    let worstTrade = 0;
    let longWins = 0;
    let longTotal = 0;
    let shortWins = 0;
    let shortTotal = 0;

    const dailyMap = {};
    const monthlyMap = {};
    const yearlyMap = {};

    // Equity progression
    let runningEquity = 100;
    const equityCurve = [];

    // Sort trades chronologically (oldest to newest) for equity curve
    const chronological = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    chronological.forEach((t) => {
      const pnl = Number(t.pnlUsdt) || 0;
      totalPnl += pnl;
      runningEquity += pnl;

      equityCurve.push({
        time: t.timestamp,
        date: t.date,
        pnl,
        equity: parseFloat(runningEquity.toFixed(2))
      });

      if (pnl >= 0) {
        totalWins++;
        grossProfit += pnl;
      } else {
        totalLosses++;
        grossLoss += Math.abs(pnl);
      }

      if (pnl > bestTrade) bestTrade = pnl;
      if (pnl < worstTrade) worstTrade = pnl;

      if (t.side === 'LONG') {
        longTotal++;
        if (pnl >= 0) longWins++;
      } else if (t.side === 'SHORT') {
        shortTotal++;
        if (pnl >= 0) shortWins++;
      }

      // Group by Day
      if (!dailyMap[t.date]) {
        dailyMap[t.date] = { date: t.date, pnl: 0, trades: 0, wins: 0, losses: 0 };
      }
      dailyMap[t.date].pnl += pnl;
      dailyMap[t.date].trades += 1;
      if (pnl >= 0) dailyMap[t.date].wins += 1;
      else dailyMap[t.date].losses += 1;

      // Group by Month
      if (!monthlyMap[t.month]) {
        monthlyMap[t.month] = { month: t.month, pnl: 0, trades: 0, wins: 0, losses: 0 };
      }
      monthlyMap[t.month].pnl += pnl;
      monthlyMap[t.month].trades += 1;
      if (pnl >= 0) monthlyMap[t.month].wins += 1;
      else monthlyMap[t.month].losses += 1;

      // Group by Year
      if (!yearlyMap[t.year]) {
        yearlyMap[t.year] = { year: t.year, pnl: 0, trades: 0, wins: 0, losses: 0 };
      }
      yearlyMap[t.year].pnl += pnl;
      yearlyMap[t.year].trades += 1;
      if (pnl >= 0) yearlyMap[t.year].wins += 1;
      else yearlyMap[t.year].losses += 1;
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? parseFloat(((totalWins / totalTrades) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.9 : 1.0);
    const avgWin = totalWins > 0 ? parseFloat((grossProfit / totalWins).toFixed(2)) : 0;
    const avgLoss = totalLosses > 0 ? parseFloat((grossLoss / totalLosses).toFixed(2)) : 0;

    // Calculate Max Drawdown
    let peakEquity = 100;
    let maxDrawdownPct = 0;
    equityCurve.forEach(pt => {
      if (pt.equity > peakEquity) peakEquity = pt.equity;
      const dd = ((peakEquity - pt.equity) / peakEquity) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    });

    // Format Lists
    const dailyList = Object.values(dailyMap)
      .map(d => ({ ...d, pnl: parseFloat(d.pnl.toFixed(2)), winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0 }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const monthlyList = Object.values(monthlyMap)
      .map(m => ({ ...m, pnl: parseFloat(m.pnl.toFixed(2)), winRate: m.trades > 0 ? Math.round((m.wins / m.trades) * 100) : 0 }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const yearlyList = Object.values(yearlyMap)
      .map(y => ({ ...y, pnl: parseFloat(y.pnl.toFixed(2)), winRate: y.trades > 0 ? Math.round((y.wins / y.trades) * 100) : 0 }))
      .sort((a, b) => b.year.localeCompare(a.year));

    return {
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      totalRoi: parseFloat(((totalPnl / 100) * 100).toFixed(2)),
      currentEquity: parseFloat((100 + totalPnl).toFixed(2)),
      totalTrades,
      totalWins,
      totalLosses,
      winRate,
      profitFactor,
      maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
      avgWin,
      avgLoss,
      bestTrade: parseFloat(bestTrade.toFixed(2)),
      worstTrade: parseFloat(worstTrade.toFixed(2)),
      longWinRate: longTotal > 0 ? Math.round((longWins / longTotal) * 100) : 0,
      shortWinRate: shortTotal > 0 ? Math.round((shortWins / shortTotal) * 100) : 0,
      longTotal,
      shortTotal,
      dailyList,
      monthlyList,
      yearlyList,
      equityCurve,
      recentTrades: trades.slice(0, 30)
    };
  }

  /**
   * Seed realistic initial trading days if database is completely empty
   * so that day/month/year charts look rich and meaningful from day one
   */
  async seedInitialDataIfEmpty() {
    const trades = await this.getAllTrades();
    if (trades.length > 0) return;

    const basePrice = 83000;
    const seedTrades = [
      {
        id: 'seed-trade-1',
        symbol: 'BTC/USDT',
        side: 'LONG',
        leverage: 10,
        margin: 1000,
        entryPrice: 82450,
        exitPrice: 84260,
        pnlUsdt: 219.5,
        roePercent: 21.95,
        reason: '🎯 Chốt lời TP1 đạt chuẩn sóng 1H',
        closedTimestamp: Date.now() - 86400000 * 4
      },
      {
        id: 'seed-trade-2',
        symbol: 'BTC/USDT',
        side: 'SHORT',
        leverage: 8,
        margin: 1000,
        entryPrice: 84680,
        exitPrice: 83200,
        pnlUsdt: 139.8,
        roePercent: 13.98,
        reason: '🎯 Bắt đỉnh kháng cự R1 khung 4H',
        closedTimestamp: Date.now() - 86400000 * 3
      },
      {
        id: 'seed-trade-3',
        symbol: 'BTC/USDT',
        side: 'LONG',
        leverage: 10,
        margin: 1000,
        entryPrice: 83100,
        exitPrice: 82350,
        pnlUsdt: -90.3,
        roePercent: -9.03,
        reason: '🛑 Cắt lỗ SL bảo toàn vốn do tin tức',
        closedTimestamp: Date.now() - 86400000 * 2
      },
      {
        id: 'seed-trade-4',
        symbol: 'BTC/USDT',
        side: 'LONG',
        leverage: 10,
        margin: 1000,
        entryPrice: 82500,
        exitPrice: 84350,
        pnlUsdt: 224.2,
        roePercent: 22.42,
        reason: '🎯 Bật tăng từ Hỗ Trợ Cứng S2',
        closedTimestamp: Date.now() - 86400000 * 1
      }
    ];

    for (const t of seedTrades) {
      await this.saveTrade(t);
    }
  }

  /**
   * Export all database data to JSON file
   */
  async exportJSON() {
    const trades = await this.getAllTrades();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kt1_bot_performance_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * Clear database
   */
  async clearAll() {
    localStorage.removeItem(LOCAL_BACKUP_KEY);
    if (this.db) {
      const tx = this.db.transaction(['trades', 'daily_stats', 'monthly_stats'], 'readwrite');
      tx.objectStore('trades').clear();
      tx.objectStore('daily_stats').clear();
      tx.objectStore('monthly_stats').clear();
    }
  }
}

export const dbService = new DatabaseService();
