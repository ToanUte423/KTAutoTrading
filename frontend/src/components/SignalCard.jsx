import React, { useState } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  PauseCircle, 
  Copy, 
  Check, 
  ShieldCheck, 
  Target, 
  Flame,
  Newspaper
} from 'lucide-react';
import CoinIcon from './CoinIcon';

export default function SignalCard({ signal, onRefresh, isAnalyzing, newsContext }) {
  const [copied, setCopied] = useState(false);

  if (!signal) return null;

  const isBuy = signal.action === 'BUY';
  const isSell = signal.action === 'SELL';
  const pairName = signal.pairName || (signal.symbol ? `${signal.symbol.replace('USDT', '')}/USDT` : 'BTC/USDT');
  const decimals = pairName.includes('SUI') ? 4 : (signal.stopLoss < 10 ? 4 : 2);

  const formatPrice = (val) => {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const handleCopy = () => {
    const text = `TÍN HIỆU ${pairName} (${signal.timeframe || 'HTF'}): ${signal.signalType}
Vùng vào lệnh: ${signal.entryZone}
Vùng Hỗ Trợ 1: ${signal.supportZone1 || 'N/A'}
Vùng Kháng Cự 1: ${signal.resistanceZone1 || 'N/A'}
Cắt lỗ (SL): ${typeof signal.stopLoss === 'number' ? formatPrice(signal.stopLoss) : signal.stopLoss}
Chốt lời 1 (TP1): ${typeof signal.takeProfit1 === 'number' ? formatPrice(signal.takeProfit1) : signal.takeProfit1}
Chốt lời 2 (TP2): ${typeof signal.takeProfit2 === 'number' ? formatPrice(signal.takeProfit2) : signal.takeProfit2}
Tỷ lệ R:R: ${signal.riskRewardRatio} | Độ tin cậy: ${signal.confidence}%`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`signal-card ${isBuy ? 'signal-buy' : isSell ? 'signal-sell' : 'signal-wait'}`}>
      <div className="signal-card-header">
        <div className="signal-type-tag">
          {isBuy && <ArrowUpCircle size={18} className="text-green" />}
          {isSell && <ArrowDownCircle size={18} className="text-red" />}
          {!isBuy && !isSell && <PauseCircle size={18} className="text-amber" />}
          <span className="signal-title flex-align" style={{ gap: '6px' }}>
            <CoinIcon symbol={pairName} size={18} />
            <span>{pairName}: {signal.signalType}</span>
          </span>
        </div>

        <div className="flex-align gap-2">
          {newsContext && (
            <div className="signal-news-badge" title={newsContext.topNewsTitle}>
              <Newspaper size={11} />
              <span>Tin tức: <strong>{newsContext.sentimentLabel}</strong></span>
            </div>
          )}

          <div className="signal-confidence-tag">
            <Flame size={13} className="text-amber" />
            <span>Tin cậy: <strong>{signal.confidence}%</strong></span>
          </div>
        </div>
      </div>

      <div className="signal-grid">
        <div className="signal-param">
          <span className="param-title">🎯 Vùng Vào Lệnh (Entry)</span>
          <span className="param-value font-mono highlight">{signal.entryZone}</span>
        </div>

        <div className="signal-param">
          <span className="param-title">🟢 Hỗ Trợ 1 (S1) Đã Kẻ</span>
          <span className="param-value font-mono text-green">
            {signal.supportZone1 || (typeof signal.support1 === 'number' ? formatPrice(signal.support1) : signal.support1)}
          </span>
        </div>

        <div className="signal-param">
          <span className="param-title">🛑 Cắt Lỗ (Stop Loss)</span>
          <span className="param-value font-mono text-red">
            {typeof signal.stopLoss === 'number' ? formatPrice(signal.stopLoss) : signal.stopLoss}
          </span>
        </div>

        <div className="signal-param">
          <span className="param-title">🔴 Kháng Cự 1 (R1) Đã Kẻ</span>
          <span className="param-value font-mono text-red">
            {signal.resistanceZone1 || (typeof signal.resistance1 === 'number' ? formatPrice(signal.resistance1) : signal.resistance1)}
          </span>
        </div>
      </div>

      <div className="signal-footer">
        <div className="flex-align gap-3">
          <span className="text-green">TP1: <strong>{typeof signal.takeProfit1 === 'number' ? formatPrice(signal.takeProfit1) : signal.takeProfit1}</strong></span>
          <span className="text-green">TP2: <strong>{typeof signal.takeProfit2 === 'number' ? formatPrice(signal.takeProfit2) : signal.takeProfit2}</strong></span>
          <span className="rr-ratio">R:R: <strong>{signal.riskRewardRatio}</strong></span>
        </div>

        <button className="btn-copy-plan" onClick={handleCopy}>
          {copied ? <Check size={13} className="text-green" /> : <Copy size={13} />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
        </button>
      </div>
    </div>
  );
}
