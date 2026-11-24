import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  ExternalLink, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { fetchCryptoNews } from '../services/newsService';

export default function NewsBot({ onAnalyzeNewsImpact, isAnalyzing }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'bitcoin' | 'bullish' | 'bearish'
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await fetchCryptoNews();
      setNews(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Error loading news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  // 60-second auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadNews();
    }, 60000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Calculate sentiment summary
  const totalNews = news.length;
  const bullishCount = news.filter(n => n.sentiment === 'bullish').length;
  const bearishCount = news.filter(n => n.sentiment === 'bearish').length;
  const neutralCount = totalNews - bullishCount - bearishCount;

  const bullPercent = totalNews ? Math.round((bullishCount / totalNews) * 100) : 50;
  const bearPercent = totalNews ? Math.round((bearishCount / totalNews) * 100) : 50;

  // Filtered list
  const filteredNews = news.filter(item => {
    if (filter === 'bitcoin') return item.isBitcoin;
    if (filter === 'bullish') return item.sentiment === 'bullish';
    if (filter === 'bearish') return item.sentiment === 'bearish';
    return true;
  });

  return (
    <div className="news-bot-wrapper">
      {/* Top Header */}
      <div className="news-bot-header">
        <div className="news-title-group">
          <div className="news-bot-avatar">
            <Newspaper size={18} />
          </div>
          <div>
            <div className="news-bot-name">Crypto News & Sentiment Bot</div>
            <div className="news-bot-sub">
              {lastUpdated ? `Cập nhật lúc ${lastUpdated}` : 'Đang lấy tin tức...'}
            </div>
          </div>
        </div>

        <div className="news-actions">
          <button 
            className={`btn-auto-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Tự động cập nhật mỗi 60 giây"
          >
            <span className="dot-mini" />
            <span>Auto 60s</span>
          </button>

          <button 
            className="btn-icon-subtle" 
            onClick={loadNews}
            disabled={loading}
            title="Làm mới tin tức ngay"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sentiment Overview Bar */}
      <div className="sentiment-meter-bar">
        <div className="meter-label-row">
          <span className="text-green flex-align">
            <TrendingUp size={13} /> {bullPercent}% Tích cực ({bullishCount})
          </span>
          <span className="text-muted text-xs">Chỉ số tâm lý tin tức</span>
          <span className="text-red flex-align">
            <TrendingDown size={13} /> {bearPercent}% Tiêu cực ({bearishCount})
          </span>
        </div>
        <div className="meter-progress-track">
          <div className="meter-fill-bull" style={{ width: `${bullPercent}%` }} />
          <div className="meter-fill-bear" style={{ width: `${bearPercent}%` }} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="news-filter-tabs">
        <button 
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({totalNews})
        </button>
        <button 
          className={`filter-chip ${filter === 'bitcoin' ? 'active' : ''}`}
          onClick={() => setFilter('bitcoin')}
        >
          Chỉ Bitcoin ₿
        </button>
        <button 
          className={`filter-chip chip-bull ${filter === 'bullish' ? 'active' : ''}`}
          onClick={() => setFilter('bullish')}
        >
          Tích cực ({bullishCount})
        </button>
        <button 
          className={`filter-chip chip-bear ${filter === 'bearish' ? 'active' : ''}`}
          onClick={() => setFilter('bearish')}
        >
          Tiêu cực ({bearishCount})
        </button>
      </div>

      {/* News Feed Stream */}
      <div className="news-scroll-area">
        {loading && news.length === 0 ? (
          <div className="news-loading-state">
            <RefreshCw size={24} className="animate-spin text-cyan" />
            <span>Đang thu thập các tin tức thị trường Bitcoin mới nhất...</span>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="news-empty-state">
            <AlertCircle size={24} className="text-muted" />
            <span>Không tìm thấy tin tức phù hợp với bộ lọc</span>
          </div>
        ) : (
          filteredNews.map((item) => (
            <div key={item.id} className="news-card">
              <div className="news-card-top">
                <span 
                  className="news-sentiment-badge"
                  style={{ 
                    backgroundColor: `${item.sentimentColor}15`, 
                    color: item.sentimentColor,
                    borderColor: `${item.sentimentColor}40`
                  }}
                >
                  {item.sentiment === 'bullish' && <TrendingUp size={11} />}
                  {item.sentiment === 'bearish' && <TrendingDown size={11} />}
                  <span>{item.sentimentLabel}</span>
                </span>

                <div className="news-time-ago">
                  <Clock size={11} />
                  <span>{item.timeAgo}</span>
                </div>
              </div>

              <a 
                href={item.link} 
                target="_blank" 
                rel="noreferrer" 
                className="news-card-title"
              >
                <span>{item.title}</span>
                <ExternalLink size={12} className="link-icon" />
              </a>

              {item.description && (
                <p className="news-card-desc">{item.description}</p>
              )}

              <div className="news-card-footer">
                <span className="news-source-tag">Cointelegraph</span>
                
                <button
                  className="btn-ai-news-impact"
                  onClick={() => onAnalyzeNewsImpact(item)}
                  disabled={isAnalyzing}
                  title="Yêu cầu AI phân tích tin tức này ảnh hưởng như thế nào đến giá Bitcoin"
                >
                  <Sparkles size={12} className="text-cyan" />
                  <span>AI Đánh giá tác động BTC</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
