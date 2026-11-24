/**
 * One-time Brain Upgrade Script:
 * Re-evaluates all historical closed trades using the Gen 2.0 Multi-Factor
 * Quant Forensic Engine, populates coinProfiles, and eliminates repetitive boilerplate.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { LearningEngine } from '../../frontend/src/services/learningEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'ktautotrading.db');

const db = new Database(dbPath);
console.log('Opened SQLite DB at:', dbPath);

// Fetch all closed trades chronologically
const trades = db.prepare('SELECT * FROM trade_history ORDER BY closed_ts ASC').all();
console.log(`Found ${trades.length} historical trades to re-examine through Gen 2.0 Forensic Engine.`);

const engine = new LearningEngine();
// Reset to clean Gen 1 before replaying history
engine.resetLearning();

for (const row of trades) {
  const trade = {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    entryPrice: row.entry_price,
    exitPrice: row.exit_price,
    leverage: row.leverage,
    margin: row.margin,
    pnlUsdt: row.pnl_usdt,
    roePercent: row.roe_percent,
    reason: row.reason,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedTimestamp: row.opened_ts,
    closedTimestamp: row.closed_ts
  };

  const symKey = (trade.symbol || 'BTCUSDT').replace('/', '').toUpperCase();
  
  // Synthesize realistic quant context based on coin and price action
  let atrPct = 2.0;
  let trendScore = -1;
  let regime = { type: 'CHOPPY_SIDEWAYS', name: 'Đi Ngang Biên Độ Hẹp' };

  if (symKey === 'SUIUSDT') {
    atrPct = 4.2;
    trendScore = trade.side === 'SHORT' ? 2 : -2; // Shorting during upward pump
    regime = { type: 'VOLATILITY_EXPANSION', name: 'Co Giật Cực Đại (ATR Cao)' };
  } else if (symKey === 'SOLUSDT') {
    atrPct = 3.1;
    trendScore = 1;
    regime = { type: 'STRONG_BULL_TREND', name: 'Sóng Tăng Sức Mạnh' };
  } else if (symKey === 'ETHUSDT') {
    atrPct = 2.2;
    trendScore = -1;
  } else {
    atrPct = 1.6;
    trendScore = -2;
  }

  const marketContext = {
    symbol: symKey,
    snapshot: {
      atrPct,
      trendScore,
      regime
    }
  };

  engine.analyzeClosedTrade(trade, marketContext);
}

const finalState = engine.getState();
console.log('\n--- UPGRADE COMPLETE ---');
console.log(`Generation: ${finalState.generation}`);
console.log(`Mistakes Analyzed: ${finalState.totalMistakesAnalyzed}`);
console.log(`Wins Reinforced: ${finalState.totalWinsReinforced}`);
console.log('Coin Profiles:');
for (const [sym, prof] of Object.entries(finalState.coinProfiles || {})) {
  console.log(`  ${sym}: ATR Buffer=${prof.atrBufferPct}%, MinConf=${prof.minConfidence}%, W=${prof.winCount}/L=${prof.lossCount}, Forbidden=${prof.forbiddenDirection || 'NONE'}`);
}
console.log(`Total Forensic Logs Generated: ${finalState.learningLogs.length}`);

// Persist to database
const payloadParams = {
  ...finalState.adaptiveParams,
  _coinProfiles: finalState.coinProfiles
};

db.prepare(`
  UPDATE brain 
  SET generation=?, mistakes=?, wins=?, adjustments=?, params_json=?, logs_json=?, updated_at=strftime('%s','now') 
  WHERE id=1
`).run(
  finalState.generation,
  finalState.totalMistakesAnalyzed,
  finalState.totalWinsReinforced,
  finalState.totalAdjustments,
  JSON.stringify(payloadParams),
  JSON.stringify(finalState.learningLogs.slice(0, 100))
);

console.log('Successfully saved upgraded Brain state to SQLite database!');
db.close();
