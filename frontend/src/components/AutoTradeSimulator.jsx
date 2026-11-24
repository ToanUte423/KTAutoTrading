import { 
  Bot, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Flame, 
  RotateCcw, 
  XCircle, 
  ShieldAlert, 
  Crosshair, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  History,
  CheckCircle,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import CoinIcon from './CoinIcon';

export default function AutoTradeSimulator({
  simulatorState,
  accountSummary,
  currentPrice,
  multiTickers = {},
  selectedSymbol = 'BTCUSDT',
  onToggleAutoTrade,
  onResetAccount,
  onClosePosition
}) {
  const { positions, history, leverage, marginPerTrade, isAutoTradeActive } = simulatorState;
  const { equity, balance, unrealizedPnl, realizedPnl, winRate, totalTrades, winTrades, lossTrades, roiPercent } = accountSummary;

  const isNetPositive = (unrealizedPnl || 0) >= 0;
  const isRoiPositive = (roiPercent || 0) >= 0;

  return (
    <div className="autotrade-wrapper">

      {/* Account Performance Overview Cards */}
      <div className="autotrade-account-cards">
        {/* Equity Card */}
        <div className="acc-card">
          <span className="acc-card-label">Tổng Tài Sản (Equity)</span>
          <div className="acc-card-val font-mono">
            ${equity?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className={`acc-card-sub font-mono ${isRoiPositive ? 'text-green' : 'text-red'}`}>
            {isRoiPositive ? '+' : ''}{roiPercent}% ROI
          </span>
        </div>

        {/* Unrealized PnL Card */}
        <div className="acc-card">
          <span className="acc-card-label">P&L Chưa Chốt</span>
          <div className={`acc-card-val font-mono ${isNetPositive ? 'text-green' : 'text-red'}`}>
            {isNetPositive ? '+' : ''}${unrealizedPnl?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="acc-card-sub text-muted">
            {positions.length} vị thế đang mở
          </span>
        </div>

        {/* Win Rate Card */}
        <div className="acc-card">
          <span className="acc-card-label">Tỷ Lệ Thắng (Win Rate)</span>
          <div className="acc-card-val font-mono text-cyan">
            {winRate}%
          </div>
          <span className="acc-card-sub text-muted">
            {winTrades} Thắng / {lossTrades} Thua
          </span>
        </div>
      </div>


      {/* Main Content Area: Open Positions + Trade History */}
      <div className="autotrade-scroll-area">
        <div className="section-title-bar">
          <div className="flex-align gap-2">
            <span className="section-title">Vị Thế Đang Mở ({positions.length})</span>
          </div>
          {onResetAccount && (
            <button 
              className="btn-icon-subtle" 
              onClick={onResetAccount}
              title="Khôi phục số dư $100 USDT ban đầu"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {positions.length === 0 ? (
          <div className="no-positions-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00e5ff' }}>
              <Bot size={20} className="animate-pulse" />
              <span style={{ fontWeight: 600, fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Hệ Thống AI Bot 24/7 Đang Giám Sát Đa Coin (BTC, ETH, SOL, SUI)
              </span>
            </div>
            <span>Chưa có vị thế mở. Bot đang quét tín hiệu tại Vùng Hỗ Trợ / Kháng Cự khung lớn để vào lệnh tự động...</span>
          </div>
        ) : (
          positions.map((pos) => {
            const isLong = pos.side === 'LONG';
            const sym = pos.symbol || 'BTC/USDT';
            const cleanSym = sym.replace('/', '').toUpperCase();
            const tickerForSym = multiTickers?.[cleanSym];
            const isCurrentSelectedCoin = cleanSym === (selectedSymbol || '').replace('/', '').toUpperCase();
            const livePriceForPos = tickerForSym?.lastPrice || (isCurrentSelectedCoin ? currentPrice : null) || pos.currentPrice || pos.entryPrice;

            let curPrice = pos.currentPrice || livePriceForPos;
            let roe = pos.roePercent;
            let pnl = pos.unrealizedPnl;

            // If pos doesn't have live roe or price has updated from multiTickers, calculate dynamically
            if (livePriceForPos && pos.entryPrice) {
              curPrice = livePriceForPos;
              const diffRatio = isLong
                ? (livePriceForPos - pos.entryPrice) / pos.entryPrice
                : (pos.entryPrice - livePriceForPos) / pos.entryPrice;
              roe = parseFloat((diffRatio * pos.leverage * 100).toFixed(2));
              pnl = parseFloat((pos.margin * (roe / 100)).toFixed(2));
            }

            const isProfit = (pnl || 0) >= 0;
            const isSubTen = pos.entryPrice < 10 || sym.includes('SUI');
            const dec = isSubTen ? 4 : 2;
            const fmt = (p) => p !== undefined && p !== null ? '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '---';

            return (
              <div 
                key={pos.id} 
                className={`position-card ${isLong ? 'pos-long' : 'pos-short'}`}
              >
                <div className="pos-header">
                  <div className="pos-badge-group">
                    <span className={`side-badge ${isLong ? 'badge-long' : 'badge-short'}`}>
                      {pos.side} {pos.leverage}x
                    </span>
                    <span className="pos-symbol font-semibold text-white flex-align" style={{ gap: '4px' }}>
                      <CoinIcon symbol={sym} size={13} />
                      <span>{sym}</span>
                    </span>
                    <span className="pos-time font-mono">{pos.openedAt}</span>
                  </div>

                  <div className="flex-align gap-2">
                    {pos.trailingActive && (
                      <span className="pos-trailing-badge animate-pulse">
                        🚀 Trailing Khóa Lãi
                      </span>
                    )}
                    {pos.isBreakEvenSet && !pos.trailingActive && (
                      <span className="pos-breakeven-badge">
                        🛡️ Đã Khóa Hòa Vốn
                      </span>
                    )}
                  </div>
                </div>

                {/* Big ROE% Readout */}
                <div className="pos-pnl-banner">
                  <div className="pnl-main">
                    <span className="pnl-label">Lợi Nhuận (ROE%):</span>
                    <span className={`pnl-roe font-mono ${isProfit ? 'text-green' : 'text-red'}`}>
                      {isProfit ? '+' : ''}{roe ?? 0}%
                    </span>
                  </div>
                  <div className={`pnl-amount font-mono ${isProfit ? 'text-green' : 'text-red'}`}>
                    {isProfit ? '+' : ''}${pnl ?? 0} USDT
                  </div>
                </div>

                {/* Position Details Grid */}
                <div className="pos-details-grid font-mono">
                  <div className="detail-item">
                    <span className="d-label">Giá vào (Entry):</span>
                    <span className="d-val">{fmt(pos.entryPrice)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="d-label">Giá hiện tại:</span>
                    <span className="d-val text-cyan">{fmt(curPrice)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="d-label">Chốt lời (TP):</span>
                    <span className="d-val text-green">{fmt(pos.takeProfit)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="d-label">Cắt lỗ (SL):</span>
                    <span className="d-val text-red">{fmt(pos.stopLoss)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="d-label">Ký quỹ (Margin):</span>
                    <span className="d-val">${pos.margin?.toLocaleString()} USDT</span>
                  </div>
                  <div className="detail-item">
                    <span className="d-label">Thanh lý (Liq):</span>
                    <span className="d-val text-amber">{fmt(pos.liqPrice)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Section 2: Trade History & Profit Reporting */}
        <div className="section-title-bar mt-4">
          <span className="section-title">Lịch Sử Lệnh Đã Đóng ({history.length})</span>
        </div>

        {history.length === 0 ? (
          <div className="no-positions-box">
            <History size={20} className="text-muted" />
            <span>Chưa có lệnh nào được chốt. Khi lệnh chạm Take Profit hoặc Stop Loss, báo cáo chi tiết sẽ hiển thị tại đây.</span>
          </div>
        ) : (
          history.map((trade, idx) => {
            const isProfit = trade.pnlUsdt >= 0;
            const sym = trade.symbol || 'BTC/USDT';
            const isSubTen = trade.entryPrice < 10 || sym.includes('SUI');
            const dec = isSubTen ? 4 : 2;
            const fmt = (p) => p !== undefined && p !== null ? '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '---';

            return (
              <div 
                key={trade.id || idx} 
                className={`history-trade-card ${isProfit ? 'hist-win' : 'hist-loss'}`}
              >
                <div className="hist-top">
                  <div className="flex-align gap-2">
                    <span className={`side-badge-mini ${trade.side === 'LONG' ? 'badge-long' : 'badge-short'}`}>
                      {trade.side} {trade.leverage}x
                    </span>
                    <span className="font-semibold text-white font-mono flex-align" style={{ fontSize: '12px', gap: '4px' }}>
                      <CoinIcon symbol={sym} size={13} />
                      <span>{sym}</span>
                    </span>
                    <span className="hist-reason">{trade.reason}</span>
                  </div>

                  <div className="hist-roe-tag font-mono">
                    <span className={`roe-badge ${isProfit ? 'badge-green' : 'badge-red'}`}>
                      {isProfit ? '+' : ''}{trade.roePercent}%
                    </span>
                    <span className={`pnl-mini ${isProfit ? 'text-green' : 'text-red'}`}>
                      {isProfit ? '+' : ''}${trade.pnlUsdt}
                    </span>
                  </div>
                </div>

                <div className="hist-prices font-mono">
                  <span>Entry: <strong>{fmt(trade.entryPrice)}</strong></span>
                  <span>➜</span>
                  <span>Exit: <strong>{fmt(trade.exitPrice)}</strong></span>
                  <span className="hist-time ml-auto text-muted">{trade.closedAt}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
