import React, { useEffect, useRef, useState } from 'react';
import { 
  Settings, 
  Zap, 
  Radio, 
  TrendingUp, 
  TrendingDown, 
  Cpu, 
  Bot, 
  Volume2, 
  VolumeX,
  Newspaper,
  History,
  MessageSquare,
  BrainCircuit,
  BarChart3
} from 'lucide-react';
import { SUPPORTED_PAIRS, getPairConfig, formatPairPrice } from '../utils/indicators';
import CoinIcon from './CoinIcon';

export default function Header({
  ticker,
  wsStatus,
  onOpenSettings,
  onTriggerAnalysis,
  isAnalyzing,
  aiConfig,
  isBot247Active,
  onToggleBot247,
  soundEnabled,
  onToggleSound,
  activeTab,
  onSelectTab,
  learningGeneration = 1,
  isServerOnline = false,
  btcDominance = null,
  futuresMetrics = null,
  circuitBreaker = null,
  selectedSymbol = 'BTCUSDT',
  onSelectSymbol,
  multiTickers = {}
}) {
  const [priceFlash, setPriceFlash] = useState('');
  const prevPriceRef = useRef(ticker?.lastPrice);

  const activePair = getPairConfig(selectedSymbol);

  useEffect(() => {
    if (ticker?.lastPrice && prevPriceRef.current) {
      if (ticker.lastPrice > prevPriceRef.current) {
        setPriceFlash('price-flash-up');
      } else if (ticker.lastPrice < prevPriceRef.current) {
        setPriceFlash('price-flash-down');
      }
      const timer = setTimeout(() => setPriceFlash(''), 600);
      prevPriceRef.current = ticker.lastPrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = ticker?.lastPrice;
  }, [ticker?.lastPrice]);

  const isPositive = (ticker?.priceChangePercent || 0) >= 0;

  return (
    <header className="header-container">
      {/* Top Header Main Row */}
      <div className="header-main-row">
        {/* Left: Brand & Symbol */}
        <div className="header-left">
          <div className="brand-logo" onClick={() => onSelectTab('chart')} style={{ cursor: 'pointer' }} title="KTAutoTrading">
            <div className={`btc-icon-wrapper coin-theme-${activePair.coin.toLowerCase()}`}>
              <CoinIcon symbol={selectedSymbol} size={20} />
            </div>
          </div>

          <div className="pair-divider hide-mobile" />

          {/* Multi-Coin Switcher Pills */}
          <div className="coin-selector-group hide-mobile">
            {SUPPORTED_PAIRS.map((pair) => {
              const isActive = (selectedSymbol || 'BTCUSDT') === pair.symbol;
              const pairTicker = multiTickers?.[pair.symbol];
              const isPairPos = (pairTicker?.priceChangePercent || 0) >= 0;

              return (
                <button
                  key={pair.symbol}
                  className={`coin-selector-chip ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectSymbol?.(pair.symbol)}
                  title={`Chuyển sang giao dịch ${pair.name}`}
                >
                  <span className="coin-chip-icon">
                    <CoinIcon symbol={pair.symbol} size={15} />
                  </span>
                  <span className="coin-chip-name">{pair.coin}</span>
                  {pairTicker && (
                    <span className={`coin-chip-delta ${isPairPos ? 'text-green' : 'text-red'}`}>
                      {isPairPos ? '+' : ''}{pairTicker.priceChangePercent ? `${pairTicker.priceChangePercent.toFixed(1)}%` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pair-divider hide-mobile" />

          {/* Desktop Live Price & 24h Delta */}
          <div className="price-stats-group hide-mobile">
            <div className="current-price-box">
              <div className="price-label">{activePair.name}</div>
              <div className={`live-price ${priceFlash} ${isPositive ? 'text-green' : 'text-red'}`}>
                {formatPairPrice(ticker?.lastPrice, selectedSymbol)}
              </div>
            </div>

            <div className={`stat-box 24h-change ${isPositive ? 'stat-positive' : 'stat-negative'}`}>
              <span className="stat-label">24h Biến động</span>
              <span className="stat-value flex-align font-mono font-semibold">
                {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {ticker?.priceChangePercent ? `${isPositive ? '+' : ''}${ticker.priceChangePercent.toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Center Mobile Price Badge */}
        <div className="mobile-price-center show-mobile-only">
          <span className="mobile-price-coin font-mono" style={{ fontSize: '11px', color: '#00e5ff', marginRight: '4px' }}>{activePair.coin}</span>
          <span className={`mobile-price-num font-mono ${priceFlash} ${isPositive ? 'text-green' : 'text-red'}`}>
            {formatPairPrice(ticker?.lastPrice, selectedSymbol)}
          </span>
          <span className={`mobile-price-change ${isPositive ? 'badge-green' : 'badge-red'}`}>
            {isPositive ? '+' : ''}{ticker?.priceChangePercent ? `${ticker.priceChangePercent.toFixed(2)}%` : '--'}
          </span>
        </div>

        {/* Right: Controls & AI Status */}
        <div className="header-right">
          {/* Desktop Navigation Tabs Buttons */}
          <div className="header-nav-tabs hide-mobile">
            <button 
              className={`nav-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => onSelectTab('chat')}
            >
              <MessageSquare size={13} />
              <span>AI Advisor</span>
            </button>
            <button 
              className={`nav-tab-btn tab-highlight ${activeTab === 'autotrade' ? 'active' : ''}`}
              onClick={() => onSelectTab('autotrade')}
            >
              <Zap size={13} className="text-cyan" />
              <span>Auto Trade</span>
            </button>
            <button 
              className={`nav-tab-btn tab-analytics ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => onSelectTab('analytics')}
            >
              <BarChart3 size={13} className="text-cyan" />
              <span>Hiệu Suất</span>
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => onSelectTab('news')}
            >
              <Newspaper size={13} />
              <span>News Bot</span>
            </button>
            <button 
              className={`nav-tab-btn ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => onSelectTab('journal')}
            >
              <History size={13} />
              <span>Nhật Ký</span>
            </button>
            <button 
              className={`nav-tab-btn tab-learning ${activeTab === 'learning' ? 'active' : ''}`}
              onClick={() => onSelectTab('learning')}
            >
              <BrainCircuit size={13} className="text-cyan animate-pulse" />
              <span>AI Tự Học</span>
              <span className="tab-gen-pill font-mono">G{learningGeneration}</span>
            </button>
          </div>

          {/* Quick AI Trigger Button */}
          <button 
            className="btn-trigger-ai"
            onClick={onTriggerAnalysis}
            disabled={isAnalyzing}
            title="Yêu cầu AI quét đồ thị & đưa ra tín hiệu vào lệnh"
          >
            <Zap size={14} className={isAnalyzing ? 'animate-spin' : ''} />
            <span className="hide-mobile">{isAnalyzing ? 'Đang quét...' : 'Quét Lệnh AI'}</span>
          </button>

          {/* Sound Toggle */}
          <button 
            className="btn-icon-subtle hide-mobile"
            onClick={onToggleSound}
            title={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
          >
            {soundEnabled ? <Volume2 size={16} className="text-cyan" /> : <VolumeX size={16} className="text-muted" />}
          </button>

          {/* Settings button */}
          <button 
            className="btn-icon-settings" 
            onClick={onOpenSettings}
            title="Cài đặt API Key & Mô hình AI"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Mobile Coin Bar */}
      <div className="mobile-coin-bar show-mobile-only">
        {SUPPORTED_PAIRS.map((pair) => {
          const isActive = (selectedSymbol || 'BTCUSDT') === pair.symbol;
          const pairTicker = multiTickers?.[pair.symbol];
          const isPairPos = (pairTicker?.priceChangePercent || 0) >= 0;

          return (
            <button
              key={pair.symbol}
              className={`coin-selector-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSymbol?.(pair.symbol)}
            >
              <span className="coin-chip-icon">
                <CoinIcon symbol={pair.symbol} size={15} />
              </span>
              <span className="coin-chip-name">{pair.coin}</span>
              {pairTicker && (
                <span className={`coin-chip-delta ${isPairPos ? 'text-green' : 'text-red'}`}>
                  {isPairPos ? '+' : ''}{pairTicker.priceChangePercent ? `${pairTicker.priceChangePercent.toFixed(1)}%` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 2: Mobile Horizontal Stats Strip (Horizontally swipeable) */}
      <div className="mobile-stats-ticker show-mobile-only">
        {btcDominance && (
          <div className="mobile-ticker-pill">
            <span className="pill-key">BTC.D:</span>
            <span className="pill-val font-mono">{btcDominance.displayPercent}</span>
            <span className={`pill-delta ${btcDominance.change24h >= 0 ? 'text-green' : 'text-red'}`}>
              ({btcDominance.change24h >= 0 ? '+' : ''}{btcDominance.change24h?.toFixed(2)}%)
            </span>
            <span className="pill-scenario-badge">{btcDominance.matrix?.badge || 'BTC.D'}</span>
          </div>
        )}

        {futuresMetrics && (
          <div className="mobile-ticker-pill">
            <span className="pill-key">FUNDING:</span>
            <span className={`pill-val font-mono ${futuresMetrics.fundingRate >= 0 ? 'text-green' : 'text-red'}`}>
              {futuresMetrics.fundingRatePercent}
            </span>
            <span className="pill-delta">({futuresMetrics.hoursToFunding}h)</span>
          </div>
        )}

        <div className="mobile-ticker-pill">
          <span className="pill-key">24H ĐỈNH:</span>
          <span className="pill-val font-mono">{formatPairPrice(ticker?.highPrice, selectedSymbol)}</span>
        </div>

        <div className="mobile-ticker-pill">
          <span className="pill-key">24H ĐÁY:</span>
          <span className="pill-val font-mono">{formatPairPrice(ticker?.lowPrice, selectedSymbol)}</span>
        </div>

        <div className="mobile-ticker-pill">
          <span className="pill-key">VOL:</span>
          <span className="pill-val font-mono">{ticker?.volume ? (ticker.volume < 1000 ? ticker.volume.toFixed(1) : `${(ticker.volume / 1000).toFixed(1)}k`) : '---'} {activePair.coin}</span>
        </div>
      </div>
    </header>
  );
}
