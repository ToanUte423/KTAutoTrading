import { sqliteDb } from '../backend/server/database.js';

const tradesToRestore = [
  { id: 'pos-1790572375873-ds78', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2178, exit_price: 1.2331, pnl_usdt: -1.89, roe_percent: -18.85, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572375873 },
  { id: 'pos-1790572405873-i8rx', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2116, exit_price: 1.2298, pnl_usdt: -1.95, roe_percent: -19.53, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572405873 },
  { id: 'pos-1790572435872-6o5w', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2102, exit_price: 1.2284, pnl_usdt: -1.96, roe_percent: -19.55, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572435872 },
  { id: 'pos-1790572465872-y34d', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2070, exit_price: 1.2251, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572465872 },
  { id: 'pos-1790572495873-upas', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2106, exit_price: 1.2288, pnl_usdt: -1.95, roe_percent: -19.54, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572495873 },
  { id: 'pos-1790572525882-j9v2', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2119, exit_price: 1.2301, pnl_usdt: -1.95, roe_percent: -19.52, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572525882 },
  { id: 'pos-1790572555873-0uov', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2116, exit_price: 1.2298, pnl_usdt: -1.95, roe_percent: -19.53, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572555873 },
  { id: 'pos-1790572585878-ahbx', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2074, exit_price: 1.2255, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572585878 },
  { id: 'pos-1790572615879-4gov', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2082, exit_price: 1.2263, pnl_usdt: -1.95, roe_percent: -19.48, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572615879 },
  { id: 'pos-1790572645875-kpgy', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2133, exit_price: 1.2315, pnl_usdt: -1.95, roe_percent: -19.50, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572645875 },
  { id: 'pos-1790572675880-2uha', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2134, exit_price: 1.2316, pnl_usdt: -1.95, roe_percent: -19.50, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572675880 },
  { id: 'pos-1790572705878-19x7', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2130, exit_price: 1.2312, pnl_usdt: -1.95, roe_percent: -19.51, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572705878 },
  { id: 'pos-1790572735875-ze4l', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2138, exit_price: 1.2320, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572735875 },
  { id: 'pos-1790572765880-h6ib', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2150, exit_price: 1.2332, pnl_usdt: -1.95, roe_percent: -19.47, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572765880 },
  { id: 'pos-1790572795877-x2ee', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2137, exit_price: 1.2319, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572795877 },
  { id: 'pos-1790572825879-8cdb', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2125, exit_price: 1.2307, pnl_usdt: -1.95, roe_percent: -19.51, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572825879 },
  { id: 'pos-1790572855877-zmoy', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2133, exit_price: 1.2315, pnl_usdt: -1.95, roe_percent: -19.50, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572855877 },
  { id: 'pos-1790572885877-em3k', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2117, exit_price: 1.2299, pnl_usdt: -1.95, roe_percent: -19.53, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572885877 },
  { id: 'pos-1790572915877-9acu', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2140, exit_price: 1.2322, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572915877 },
  { id: 'pos-1790572945882-emy2', symbol: 'SUI/USDT', side: 'SHORT', entry_price: 1.2137, exit_price: 1.2319, pnl_usdt: -1.95, roe_percent: -19.49, reason: '🛑 Cắt lỗ (SL Hit)', ts: 1790572945882 }
];

const insertTrade = sqliteDb.prepare(`INSERT OR REPLACE INTO trade_history 
  (id, symbol, side, entry_price, exit_price, leverage, margin, pnl_usdt, roe_percent,
   reason, opened_at, closed_at, opened_ts, closed_ts, date_key, month_key, year_key,
   candle_time, extra_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

for (const t of tradesToRestore) {
  const d = new Date(t.ts);
  const dk = d.toISOString().split('T')[0];
  const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const yk = `${d.getFullYear()}`;
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  insertTrade.run(
    t.id, t.symbol, t.side, t.entry_price, t.exit_price,
    10, 10, t.pnl_usdt, t.roe_percent,
    t.reason, timeStr, timeStr,
    t.ts - 30000, t.ts, dk, mk, yk,
    Math.floor(t.ts / 1000), '{}'
  );
}

// Recalculate true account balance
const allTrades = sqliteDb.prepare('SELECT pnl_usdt FROM trade_history').all();
const netPnl = allTrades.reduce((acc, t) => acc + t.pnl_usdt, 0);
const trueBalance = parseFloat((100 + netPnl).toFixed(2));
sqliteDb.prepare('UPDATE account SET balance = ? WHERE id = 1').run(trueBalance);

// Rebuild daily/monthly/yearly aggregates
sqliteDb.prepare('DELETE FROM daily_stats').run();
sqliteDb.prepare('DELETE FROM monthly_stats').run();
sqliteDb.prepare('DELETE FROM yearly_stats').run();

const fullHistory = sqliteDb.prepare('SELECT * FROM trade_history ORDER BY closed_ts ASC').all();
for (const t of fullHistory) {
  const isWin = t.pnl_usdt >= 0 ? 1 : 0;
  const d = sqliteDb.prepare('SELECT * FROM daily_stats WHERE date_key=?').get(t.date_key);
  if (!d) {
    sqliteDb.prepare('INSERT INTO daily_stats (date_key,year_key,month_key,trades_count,win_count,loss_count,total_pnl,win_rate) VALUES (?,?,?,1,?,?,?,?)')
      .run(t.date_key, t.year_key, t.month_key, isWin, 1-isWin, t.pnl_usdt, isWin*100);
  } else {
    const tc = d.trades_count + 1;
    const wc = d.win_count + isWin;
    sqliteDb.prepare('UPDATE daily_stats SET trades_count=?,win_count=?,loss_count=?,total_pnl=?,win_rate=? WHERE date_key=?')
      .run(tc, wc, d.loss_count + (1-isWin), parseFloat((d.total_pnl + t.pnl_usdt).toFixed(2)), parseFloat(((wc/tc)*100).toFixed(1)), t.date_key);
  }
}

const winCount = fullHistory.filter(t => t.pnl_usdt >= 0).length;
const lossCount = fullHistory.filter(t => t.pnl_usdt < 0).length;
sqliteDb.prepare('UPDATE brain SET generation = 24, mistakes = ?, wins = ?, adjustments = ? WHERE id = 1').run(lossCount, winCount, lossCount + winCount);

console.log('Restored all 20 historical SL trades. Total trades:', fullHistory.length, 'Wins:', winCount, 'Losses:', lossCount, 'True Balance: $' + trueBalance);
