/**
 * KTAutoTrading - SQLite Persistent Database
 * Replaces JSON file storage with proper SQLite for 24/7 Pi 5 operation.
 * Database file: server/data/ktautotrading.db
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'ktautotrading.db');
const LEGACY_JSON = path.join(DATA_DIR, 'state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Open SQLite DB (synchronous, WAL mode for performance) ─────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema Creation ─────────────────────────────────────────────────────────
db.exec(`
  -- Bot brain / AI learning state
  CREATE TABLE IF NOT EXISTS brain (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    generation      INTEGER NOT NULL DEFAULT 1,
    mistakes        INTEGER NOT NULL DEFAULT 0,
    wins            INTEGER NOT NULL DEFAULT 0,
    adjustments     INTEGER NOT NULL DEFAULT 0,
    params_json     TEXT    NOT NULL DEFAULT '{}',
    logs_json       TEXT    NOT NULL DEFAULT '[]',
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  -- Account / simulator configuration
  CREATE TABLE IF NOT EXISTS account (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    initial_balance   REAL    NOT NULL DEFAULT 100,
    balance           REAL    NOT NULL DEFAULT 100,
    leverage          INTEGER NOT NULL DEFAULT 10,
    margin_per_trade  REAL    NOT NULL DEFAULT 10,
    auto_trade_active INTEGER NOT NULL DEFAULT 1,
    updated_at        INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  -- Open positions
  CREATE TABLE IF NOT EXISTS positions (
    id              TEXT    PRIMARY KEY,
    symbol          TEXT    NOT NULL DEFAULT 'BTC/USDT',
    side            TEXT    NOT NULL,
    entry_price     REAL    NOT NULL,
    current_price   REAL,
    leverage        INTEGER NOT NULL,
    margin          REAL    NOT NULL,
    notional_value  REAL,
    btc_amount      REAL,
    stop_loss       REAL,
    take_profit     REAL,
    liq_price       REAL,
    opened_at       TEXT,
    opened_ts       INTEGER NOT NULL,
    candle_time     INTEGER,
    unrealized_pnl  REAL    NOT NULL DEFAULT 0,
    roe_percent     REAL    NOT NULL DEFAULT 0,
    extra_json      TEXT    NOT NULL DEFAULT '{}'
  );

  -- Closed trade history (permanent record)
  CREATE TABLE IF NOT EXISTS trade_history (
    id              TEXT    PRIMARY KEY,
    symbol          TEXT    NOT NULL DEFAULT 'BTC/USDT',
    side            TEXT    NOT NULL,
    entry_price     REAL    NOT NULL,
    exit_price      REAL    NOT NULL,
    leverage        INTEGER NOT NULL,
    margin          REAL    NOT NULL,
    pnl_usdt        REAL    NOT NULL,
    roe_percent     REAL    NOT NULL,
    reason          TEXT,
    opened_at       TEXT,
    closed_at       TEXT,
    opened_ts       INTEGER,
    closed_ts       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    date_key        TEXT    NOT NULL,  -- 'YYYY-MM-DD'
    month_key       TEXT    NOT NULL,  -- 'YYYY-MM'
    year_key        TEXT    NOT NULL,  -- 'YYYY'
    candle_time     INTEGER,
    extra_json      TEXT    NOT NULL DEFAULT '{}'
  );

  -- Daily aggregates (auto-updated on trade close)
  CREATE TABLE IF NOT EXISTS daily_stats (
    date_key        TEXT    PRIMARY KEY,
    trades_count    INTEGER NOT NULL DEFAULT 0,
    win_count       INTEGER NOT NULL DEFAULT 0,
    loss_count      INTEGER NOT NULL DEFAULT 0,
    total_pnl       REAL    NOT NULL DEFAULT 0,
    win_rate        REAL    NOT NULL DEFAULT 0,
    month_key       TEXT,
    year_key        TEXT
  );

  -- Monthly aggregates
  CREATE TABLE IF NOT EXISTS monthly_stats (
    month_key       TEXT    PRIMARY KEY,
    trades_count    INTEGER NOT NULL DEFAULT 0,
    win_count       INTEGER NOT NULL DEFAULT 0,
    loss_count      INTEGER NOT NULL DEFAULT 0,
    total_pnl       REAL    NOT NULL DEFAULT 0,
    win_rate        REAL    NOT NULL DEFAULT 0,
    year_key        TEXT
  );

  -- Yearly aggregates
  CREATE TABLE IF NOT EXISTS yearly_stats (
    year_key        TEXT    PRIMARY KEY,
    trades_count    INTEGER NOT NULL DEFAULT 0,
    win_count       INTEGER NOT NULL DEFAULT 0,
    loss_count      INTEGER NOT NULL DEFAULT 0,
    total_pnl       REAL    NOT NULL DEFAULT 0,
    win_rate        REAL    NOT NULL DEFAULT 0
  );

  -- Bot configuration settings (Telegram token, Chat ID, Circuit Breaker)
  CREATE TABLE IF NOT EXISTS bot_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Indexes for fast queries
  CREATE INDEX IF NOT EXISTS idx_trade_date  ON trade_history(date_key);
  CREATE INDEX IF NOT EXISTS idx_trade_month ON trade_history(month_key);
  CREATE INDEX IF NOT EXISTS idx_trade_year  ON trade_history(year_key);
  CREATE INDEX IF NOT EXISTS idx_trade_ts    ON trade_history(closed_ts DESC);
`);

// ─── Seed default rows ────────────────────────────────────────────────────────
const DEFAULT_BRAIN_PARAMS = {
  minConfidence: 65,
  supportBufferPct: 0.8,
  stopLossTightness: 1.0,
  rrTargetRatio: 2.2,
  maxLeverageCap: 15,
  rsiOversoldLimit: 32,
  newsFilterStrictness: 2.0
};

db.prepare(`INSERT OR IGNORE INTO brain (id, params_json) VALUES (1, ?)`).run(JSON.stringify(DEFAULT_BRAIN_PARAMS));
db.prepare(`INSERT OR IGNORE INTO account (id) VALUES (1)`).run();

// ─── Migrate from legacy state.json if it exists ─────────────────────────────
function migrateLegacy() {
  if (!fs.existsSync(LEGACY_JSON)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf-8'));
    const sim = raw.simulator || {};
    const brain = raw.brain || {};

    // Migrate account state
    if (sim.balance !== undefined) {
      db.prepare(`UPDATE account SET balance=?, initial_balance=?, leverage=?, margin_per_trade=?, auto_trade_active=? WHERE id=1`)
        .run(sim.balance ?? 100, sim.initialBalance ?? 100, sim.leverage ?? 10,
             sim.marginPerTrade ?? 10, sim.isAutoTradeActive ? 1 : 0);
    }

    // Migrate brain
    if (brain.generation) {
      db.prepare(`UPDATE brain SET generation=?, mistakes=?, wins=?, adjustments=?, params_json=?, logs_json=? WHERE id=1`)
        .run(brain.generation ?? 1, brain.totalMistakesAnalyzed ?? 0,
             brain.totalWinsReinforced ?? 0, brain.totalAdjustments ?? 0,
             JSON.stringify(brain.adaptiveParams || DEFAULT_BRAIN_PARAMS),
             JSON.stringify((brain.learningLogs || []).slice(-50)));
    }

    // Migrate trade history
    const insertTrade = db.prepare(`
      INSERT OR IGNORE INTO trade_history
        (id, symbol, side, entry_price, exit_price, leverage, margin, pnl_usdt, roe_percent,
         reason, opened_at, closed_at, opened_ts, closed_ts, date_key, month_key, year_key, candle_time, extra_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const history = sim.history || [];
    let migrated = 0;
    for (const t of history) {
      if (!t.id || !t.exitPrice) continue;
      const ts = t.closedTimestamp || Date.now();
      const d = new Date(ts);
      const dk = d.toISOString().split('T')[0];
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const yk = `${d.getFullYear()}`;
      try {
        insertTrade.run(
          t.id, t.symbol || 'BTC/USDT', t.side, t.entryPrice, t.exitPrice,
          t.leverage || 10, t.margin || 1000, t.pnlUsdt || 0, t.roePercent || 0,
          t.reason || '', t.openedAt || '', t.closedAt || '',
          t.openedTimestamp || ts, ts, dk, mk, yk,
          t.candleTime || null, '{}'
        );
        migrated++;
      } catch {}
    }

    // Migrate positions
    for (const pos of (sim.positions || [])) {
      if (!pos.id) continue;
      try {
        db.prepare(`INSERT OR IGNORE INTO positions
          (id,symbol,side,entry_price,current_price,leverage,margin,notional_value,btc_amount,
           stop_loss,take_profit,liq_price,opened_at,opened_ts,candle_time,unrealized_pnl,roe_percent)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(pos.id, pos.symbol||'BTC/USDT', pos.side, pos.entryPrice, pos.currentPrice||pos.entryPrice,
               pos.leverage||10, pos.margin||1000, pos.notionalValue||0, pos.btcAmount||0,
               pos.stopLoss||0, pos.takeProfit||0, pos.liqPrice||0, pos.openedAt||'',
               pos.openedTimestamp||Date.now(), pos.candleTime||null, pos.unrealizedPnl||0, pos.roePercent||0);
      } catch {}
    }

    console.log(`✅ [DB MIGRATION] Migrated ${migrated} trades from state.json to SQLite`);

    // Rebuild aggregates from migrated history
    rebuildAggregates();

    // Rename legacy file to avoid double-migration
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated');
    console.log(`✅ [DB MIGRATION] state.json → state.json.migrated (complete)`);
  } catch (err) {
    console.error('⚠️ [DB MIGRATION] Failed:', err.message);
  }
}

function rebuildAggregates() {
  // Clear and rebuild daily/monthly/yearly from trade_history
  db.prepare('DELETE FROM daily_stats').run();
  db.prepare('DELETE FROM monthly_stats').run();
  db.prepare('DELETE FROM yearly_stats').run();

  const rows = db.prepare('SELECT date_key, month_key, year_key, pnl_usdt FROM trade_history').all();
  for (const r of rows) {
    _updateAggregates(r.date_key, r.month_key, r.year_key, r.pnl_usdt);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _updateAggregates(dateKey, monthKey, yearKey, pnlUsdt) {
  const isWin = pnlUsdt >= 0 ? 1 : 0;

  // Daily
  const daily = db.prepare('SELECT * FROM daily_stats WHERE date_key=?').get(dateKey);
  if (!daily) {
    db.prepare(`INSERT INTO daily_stats (date_key,month_key,year_key,trades_count,win_count,loss_count,total_pnl,win_rate)
                VALUES (?,?,?,1,?,?,?,?)`)
      .run(dateKey, monthKey, yearKey, isWin, 1-isWin, pnlUsdt, isWin * 100);
  } else {
    const tc = daily.trades_count + 1;
    const wc = daily.win_count + isWin;
    db.prepare(`UPDATE daily_stats SET trades_count=?,win_count=?,loss_count=?,total_pnl=?,win_rate=? WHERE date_key=?`)
      .run(tc, wc, daily.loss_count + (1-isWin), parseFloat((daily.total_pnl + pnlUsdt).toFixed(2)),
           parseFloat(((wc/tc)*100).toFixed(1)), dateKey);
  }

  // Monthly
  const monthly = db.prepare('SELECT * FROM monthly_stats WHERE month_key=?').get(monthKey);
  if (!monthly) {
    db.prepare(`INSERT INTO monthly_stats (month_key,year_key,trades_count,win_count,loss_count,total_pnl,win_rate)
                VALUES (?,?,1,?,?,?,?)`)
      .run(monthKey, yearKey, isWin, 1-isWin, pnlUsdt, isWin * 100);
  } else {
    const tc = monthly.trades_count + 1;
    const wc = monthly.win_count + isWin;
    db.prepare(`UPDATE monthly_stats SET trades_count=?,win_count=?,loss_count=?,total_pnl=?,win_rate=? WHERE month_key=?`)
      .run(tc, wc, monthly.loss_count + (1-isWin), parseFloat((monthly.total_pnl + pnlUsdt).toFixed(2)),
           parseFloat(((wc/tc)*100).toFixed(1)), monthKey);
  }

  // Yearly
  const yearly = db.prepare('SELECT * FROM yearly_stats WHERE year_key=?').get(yearKey);
  if (!yearly) {
    db.prepare(`INSERT INTO yearly_stats (year_key,trades_count,win_count,loss_count,total_pnl,win_rate)
                VALUES (?,1,?,?,?,?)`)
      .run(yearKey, isWin, 1-isWin, pnlUsdt, isWin * 100);
  } else {
    const tc = yearly.trades_count + 1;
    const wc = yearly.win_count + isWin;
    db.prepare(`UPDATE yearly_stats SET trades_count=?,win_count=?,loss_count=?,total_pnl=?,win_rate=? WHERE year_key=?`)
      .run(tc, wc, yearly.loss_count + (1-isWin), parseFloat((yearly.total_pnl + pnlUsdt).toFixed(2)),
           parseFloat(((wc/tc)*100).toFixed(1)), yearKey);
  }
}

// Run migration on startup
migrateLegacy();

// ─── ServerDatabase class (public API, same interface as before) ──────────────
export class ServerDatabase {
  // ── Account / Simulator ──────────────────────────────────────────────────
  getSimulatorState() {
    const acc = db.prepare('SELECT * FROM account WHERE id=1').get();
    const positions = db.prepare('SELECT * FROM positions ORDER BY opened_ts DESC').all()
      .map(p => ({
        id: p.id, symbol: p.symbol, side: p.side,
        entryPrice: p.entry_price, currentPrice: p.current_price,
        leverage: p.leverage, margin: p.margin,
        notionalValue: p.notional_value, btcAmount: p.btc_amount,
        stopLoss: p.stop_loss, takeProfit: p.take_profit, liqPrice: p.liq_price,
        openedAt: p.opened_at, openedTimestamp: p.opened_ts, candleTime: p.candle_time,
        unrealizedPnl: p.unrealized_pnl, roePercent: p.roe_percent,
        ...JSON.parse(p.extra_json || '{}')
      }));
    const history = db.prepare('SELECT * FROM trade_history ORDER BY closed_ts DESC LIMIT 300').all()
      .map(t => ({
        id: t.id, symbol: t.symbol, side: t.side,
        entryPrice: t.entry_price, exitPrice: t.exit_price,
        leverage: t.leverage, margin: t.margin,
        pnlUsdt: t.pnl_usdt, roePercent: t.roe_percent,
        reason: t.reason, openedAt: t.opened_at, closedAt: t.closed_at,
        openedTimestamp: t.opened_ts, closedTimestamp: t.closed_ts,
        candleTime: t.candle_time, date: t.date_key,
        ...JSON.parse(t.extra_json || '{}')
      }));
    return {
      initialBalance: acc.initial_balance,
      balance: acc.balance,
      leverage: acc.leverage,
      marginPerTrade: acc.margin_per_trade,
      isAutoTradeActive: acc.auto_trade_active === 1,
      positions,
      history
    };
  }

  saveSimulatorState(simState) {
    const tx = db.transaction(() => {
      // Update account fields
      db.prepare(`UPDATE account SET balance=?, leverage=?, margin_per_trade=?, auto_trade_active=?, updated_at=strftime('%s','now') WHERE id=1`)
        .run(simState.balance ?? 100, simState.leverage ?? 10,
             simState.marginPerTrade ?? 10, simState.isAutoTradeActive ? 1 : 0);

      // Sync positions: delete all and re-insert (positions are few, typically 0-2)
      if (simState.positions !== undefined) {
        db.prepare('DELETE FROM positions').run();
        const insertPos = db.prepare(`
          INSERT OR REPLACE INTO positions
            (id,symbol,side,entry_price,current_price,leverage,margin,notional_value,btc_amount,
             stop_loss,take_profit,liq_price,opened_at,opened_ts,candle_time,unrealized_pnl,roe_percent,extra_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const pos of (simState.positions || [])) {
          const extra = {
            isBreakEvenSet: Boolean(pos.isBreakEvenSet),
            trailingActive: Boolean(pos.trailingActive),
            peakPrice: pos.peakPrice || pos.entryPrice
          };
          insertPos.run(
            pos.id, pos.symbol||'BTC/USDT', pos.side,
            pos.entryPrice, pos.currentPrice||pos.entryPrice,
            pos.leverage||10, pos.margin||10,
            pos.notionalValue||0, pos.btcAmount||0,
            pos.stopLoss||0, pos.takeProfit||0, pos.liqPrice||0,
            pos.openedAt||'', pos.openedTimestamp||Date.now(), pos.candleTime||null,
            pos.unrealizedPnl||0, pos.roePercent||0, JSON.stringify(extra)
          );
        }
      }
    });
    tx();
  }

  // ── Brain / AI Learning ───────────────────────────────────────────────────
  getBrainState() {
    const row = db.prepare('SELECT * FROM brain WHERE id=1').get();
    if (!row) return null;
    const parsedParams = JSON.parse(row.params_json || '{}');
    const { _coinStats, _coinProfiles, ...adaptiveParams } = parsedParams;
    return {
      generation: row.generation,
      totalMistakesAnalyzed: row.mistakes,
      totalWinsReinforced: row.wins,
      totalAdjustments: row.adjustments,
      adaptiveParams,
      coinProfiles: _coinProfiles || _coinStats || {},
      learningLogs: JSON.parse(row.logs_json || '[]')
    };
  }

  saveBrainState(brainState) {
    const payloadParams = {
      ...(brainState.adaptiveParams || DEFAULT_BRAIN_PARAMS),
      _coinProfiles: brainState.coinProfiles || brainState.coinStats || {}
    };
    db.prepare(`UPDATE brain SET generation=?, mistakes=?, wins=?, adjustments=?, params_json=?, logs_json=?, updated_at=strftime('%s','now') WHERE id=1`)
      .run(
        brainState.generation ?? 1,
        brainState.totalMistakesAnalyzed ?? 0,
        brainState.totalWinsReinforced ?? 0,
        brainState.totalAdjustments ?? 0,
        JSON.stringify(payloadParams),
        JSON.stringify((brainState.learningLogs || []).slice(0, 100))
      );
  }

  // ── Trade Recording ───────────────────────────────────────────────────────
  recordClosedTrade(trade) {
    if (!trade || !trade.id) return;
    const ts = trade.closedTimestamp || Date.now();
    const d = new Date(ts);
    const dateKey  = d.toISOString().split('T')[0];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const yearKey  = `${d.getFullYear()}`;
    const pnl = parseFloat((trade.pnlUsdt || 0).toFixed(2));

    const tx = db.transaction(() => {
      // Insert into trade_history
      db.prepare(`
        INSERT OR REPLACE INTO trade_history
          (id,symbol,side,entry_price,exit_price,leverage,margin,pnl_usdt,roe_percent,
           reason,opened_at,closed_at,opened_ts,closed_ts,date_key,month_key,year_key,candle_time,extra_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          trade.id, trade.symbol||'BTC/USDT', trade.side,
          trade.entryPrice, trade.exitPrice,
          trade.leverage||10, trade.margin||1000,
          pnl, parseFloat((trade.roePercent||0).toFixed(2)),
          trade.reason||'', trade.openedAt||'', trade.closedAt||'',
          trade.openedTimestamp||ts, ts,
          dateKey, monthKey, yearKey,
          trade.candleTime||null, '{}'
        );

      // Update aggregates
      _updateAggregates(dateKey, monthKey, yearKey, pnl);
    });
    tx();

    console.log(`💾 [DB] Trade saved: ${trade.side} ${pnl >= 0 ? '+' : ''}$${pnl} | Total trades: ${db.prepare('SELECT COUNT(*) as c FROM trade_history').get().c}`);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  getAnalytics() {
    const history = db.prepare('SELECT * FROM trade_history ORDER BY closed_ts DESC LIMIT 300').all()
      .map(t => ({
        id: t.id, symbol: t.symbol, side: t.side,
        entryPrice: t.entry_price, exitPrice: t.exit_price,
        leverage: t.leverage, margin: t.margin,
        pnlUsdt: t.pnl_usdt, roePercent: t.roe_percent,
        reason: t.reason, openedAt: t.opened_at, closedAt: t.closed_at,
        openedTimestamp: t.opened_ts, closedTimestamp: t.closed_ts,
        date: t.date_key, candleTime: t.candle_time
      }));

    const daily = db.prepare('SELECT * FROM daily_stats ORDER BY date_key DESC').all()
      .map(r => ({
        period: r.date_key, tradesCount: r.trades_count,
        winCount: r.win_count, lossCount: r.loss_count,
        totalPnlUsdt: parseFloat(r.total_pnl.toFixed(2)), winRate: r.win_rate
      }));

    const monthly = db.prepare('SELECT * FROM monthly_stats ORDER BY month_key DESC').all()
      .map(r => ({
        period: r.month_key, tradesCount: r.trades_count,
        winCount: r.win_count, lossCount: r.loss_count,
        totalPnlUsdt: parseFloat(r.total_pnl.toFixed(2)), winRate: r.win_rate
      }));

    const yearly = db.prepare('SELECT * FROM yearly_stats ORDER BY year_key DESC').all()
      .map(r => ({
        period: r.year_key, tradesCount: r.trades_count,
        winCount: r.win_count, lossCount: r.loss_count,
        totalPnlUsdt: parseFloat(r.total_pnl.toFixed(2)), winRate: r.win_rate
      }));

    const acc = db.prepare('SELECT * FROM account WHERE id = 1').get() || { initial_balance: 100, balance: 100 };
    return {
      initialBalance: acc.initial_balance,
      balance: acc.balance,
      history,
      daily,
      monthly,
      yearly
    };
  }

  // ── Account Reset ─────────────────────────────────────────────────────────
  resetAccount(initialBalance = 100, marginPerTrade = 10) {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE account SET balance=?, initial_balance=?, margin_per_trade=?, updated_at=strftime('%s','now') WHERE id=1`)
        .run(initialBalance, initialBalance, marginPerTrade);
      db.prepare('DELETE FROM positions').run();
      db.prepare('DELETE FROM trade_history').run();
      db.prepare('DELETE FROM daily_stats').run();
      db.prepare('DELETE FROM monthly_stats').run();
      db.prepare('DELETE FROM yearly_stats').run();
    });
    tx();
    console.log(`🔄 [DB] Account reset complete: Initial Balance $${initialBalance}, Margin $${marginPerTrade}`);
  }

  // ── Bot Configuration Settings ───────────────────────────────────────────
  getSetting(key, defaultValue = '') {
    try {
      const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key);
      return row ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setSetting(key, value) {
    try {
      db.prepare(`INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)`).run(key, String(value));
      return true;
    } catch (err) {
      console.warn('Failed to setSetting:', err);
      return false;
    }
  }

  // ── Delete SUI Trades (Error/Loss or All) ──────────────────────────────────
  deleteSuiTrades({ all = false } = {}) {
    let deleted = [];
    const tx = db.transaction(() => {
      const condition = all 
        ? "symbol LIKE '%SUI%'" 
        : "symbol LIKE '%SUI%' AND (pnl_usdt < 0 OR reason LIKE '%Cắt lỗ%' OR reason LIKE '%SL%')";
      
      deleted = db.prepare(`SELECT id, symbol, side, pnl_usdt, roe_percent, reason, closed_at FROM trade_history WHERE ${condition}`).all();
      
      db.prepare(`DELETE FROM trade_history WHERE ${condition}`).run();

      // Clean up brain logs related to SUI mistakes
      try {
        const brainRow = db.prepare("SELECT * FROM brain WHERE id=1").get();
        if (brainRow && brainRow.logs_json) {
          const logs = JSON.parse(brainRow.logs_json || '[]');
          const filteredLogs = logs.filter(l => !(
            (l.title && l.title.includes('SUI')) ||
            (l.symbol && l.symbol.includes('SUI')) ||
            (l.reason && l.reason.includes('SUI')) ||
            (l.actionTaken && l.actionTaken.includes('SUI'))
          ));
          db.prepare("UPDATE brain SET logs_json=? WHERE id=1").run(JSON.stringify(filteredLogs));
        }
      } catch (e) {
        console.warn('Could not filter brain logs:', e.message);
      }

      rebuildAggregates();
    });
    tx();
    return { count: deleted.length, deleted };
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────
  getDiagnostics() {
    return {
      dbPath: DB_PATH,
      trades: db.prepare('SELECT COUNT(*) as c FROM trade_history').get().c,
      positions: db.prepare('SELECT COUNT(*) as c FROM positions').get().c,
      dailyRows: db.prepare('SELECT COUNT(*) as c FROM daily_stats').get().c,
    };
  }
}

export { db as sqliteDb };
export const serverDb = new ServerDatabase();
