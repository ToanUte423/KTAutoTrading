import React from 'react';
import { Activity, Compass, Shield, Target, Zap, Layers } from 'lucide-react';

export default function IndicatorsBar({ snapshot, btcDominance = null, futuresMetrics = null }) {
  if (!snapshot) return null;

  const { rsi, macd, ema, supportResistance, trend, trendScore, timeframe } = snapshot;
  const { support1, support2, resistance1, resistance2, supportZone1, supportZone2, resistanceZone1, resistanceZone2 } = supportResistance || {};

  let rsiColorClass = 'badge-neutral';
  if (rsi.value >= 70) rsiColorClass = 'badge-red';
  else if (rsi.value <= 30) rsiColorClass = 'badge-green';
  else if (rsi.value > 55) rsiColorClass = 'badge-blue';

  const isMacdBull = macd.histogram >= 0;
  const isTrendBull = trendScore > 0;
  const isTrendBear = trendScore < 0;

  return (
    <div className="indicators-bar-container">
      {/* 1. Trend Card */}
      <div className="indicator-pill">
        <div className="pill-icon">
          <Compass size={14} className={isTrendBull ? 'text-green' : isTrendBear ? 'text-red' : 'text-amber'} />
        </div>
        <div className="pill-body">
          <span className="pill-label">Xu Hướng ({timeframe.toUpperCase()})</span>
          <span className={`pill-val font-semibold ${isTrendBull ? 'text-green' : isTrendBear ? 'text-red' : 'text-amber'}`}>
            {trend}
          </span>
        </div>
      </div>

      {/* 2. Vùng Hỗ Trợ 1 (S1) */}
      <div className="indicator-pill border-green-subtle">
        <div className="pill-icon">
          <Shield size={14} className="text-green" />
        </div>
        <div className="pill-body">
          <div className="flex-align">
            <span className="pill-label text-green">Vùng Hỗ Trợ 1 (S1)</span>
            <span className="pill-badge badge-green font-mono">${support1?.toLocaleString()}</span>
          </div>
          <span className="pill-val font-mono text-cyan text-xs">
            {supportZone1 || `$${support1?.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* 3. Vùng Hỗ Trợ Cứng 2 (S2) */}
      {support2 && support2 !== support1 && (
        <div className="indicator-pill border-cyan-subtle hide-sm">
          <div className="pill-icon">
            <Shield size={14} className="text-cyan" />
          </div>
          <div className="pill-body">
            <div className="flex-align">
              <span className="pill-label text-cyan">Hỗ Trợ Cứng 2 (S2)</span>
              <span className="pill-badge badge-blue font-mono">${support2?.toLocaleString()}</span>
            </div>
            <span className="pill-val font-mono text-xs">
              {supportZone2 || `$${support2?.toLocaleString()}`}
            </span>
          </div>
        </div>
      )}

      {/* 4. Vùng Kháng Cự 1 (R1) */}
      <div className="indicator-pill border-red-subtle">
        <div className="pill-icon">
          <Target size={14} className="text-red" />
        </div>
        <div className="pill-body">
          <div className="flex-align">
            <span className="pill-label text-red">Vùng Kháng Cự 1 (R1)</span>
            <span className="pill-badge badge-red font-mono">${resistance1?.toLocaleString()}</span>
          </div>
          <span className="pill-val font-mono text-xs">
            {resistanceZone1 || `$${resistance1?.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* 5. Vùng Kháng Cự Mạnh 2 (R2) */}
      {resistance2 && resistance2 !== resistance1 && (
        <div className="indicator-pill hide-md">
          <div className="pill-icon">
            <Target size={14} className="text-purple" />
          </div>
          <div className="pill-body">
            <div className="flex-align">
              <span className="pill-label">Kháng Cự Mạnh 2 (R2)</span>
              <span className="pill-badge badge-neutral font-mono">${resistance2?.toLocaleString()}</span>
            </div>
            <span className="pill-val font-mono text-xs">
              {resistanceZone2 || `$${resistance2?.toLocaleString()}`}
            </span>
          </div>
        </div>
      )}

      {/* 6. RSI Card */}
      <div className="indicator-pill hide-sm">
        <div className="pill-icon">
          <Activity size={14} className={rsi.value >= 70 ? 'text-red' : rsi.value <= 30 ? 'text-green' : 'text-cyan'} />
        </div>
        <div className="pill-body">
          <div className="flex-between">
            <span className="pill-label">RSI (14)</span>
            <span className={`pill-badge ${rsiColorClass}`}>
              {rsi.value >= 70 ? 'Quá Mua' : rsi.value <= 30 ? 'Quá Bán' : 'Trung tính'}
            </span>
          </div>
          <span className="pill-val font-mono">{rsi.value.toFixed(1)}</span>
        </div>
      </div>

      {/* 7. MACD Card */}
      <div className="indicator-pill hide-md">
        <div className="pill-icon">
          <Zap size={14} className={isMacdBull ? 'text-green' : 'text-red'} />
        </div>
        <div className="pill-body">
          <span className="pill-label">MACD</span>
          <span className={`pill-val font-mono ${isMacdBull ? 'text-green' : 'text-red'}`}>
            {isMacdBull ? '+' : ''}{macd.histogram.toFixed(1)}
          </span>
        </div>
      </div>

      {/* 8. BTC Dominance & Dòng Vốn Card */}
      {btcDominance && (
        <div 
          className="indicator-pill border-purple-subtle" 
          title={`BTC Dominance: ${btcDominance.displayPercent}\n24h: ${btcDominance.change24h >= 0 ? '+' : ''}${btcDominance.change24h?.toFixed(2)}%\nĐánh giá: ${btcDominance.matrix?.headline || ''}\nLời khuyên: ${btcDominance.matrix?.advice || ''}`}
        >
          <div className="pill-icon">
            <span style={{ fontSize: '13px', lineHeight: 1 }}>🪙</span>
          </div>
          <div className="pill-body">
            <div className="flex-align" style={{ gap: '4px' }}>
              <span className="pill-label text-purple font-medium">BTC.D</span>
              <span className={`pill-badge font-mono ${btcDominance.matrix?.badge === 'BULLISH BTC' ? 'badge-green' : btcDominance.matrix?.badge === 'ALTSEASON' ? 'badge-blue' : btcDominance.matrix?.badge === 'PANIC BLEED' || btcDominance.matrix?.badge === 'CASH FLIGHT' ? 'badge-red' : 'badge-neutral'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                {btcDominance.matrix?.badge || 'BTC.D'}
              </span>
            </div>
            <span className="pill-val font-mono text-xs">
              {btcDominance.displayPercent} <span className={btcDominance.change24h >= 0 ? 'text-green' : 'text-red'}>({btcDominance.change24h >= 0 ? '+' : ''}{btcDominance.change24h?.toFixed(2)}%)</span>
            </span>
          </div>
        </div>
      )}

      {/* 9. Futures Funding Rate Card */}
      {futuresMetrics && (
        <div 
          className="indicator-pill border-cyan-subtle hide-sm" 
          title={`Futures Funding Rate: ${futuresMetrics.fundingRatePercent}\nĐếm ngược kỳ funding kế tiếp: ${futuresMetrics.hoursToFunding}h\nĐánh giá: ${futuresMetrics.headline}`}
        >
          <div className="pill-icon">
            <span style={{ fontSize: '13px', lineHeight: 1 }}>⚡</span>
          </div>
          <div className="pill-body">
            <div className="flex-align" style={{ gap: '4px' }}>
              <span className="pill-label text-cyan font-medium">Funding (8h)</span>
              <span className={`pill-badge font-mono ${futuresMetrics.isLongCrowded || futuresMetrics.isShortCrowded ? 'badge-red' : 'badge-neutral'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                {futuresMetrics.isLongCrowded ? 'LONG DANGER' : futuresMetrics.isShortCrowded ? 'SHORT DANGER' : 'ỔN ĐỊNH'}
              </span>
            </div>
            <span className={`pill-val font-mono text-xs ${futuresMetrics.fundingRate >= 0 ? 'text-green' : 'text-red'}`}>
              {futuresMetrics.fundingRatePercent} <span className="text-muted" style={{ fontSize: '10px' }}>({futuresMetrics.hoursToFunding}h)</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
