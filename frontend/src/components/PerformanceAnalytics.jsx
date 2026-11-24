import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Calendar, Layers, Clock, Download, RotateCcw,
  Database, Server, Wifi, WifiOff
} from 'lucide-react';
import { dbService } from '../services/dbService';

const _isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_BASE = _isLocalhost
  ? 'http://localhost:5001'
  : `${window.location.protocol}//${window.location.host}`;


function buildReportFromServer(analytics) {
  const trades = (analytics.history || []);
  const initialBalance = Number(analytics?.initialBalance) || 100;
  let totalPnl = 0, totalWins = 0, totalLosses = 0;
  let grossProfit = 0, grossLoss = 0;
  let runningEquity = initialBalance;
  const equityCurve = [];

  const chrono = [...trades].sort((a, b) => (a.closedTimestamp || 0) - (b.closedTimestamp || 0));
  chrono.forEach((t) => {
    const pnl = Number(t.pnlUsdt) || 0;
    totalPnl += pnl;
    runningEquity += pnl;
    equityCurve.push({ time: t.closedTimestamp, date: t.date || '', pnl, equity: parseFloat(runningEquity.toFixed(2)) });
    if (pnl >= 0) { totalWins++; grossProfit += pnl; }
    else { totalLosses++; grossLoss += Math.abs(pnl); }
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? parseFloat(((totalWins / totalTrades) * 100).toFixed(1)) : 0;
  const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.9 : 1.0);
  const avgWin = totalWins > 0 ? parseFloat((grossProfit / totalWins).toFixed(2)) : 0;

  let peakEquity = initialBalance, maxDrawdownPct = 0;
  equityCurve.forEach(pt => {
    if (pt.equity > peakEquity) peakEquity = pt.equity;
    const dd = ((peakEquity - pt.equity) / peakEquity) * 100;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  });

  const dailyList = (analytics.daily || []).map(d => ({
    date: d.period, trades: d.tradesCount, wins: d.winCount,
    losses: d.lossCount, pnl: d.totalPnlUsdt, winRate: Math.round(d.winRate)
  }));
  const monthlyList = (analytics.monthly || []).map(m => ({
    month: m.period, trades: m.tradesCount, wins: m.winCount,
    losses: m.lossCount, pnl: m.totalPnlUsdt, winRate: Math.round(m.winRate)
  }));
  const yearlyList = (analytics.yearly || []).map(y => ({
    year: y.period, trades: y.tradesCount, wins: y.winCount,
    losses: y.lossCount, pnl: y.totalPnlUsdt, winRate: Math.round(y.winRate)
  }));

  return {
    initialBalance,
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalRoi: parseFloat(((totalPnl / initialBalance) * 100).toFixed(2)),
    currentEquity: parseFloat((initialBalance + totalPnl).toFixed(2)),
    totalTrades, totalWins, totalLosses, winRate, profitFactor, avgWin,
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    equityCurve, dailyList, monthlyList, yearlyList,
    recentTrades: [...trades].reverse().slice(0, 50)
  };
}

export default function PerformanceAnalytics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('daily');
  const [dataSource, setDataSource] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const analytics = await res.json();
      setReport(buildReportFromServer(analytics));
      setDataSource('server');
    } catch {
      try {
        const data = await dbService.getPerformanceReport();
        setReport(data);
        setDataSource('indexeddb');
      } catch {
        setReport(buildReportFromServer({ history: [], daily: [], monthly: [], yearly: [] }));
        setDataSource('empty');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExportJSON = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics`, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ktautotrading_performance_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      await dbService.exportJSON();
    }
  };

  if (loading || !report) {
    return (
      <div className="analytics-loading-box">
        <div className="spinner" />
        <span>Đang tải dữ liệu giao dịch thực từ server Pi 5...</span>
      </div>
    );
  }

  const isNetProfit = report.totalPnl >= 0;
  const isServer = dataSource === 'server';
  const initialBalance = report.initialBalance || 100;
  const minEq = Math.min(...report.equityCurve.map(p => p.equity), initialBalance) - 20;
  const maxEq = Math.max(...report.equityCurve.map(p => p.equity), initialBalance) + 20;
  const eqRange = Math.max(maxEq - minEq, 20);
  const toY = (eq) => 140 - Math.min(120, Math.max(10, ((eq - minEq) / eqRange) * 130));

  return (
    <div className="analytics-wrapper">
      <div className="analytics-header">
        <div className="flex-align gap-3">
          <div className="analytics-icon-badge">
            <BarChart3 size={20} className="text-cyan" />
          </div>
          <div>
            <div className="analytics-title flex-align gap-2">
              <span>Đánh Giá Hiệu Suất Bot AI</span>
              <span className={`db-badge ${isServer ? 'db-badge-server' : ''}`}>
                {isServer ? <Server size={10} /> : <Database size={10} />}
                <span>{isServer ? 'Pi 5 Live DB' : 'IndexedDB Local'}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="analytics-actions">
          <button className="btn-db-action" onClick={handleExportJSON}>
            <Download size={13} /><span>Xuất JSON</span>
          </button>
          <button className="btn-db-action" onClick={loadData}>
            <RotateCcw size={13} /><span>Làm Mới</span>
          </button>
        </div>
      </div>

      <div className={`analytics-source-banner ${isServer ? 'banner-live' : 'banner-offline'}`}>
        {isServer
          ? <><Wifi size={12} /> <span>Dữ liệu thực từ <strong>Raspberry Pi 5</strong> — Bot đã khớp <strong>{report.totalTrades} lệnh</strong></span></>
          : <><WifiOff size={12} /> <span>Server offline — Hiển thị dữ liệu cục bộ ({report.totalTrades} lệnh)</span></>
        }
      </div>

      <div className="analytics-kpi-grid">
        <div className={`kpi-card ${isNetProfit ? 'kpi-profit' : 'kpi-loss'}`}>
          <div className="kpi-label">Tổng Lợi Nhuận Ròng</div>
          <div className="kpi-value font-mono flex-align gap-1">
            {isNetProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{isNetProfit ? '+' : ''}${report.totalPnl.toLocaleString()} USDT</span>
          </div>
          <div className="kpi-sub">
            ROI: <strong className={isNetProfit ? 'text-green' : 'text-red'}>{isNetProfit ? '+' : ''}{report.totalRoi}%</strong>
            &nbsp;| Vốn hiện tại: <strong className="text-cyan font-mono">${report.currentEquity.toLocaleString()}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tỷ Lệ Thắng</div>
          <div className="kpi-value font-mono text-cyan">{report.winRate}%</div>
          <div className="kpi-sub">
            <span className="text-green">{report.totalWins}W</span> / <span className="text-red">{report.totalLosses}L</span>
            &nbsp;({report.totalTrades} lệnh)
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Profit Factor</div>
          <div className="kpi-value font-mono text-amber">{report.profitFactor}x</div>
          <div className="kpi-sub">TB Thắng: <strong className="text-green">+${report.avgWin}</strong></div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Max Drawdown</div>
          <div className="kpi-value font-mono text-purple">{report.maxDrawdownPct}%</div>
          <div className="kpi-sub">Mục tiêu an toàn &lt;10%</div>
        </div>
      </div>

      <div className="analytics-chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title flex-align gap-2">
            <TrendingUp size={14} className="text-cyan" />
            <span>Đường Cong Tăng Trưởng Vốn</span>
          </div>
          <span className="chart-card-badge font-mono">
            ${report.initialBalance || 100} → ${report.currentEquity.toLocaleString()} USDT
          </span>
        </div>
        <div className="equity-chart-container">
          {report.equityCurve.length < 2 ? (
            <div className="equity-empty-state">
              <DollarSign size={28} className="text-muted" />
              <span>Chưa có lệnh nào được đóng. Biểu đồ sẽ hiển thị khi bot chốt lệnh đầu tiên.</span>
            </div>
          ) : (
            <svg className="equity-svg" viewBox="0 0 800 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isNetProfit ? '#06b6d4' : '#f43f5e'} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={isNetProfit ? '#06b6d4' : '#f43f5e'} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line x1="0" y1={toY(report.initialBalance || 100)} x2="800" y2={toY(report.initialBalance || 100)} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 3" />
              <polygon
                points={`0,150 ${report.equityCurve.map((pt, i) => `${(i / (report.equityCurve.length - 1)) * 800},${toY(pt.equity)}`).join(' ')} 800,150`}
                fill="url(#equityGrad)"
              />
              <polyline
                points={report.equityCurve.map((pt, i) => `${(i / (report.equityCurve.length - 1)) * 800},${toY(pt.equity)}`).join(' ')}
                fill="none" stroke={isNetProfit ? '#06b6d4' : '#f43f5e'} strokeWidth="2.5" strokeLinecap="round"
              />
              {report.equityCurve.map((pt, i) => (
                <circle key={i}
                  cx={(i / (report.equityCurve.length - 1)) * 800} cy={toY(pt.equity)}
                  r="3.5" fill={pt.pnl >= 0 ? '#22c55e' : '#f43f5e'} stroke="#fff" strokeWidth="1.5"
                />
              ))}
            </svg>
          )}
        </div>
      </div>

      <div className="analytics-tabs-bar">
        <div className="tab-pills-group">
          {[
            { key: 'daily', label: 'Theo Ngày', Icon: Calendar, count: report.dailyList.length },
            { key: 'monthly', label: 'Theo Tháng', Icon: Calendar, count: report.monthlyList.length },
            { key: 'yearly', label: 'Theo Năm', Icon: Layers, count: report.yearlyList.length },
            { key: 'trades', label: 'Chi Tiết Lệnh', Icon: Clock, count: report.totalTrades }
          ].map(({ key, label, Icon, count }) => (
            <button key={key} className={`tab-pill-btn ${viewMode === key ? 'active' : ''}`} onClick={() => setViewMode(key)}>
              <Icon size={12} /><span>{label}</span><span className="count-pill">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-table-container">
        {viewMode === 'daily' && (
          <AnalyticsTable rows={report.dailyList} keyField="date" labelHeader="Ngày"
            renderLabel={(r) => <><Calendar size={11} className="text-muted" /><span>{r.date}</span></>}
            emptyMsg="Chưa có dữ liệu ngày nào" />
        )}
        {viewMode === 'monthly' && (
          <AnalyticsTable rows={report.monthlyList} keyField="month" labelHeader="Tháng"
            renderLabel={(r) => <><Calendar size={11} /><span>Tháng {r.month}</span></>}
            emptyMsg="Chưa có dữ liệu tháng nào" />
        )}
        {viewMode === 'yearly' && (
          <AnalyticsTable rows={report.yearlyList} keyField="year" labelHeader="Năm"
            renderLabel={(r) => <><Layers size={11} /><span>Năm {r.year}</span></>}
            emptyMsg="Chưa có dữ liệu năm nào" />
        )}
        {viewMode === 'trades' && (
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Thời Gian</th><th>Vị Thế</th><th>Giá Vào</th>
                <th>Giá Ra</th><th>ROE %</th><th className="text-right">P&L (USDT)</th>
              </tr>
            </thead>
            <tbody>
              {report.recentTrades.length === 0 ? (
                <tr><td colSpan="6" className="text-center text-muted py-4">Chưa có lệnh nào được đóng. Bot đang chờ tín hiệu...</td></tr>
              ) : (
                report.recentTrades.map((t, i) => {
                  const isPos = (t.pnlUsdt || 0) >= 0;
                  return (
                    <tr key={t.id || i}>
                      <td className="font-mono text-muted" style={{ fontSize: '11px' }}>{t.date || ''} {t.closedAt || ''}</td>
                      <td><span className={`side-badge ${t.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>{t.side} {t.leverage}x</span></td>
                      <td className="font-mono">${Number(t.entryPrice || 0).toLocaleString()}</td>
                      <td className="font-mono">${Number(t.exitPrice || 0).toLocaleString()}</td>
                      <td><span className={`font-mono font-bold ${isPos ? 'text-green' : 'text-red'}`}>{isPos ? '+' : ''}{t.roePercent}%</span></td>
                      <td className={`text-right font-mono font-bold ${isPos ? 'text-green' : 'text-red'}`}>{isPos ? '+' : ''}${Number(t.pnlUsdt || 0).toFixed(2)} USDT</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="analytics-footer-status">
        <div className="flex-align gap-2">
          {isServer ? <Server size={12} className="text-cyan" /> : <Database size={12} className="text-cyan" />}
          <span className="text-muted">Nguồn dữ liệu:</span>
          <span className={`font-mono ${isServer ? 'text-green' : 'text-amber'}`}>
            {isServer ? `${API_BASE} → server/data/state.json (Lưu trữ bền vững)` : 'IndexedDB (Browser local)'}
          </span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTable({ rows, keyField, labelHeader, renderLabel, emptyMsg }) {
  return (
    <table className="analytics-table">
      <thead>
        <tr>
          <th>{labelHeader}</th><th>Số Lệnh</th><th>Thắng / Thua</th>
          <th>Win Rate</th><th className="text-right">P&L (USDT)</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan="5" className="text-center text-muted py-4">{emptyMsg}</td></tr>
        ) : (
          rows.map((row) => {
            const isPos = row.pnl >= 0;
            return (
              <tr key={row[keyField]}>
                <td className="font-mono font-bold text-white flex-align gap-2">{renderLabel(row)}</td>
                <td>{row.trades} lệnh</td>
                <td><span className="text-green font-bold">{row.wins}W</span>{' / '}<span className="text-red font-bold">{row.losses}L</span></td>
                <td><span className="badge-winrate font-mono">{row.winRate}%</span></td>
                <td className={`text-right font-mono font-bold ${isPos ? 'text-green' : 'text-red'}`}>{isPos ? '+' : ''}${row.pnl.toLocaleString()} USDT</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
