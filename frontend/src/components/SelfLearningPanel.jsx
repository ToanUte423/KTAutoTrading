import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Sliders, 
  Newspaper, 
  Gauge, 
  Flame, 
  ArrowRight, 
  RefreshCw, 
  Cpu, 
  Lock, 
  Hourglass, 
  Activity, 
  Layers, 
  Zap 
} from 'lucide-react';
import CoinIcon from './CoinIcon';

const REGIME_CONFIG = {
  'CHOPPY_SIDEWAYS': {
    name: 'Đi Ngang Biên Độ Hẹp (Sideways)',
    badgeClass: 'regime-choppy',
    icon: Activity,
    actionDesc: 'Tăng đệm SL tránh râu quét giả, chỉ mở lệnh tại biên hỗ trợ S1/R1, siết tỷ trọng margin an toàn.'
  },
  'STRONG_BULL_TREND': {
    name: 'Sóng Tăng Dốc Mạnh (Strong Bull Trend)',
    badgeClass: 'regime-bull',
    icon: TrendingUp,
    actionDesc: 'Ưu tiên vị thế LONG thuận xu hướng, cấm mở SHORT bắt đỉnh rủi ro cao, nới rộng mục tiêu TP2.'
  },
  'STRONG_BEAR_TREND': {
    name: 'Sóng Xả Dốc Mạnh (Strong Bear Trend)',
    badgeClass: 'regime-bear',
    icon: TrendingUp,
    actionDesc: 'Ưu tiên vị thế SHORT thuận đà giảm, cấm LONG bắt dao rơi khi chưa có cấu trúc đáy sau cao hơn.'
  },
  'VOLATILITY_EXPANSION': {
    name: 'Co Giật Cực Đại (Volatility Expansion)',
    badgeClass: 'regime-volatile',
    icon: Zap,
    actionDesc: 'Biên độ nến gián đoạn bất thường (ATR cao). Nới rộng đệm Stop Loss x1.5 lần và hạ đòn bẩy an toàn.'
  }
};

export default function SelfLearningPanel({
  learningState,
  onResetLearning,
  marketRegime = null,
  selectedSymbol = 'BTCUSDT'
}) {
  const { 
    generation = 1, 
    totalMistakesAnalyzed = 0, 
    totalWinsReinforced = 0, 
    totalAdjustments = 0, 
    adaptiveParams = {}, 
    coinProfiles = {}, 
    learningLogs = [] 
  } = learningState || {};

  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'LOSS' | 'WIN' | 'BTC' | 'ETH' | 'SOL' | 'SUI'

  const now = Date.now();
  const currentRegimeKey = marketRegime?.type || 'CHOPPY_SIDEWAYS';
  const regimeConfig = REGIME_CONFIG[currentRegimeKey] || REGIME_CONFIG['CHOPPY_SIDEWAYS'];
  const RegimeIcon = regimeConfig.icon;

  const coinsList = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT'];

  // Filter logs based on selection
  const filteredLogs = learningLogs.filter(log => {
    if (filterType === 'LOSS') return log.result === 'LOSS';
    if (filterType === 'WIN') return log.result === 'WIN';
    if (filterType === 'BTC') return (log.symbol || '').includes('BTC') || (log.title || '').includes('BTC');
    if (filterType === 'ETH') return (log.symbol || '').includes('ETH') || (log.title || '').includes('ETH');
    if (filterType === 'SOL') return (log.symbol || '').includes('SOL') || (log.title || '').includes('SOL');
    if (filterType === 'SUI') return (log.symbol || '').includes('SUI') || (log.title || '').includes('SUI');
    return true;
  });

  return (
    <div className="learning-panel-wrapper">
      {/* Header */}
      <div className="learning-header">
        <div className="learning-title-group">
          <div className="learning-avatar">
            <BrainCircuit size={20} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="learning-title">
              Bộ Não AI Tự Học & Thích Ứng (Gen 2.0 Agentic Reflection)
              <span className="gen-badge">Gen {generation}</span>
            </div>
            <div className="learning-sub">
              Khám nghiệm pháp y đa nhân tố, Khóa chiều chống trả thù & Đệm ATR thích ứng từng coin
            </div>
          </div>
        </div>

        <div className="learning-header-actions">
          <button 
            className="btn-icon-subtle"
            onClick={onResetLearning}
            title="Khôi phục Bộ Não AI về Generation 1 ban đầu"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Generation Stats Bar */}
      <div className="learning-stats-cards">
        <div className="learn-card">
          <span className="learn-card-label">Thế Hệ AI (Generation)</span>
          <div className="learn-card-val text-cyan font-mono">
            Gen {generation}
          </div>
          <span className="learn-card-sub text-muted">
            Tự tiến hóa qua {totalAdjustments} lần
          </span>
        </div>

        <div className="learn-card">
          <span className="learn-card-label">Lệnh Thua Đã Mổ Xẻ</span>
          <div className="learn-card-val text-red font-mono">
            {totalMistakesAnalyzed} Lệnh
          </div>
          <span className="learn-card-sub text-muted">
            Khám nghiệm pháp y & vá lỗi
          </span>
        </div>

        <div className="learn-card">
          <span className="learn-card-label">Chiến Lược Thắng Củng Cố</span>
          <div className="learn-card-val text-green font-mono">
            {totalWinsReinforced} Lệnh
          </div>
          <span className="learn-card-sub text-muted">
            Kế thừa mẫu hình hiệu quả
          </span>
        </div>

        <div className="learn-card">
          <span className="learn-card-label">Trạng Thái Giám Sát</span>
          <div className="learn-card-val text-amber font-mono flex-align">
            <span className="pulse-dot-green" /> 24/7 Hoạt Động
          </div>
          <span className="learn-card-sub text-muted">
            4 cặp tiền giám sát độc lập
          </span>
        </div>
      </div>

      {/* Dynamic Market Volatility Regime Banner */}
      <div className="market-regime-banner">
        <div className="regime-info-group">
          <div className={`regime-badge ${regimeConfig.badgeClass}`}>
            <RegimeIcon size={14} />
            <span>{marketRegime?.name || regimeConfig.name}</span>
          </div>
          <div className="regime-details">
            <div className="regime-title">
              Chế Độ Thị Trường Thực Tế (Market Regime Analysis)
            </div>
            <div className="regime-desc">
              {regimeConfig.actionDesc}
            </div>
          </div>
        </div>
        <div className="text-xs font-mono text-muted">
          Đang theo dõi: <span className="text-cyan font-bold">{selectedSymbol.replace('USDT', '')}/USDT</span>
        </div>
      </div>

      {/* Per-Coin Neural Quant Profiles Matrix */}
      <div className="coin-profiles-section">
        <div className="coin-profiles-header">
          <div className="flex-align gap-2">
            <Layers size={16} className="text-cyan" />
            <span className="coin-profiles-title">Hồ Sơ Định Lượng Độc Lập Từng Coin (Per-Coin Neural Profiles)</span>
          </div>
          <span className="text-muted text-xs">Tự động khóa chiều & tùy biến ATR buffer</span>
        </div>

        <div className="coin-profiles-grid">
          {coinsList.map(sym => {
            const coinName = sym.replace('USDT', '');
            const profile = coinProfiles?.[sym] || {};
            const isForbidden = profile.forbiddenDirection && profile.forbiddenUntil && now < profile.forbiddenUntil;
            const isQuarantined = profile.cooldownUntil && now < profile.cooldownUntil;
            const remainingLockMins = isForbidden ? Math.ceil((profile.forbiddenUntil - now) / 60000) : 0;
            const remainingCoolMins = isQuarantined ? Math.ceil((profile.cooldownUntil - now) / 60000) : 0;

            const volScore = profile.volatilityScore || (sym === 'SUIUSDT' ? 'ULTRA_HIGH' : sym === 'SOLUSDT' ? 'HIGH' : sym === 'ETHUSDT' ? 'MEDIUM' : 'LOW');
            const volLabel = volScore === 'ULTRA_HIGH' ? 'Siêu biến động' : volScore === 'HIGH' ? 'Biến động cao' : volScore === 'MEDIUM' ? 'Trung bình' : 'Biến động thấp';
            const volClass = volScore === 'ULTRA_HIGH' ? 'vol-ultra' : volScore === 'HIGH' ? 'vol-high' : volScore === 'MEDIUM' ? 'vol-med' : 'vol-low';

            return (
              <div key={sym} className="coin-profile-card">
                <div className="coin-profile-top">
                  <div className="coin-profile-sym">
                    <CoinIcon symbol={coinName} size={18} />
                    <span>{coinName}</span>
                  </div>
                  <span className={`volatility-pill ${volClass}`}>{volLabel}</span>
                </div>

                <div className="coin-metrics-list font-mono">
                  <div className="coin-metric-row">
                    <span>Đệm ATR thích ứng:</span>
                    <strong className="text-amber">{profile.atrBufferPct || (sym === 'SUIUSDT' ? 4.2 : sym === 'SOLUSDT' ? 3.0 : sym === 'ETHUSDT' ? 2.0 : 1.5)}%</strong>
                  </div>
                  <div className="coin-metric-row">
                    <span>Độ tin cậy tối thiểu:</span>
                    <strong className="text-cyan">{profile.minConfidence || (sym === 'SUIUSDT' ? 72 : sym === 'SOLUSDT' ? 70 : sym === 'ETHUSDT' ? 67 : 65)}%</strong>
                  </div>
                  <div className="coin-metric-row">
                    <span>Hiệu suất lệnh:</span>
                    <span>
                      <span className="text-green font-bold">{profile.winCount || 0}W</span> / <span className="text-red font-bold">{profile.lossCount || 0}L</span>
                    </span>
                  </div>
                </div>

                <div className="coin-profile-status">
                  {isForbidden ? (
                    <div className="status-badge-lock" title={`Khóa chiều ${profile.forbiddenDirection} sau khi dính Stop Loss`}>
                      <Lock size={12} />
                      <span>Khóa Chiều {profile.forbiddenDirection} ({remainingLockMins}p)</span>
                    </div>
                  ) : isQuarantined ? (
                    <div className="status-badge-cooldown" title="Tạm thời nghỉ ngơi sau chuỗi lệnh thua để bảo toàn vốn">
                      <Hourglass size={12} />
                      <span>Cách Ly An Toàn ({remainingCoolMins}p)</span>
                    </div>
                  ) : (
                    <div className="status-badge-ok">
                      <ShieldCheck size={12} />
                      <span>Đa Chiều Mở (Sẵn sàng)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Adapted Hyperparameters Dashboard */}
      <div className="adapted-params-box">
        <div className="adapted-params-header">
          <div className="flex-align gap-2">
            <Sliders size={16} className="text-cyan" />
            <span className="params-title">Tham Số Lượng Tử Đang Thích Ứng Toàn Hệ Thống (Global Quant Weights)</span>
          </div>
          <span className="params-hint">Được cập nhật tự động sau mỗi lệnh đóng</span>
        </div>

        <div className="params-grid">
          {/* Min Confidence */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Độ Tin Cậy Tối Thiểu Vào Lệnh</span>
              <span className="param-val font-mono">{adaptiveParams.minConfidence || 68}%</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-cyan" 
                style={{ width: `${(((adaptiveParams.minConfidence || 68) - 50) / 40) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              {(adaptiveParams.minConfidence || 68) > 65 
                ? `⚡ Nâng lên +${(adaptiveParams.minConfidence || 68) - 65}% để lọc bỏ các tín hiệu nhiễu.` 
                : 'Mức chuẩn 65% cân bằng độ nhạy và độ chính xác.'}
            </span>
          </div>

          {/* Stop Loss Cushion Buffer */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Vùng Đệm Cắt Lỗ Toàn Cục</span>
              <span className="param-val font-mono">{adaptiveParams.supportBufferPct || 1.5}%</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-amber" 
                style={{ width: `${((adaptiveParams.supportBufferPct || 1.5) / 3.5) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              🛡️ Đệm bảo vệ cản Stop Loss chống bẫy râu nến liếm thanh khoản (Liquidity Sweep).
            </span>
          </div>

          {/* News Confluence Strictness */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Hệ Số Phạt Tin Tức Tiêu Cực</span>
              <span className="param-val font-mono">-{adaptiveParams.newsFilterStrictness || 2.2} đ</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-red" 
                style={{ width: `${((adaptiveParams.newsFilterStrictness || 2.2) / 5.0) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              📰 Cấm mở vị thế LONG khi tin tức vĩ mô Bearish lan rộng.
            </span>
          </div>

          {/* RSI Oversold Threshold */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Ngưỡng RSI Bắt Đáy Quá Bán</span>
              <span className="param-val font-mono">≤ {adaptiveParams.rsiOversoldLimit || 31}</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-green" 
                style={{ width: `${((adaptiveParams.rsiOversoldLimit || 31) / 40) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              🔥 Siết điều kiện bắt đáy: Chỉ vào khi lực bán thực sự kiệt sức.
            </span>
          </div>

          {/* Risk Reward Target */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Mục Tiêu Tỷ Lệ Risk / Reward (R:R)</span>
              <span className="param-val font-mono">1 : {adaptiveParams.rrTargetRatio || 2.3}</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-purple" 
                style={{ width: `${(((adaptiveParams.rrTargetRatio || 2.3) - 1.5) / 2.0) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              Tỷ lệ R:R tối ưu để đảm bảo 1 lệnh thắng bù đắp 2 lệnh cắt lỗ.
            </span>
          </div>

          {/* Dynamic Leverage Cap */}
          <div className="param-item">
            <div className="param-top">
              <span className="param-name">Trần Đòn Bẩy An Toàn</span>
              <span className="param-val font-mono">{adaptiveParams.maxLeverageCap || 15}x</span>
            </div>
            <div className="param-bar-bg">
              <div 
                className="param-bar-fill bg-cyan" 
                style={{ width: `${((adaptiveParams.maxLeverageCap || 15) / 20) * 100}%` }}
              />
            </div>
            <span className="param-desc">
              Giới hạn đòn bẩy tự động để kiểm soát mức độ sụt giảm tài sản (Drawdown).
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Factor Forensic Lessons Learned Log Feed */}
      <div className="learning-log-section">
        <div className="learning-log-header">
          <div className="flex-align gap-2">
            <Cpu size={16} className="text-amber" />
            <span className="learning-log-title">Nhật Ký Khám Nghiệm Pháp Y & Tự Sửa Sai (Forensic Post-Mortem)</span>
          </div>
          <span className="log-count font-mono">{filteredLogs.length} bài học hiển thị</span>
        </div>

        {/* Filter Chips Bar */}
        <div className="learning-filter-bar">
          <button 
            className={`learning-filter-chip ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            Tất cả ({learningLogs.length})
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'LOSS' ? 'active' : ''}`}
            onClick={() => setFilterType('LOSS')}
          >
            🛑 Cắt Lỗ SL ({learningLogs.filter(l => l.result === 'LOSS').length})
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'WIN' ? 'active' : ''}`}
            onClick={() => setFilterType('WIN')}
          >
            🎯 Chốt Lời TP ({learningLogs.filter(l => l.result === 'WIN').length})
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'BTC' ? 'active' : ''}`}
            onClick={() => setFilterType('BTC')}
          >
            BTC
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'ETH' ? 'active' : ''}`}
            onClick={() => setFilterType('ETH')}
          >
            ETH
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'SOL' ? 'active' : ''}`}
            onClick={() => setFilterType('SOL')}
          >
            SOL
          </button>
          <button 
            className={`learning-filter-chip ${filterType === 'SUI' ? 'active' : ''}`}
            onClick={() => setFilterType('SUI')}
          >
            SUI
          </button>
        </div>

        <div className="learning-log-list">
          {filteredLogs.map((log) => {
            const isLoss = log.result === 'LOSS';
            const isWin = log.result === 'WIN';
            const isInit = log.type === 'INIT' || log.type === 'RESET';

            let categoryTag = null;
            if (log.category === 'TREND_REVERSAL_DEFENSE') {
              categoryTag = <span className="forensic-category-tag tag-reversal">🛡️ Phòng Vệ Đảo Chiều</span>;
            } else if (log.category === 'LIQUIDITY_HUNT') {
              categoryTag = <span className="forensic-category-tag tag-liquidity">🛡️ Bẫy Quét Râu Thanh Khoản</span>;
            } else if (log.category === 'COUNTER_TREND_PUMP' || log.category === 'COUNTER_TREND_TRAP') {
              categoryTag = <span className="forensic-category-tag tag-counter">⚠️ Bẫy Ngược Sóng Lớn</span>;
            } else if (log.category === 'FALLING_KNIFE') {
              categoryTag = <span className="forensic-category-tag tag-knife">⚡ Bẫy Long Bắt Dao Rơi</span>;
            } else if (log.category === 'VOLATILITY_SPIKE') {
              categoryTag = <span className="forensic-category-tag tag-vol-spike">🌊 Đột Biến Co Giật ATR</span>;
            } else if (log.category === 'PATTERN_REINFORCEMENT') {
              categoryTag = <span className="forensic-category-tag tag-reinforce">🎯 Củng Cố Mẫu Hình Thắng</span>;
            }

            return (
              <div key={log.id} className={`learn-log-card ${isLoss ? 'log-loss' : isWin ? 'log-win' : 'log-neutral'}`}>
                <div className="log-top">
                  <div className="flex-align gap-2 flex-wrap">
                    {isLoss && <AlertTriangle size={15} className="text-red" />}
                    {isWin && <CheckCircle2 size={15} className="text-green" />}
                    {isInit && <Sparkles size={15} className="text-cyan" />}
                    <span className="log-title">{log.title}</span>
                    {categoryTag}
                  </div>
                  <div className="flex-align gap-2 font-mono text-xs">
                    {log.roePercent !== 0 && (
                      <span className={`roe-badge ${isWin ? 'text-green' : 'text-red'}`}>
                        {isWin ? '+' : ''}{log.roePercent}% ROE
                      </span>
                    )}
                    <span className="text-muted">{log.timestamp}</span>
                  </div>
                </div>

                <div className="log-body">
                  <div className="log-reason">
                    <span className="log-tag tag-reason">🔍 Mổ xẻ nguyên nhân:</span>
                    <span>{log.reason}</span>
                  </div>
                  <div className="log-action">
                    <span className="log-tag tag-action">🛠️ Tự sửa sai & thích ứng:</span>
                    <span className="text-cyan">{log.actionTaken}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
