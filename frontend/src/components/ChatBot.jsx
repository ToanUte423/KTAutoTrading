import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Sparkles, 
  Zap, 
  TrendingUp, 
  ShieldAlert, 
  Copy,
  Check,
  Target,
  Shield,
  Layers,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  PieChart
} from 'lucide-react';

const QUICK_PROMPTS = [
  { 
    icon: Zap, 
    label: 'Tín hiệu vào lệnh ngay', 
    prompt: 'Dựa trên biểu đồ và chỉ báo hiện tại, hãy phân tích và cho tôi điểm vào lệnh (Entry), Cắt lỗ (SL), Chốt lời (TP) và lý do chi tiết.' 
  },
  { 
    icon: TrendingUp, 
    label: 'Xu hướng lớn & Đa khung 4H', 
    prompt: 'Cấu trúc nến khung 1H hiện tại có đồng thuận với xu hướng lớn 4H và 1D không? Các đường EMA20/50/200 đang chỉ ra xu hướng nào?' 
  },
  { 
    icon: PieChart, 
    label: 'Dòng tiền Bitcoin Dominance (BTC.D)', 
    prompt: 'Chỉ số Bitcoin Dominance (BTC.D) hiện tại đang phản ánh dòng vốn luân chuyển thế nào? Thị trường đang ở kịch bản BTC Độc Tôn, Altseason, hay Tháo chạy ra USDT (Cash)?' 
  },
  { 
    icon: ShieldAlert, 
    label: 'Vùng Hỗ trợ & Kháng cự S/R', 
    prompt: 'Xác định các vùng hỗ trợ S1, S2 và kháng cự R1, R2 cụ thể đã kẻ trên biểu đồ. Mốc nào là ngưỡng cản quan trọng nhất lúc này?' 
  },
  { 
    icon: Flame, 
    label: 'Đánh giá tin tức & FOMC', 
    prompt: 'Tin tức thị trường và lịch vĩ mô lúc này thế nào? Có sự kiện CPI hay FOMC nào gây rủi ro quét râu nến không?' 
  },
  { 
    icon: Target, 
    label: 'Kế hoạch Trailing Stop', 
    prompt: 'Nếu mở vị thế lúc này, hãy đề xuất kế hoạch dời Stop Loss về hòa vốn khi nào và cách trailing stop để tối đa hóa lợi nhuận?' 
  }
];

// Helper to extract trade plan details from AI response if present
function parseTradePlan(content, defaultSymbol = 'BTCUSDT') {
  if (!content || typeof content !== 'string') return null;

  const hasSignal = content.includes('Tín hiệu đề xuất') || content.includes('Vùng Vào Lệnh') || content.includes('Cắt Lỗ');
  if (!hasSignal) return null;

  const symbolMatch = content.match(/\b(BTC|ETH|SOL|SUI)\/USDT\b/i) || content.match(/\b(BTC|ETH|SOL|SUI)USDT\b/i);
  const detectedCoin = symbolMatch 
    ? symbolMatch[1].toUpperCase() + '/USDT' 
    : (defaultSymbol ? `${defaultSymbol.replace('/', '').replace('USDT', '')}/USDT` : 'BTC/USDT');

  const signalMatch = content.match(/\*\*Tín hiệu đề xuất\*\*:\s*\*\*([^*]+)\*\*(?:\s*\(Độ tin cậy:\s*\*\*(\d+%)\*\*\))?/i);
  const entryMatch = content.match(/Vùng Vào Lệnh[^:]*:\s*\*\*([^*]+)\*\*/i);
  const slMatch = content.match(/Cắt Lỗ[^:]*:\s*\*\*([^*]+)\*\*/i);
  const tp1Match = content.match(/Chốt Lời 1[^:]*:\s*\*\*([^*]+)\*\*/i);
  const tp2Match = content.match(/Chốt Lời 2[^:]*:\s*\*\*([^*]+)\*\*/i);
  const rrMatch = content.match(/Tỷ lệ R:R[^:]*:\s*\*\*([^*]+)\*\*/i);

  // S/R Zones
  const s1Match = content.match(/Vùng Hỗ Trợ 1[^:]*:\s*\*\*([^*]+)\*\*/i);
  const s2Match = content.match(/Vùng Hỗ Trợ Cứng 2[^:]*:\s*\*\*([^*]+)\*\*/i);
  const r1Match = content.match(/Vùng Kháng Cự 1[^:]*:\s*\*\*([^*]+)\*\*/i);
  const r2Match = content.match(/Vùng Kháng Cự Mạnh 2[^:]*:\s*\*\*([^*]+)\*\*/i);

  if (!signalMatch && !entryMatch && !slMatch) return null;

  const rawSignal = signalMatch ? signalMatch[1].trim() : 'PHÂN TÍCH THỊ TRƯỜNG';
  const confidence = signalMatch && signalMatch[2] ? signalMatch[2].trim() : '70%';
  const isLong = rawSignal.toUpperCase().includes('LONG') || rawSignal.toUpperCase().includes('MUA');
  const isShort = rawSignal.toUpperCase().includes('SHORT') || rawSignal.toUpperCase().includes('BÁN');

  return {
    coinSymbol: detectedCoin,
    rawSignal,
    confidence,
    isLong,
    isShort,
    entryZone: entryMatch ? entryMatch[1].trim() : null,
    stopLoss: slMatch ? slMatch[1].trim() : null,
    takeProfit1: tp1Match ? tp1Match[1].trim() : null,
    takeProfit2: tp2Match ? tp2Match[1].trim() : null,
    rrRatio: rrMatch ? rrMatch[1].trim() : '1 : 2.2',
    s1: s1Match ? s1Match[1].trim() : null,
    s2: s2Match ? s2Match[1].trim() : null,
    r1: r1Match ? r1Match[1].trim() : null,
    r2: r2Match ? r2Match[1].trim() : null
  };
}

export default function ChatBot({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  isLoading, 
  aiConfig,
  selectedSymbol = 'BTCUSDT'
}) {
  const [inputText, setInputText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyMessage = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatBoldAndCode = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="highlight-text">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  };

  const renderFormattedContent = (content) => {
    const tradePlan = parseTradePlan(content, selectedSymbol);
    const lines = content.split('\n');

    return (
      <div className="msg-rich-container">
        {/* If this message contains an actionable trade plan, render a beautiful Visual Card */}
        {tradePlan && (
          <div className={`chat-trade-card ${tradePlan.isLong ? 'tc-long' : tradePlan.isShort ? 'tc-short' : 'tc-wait'}`}>
            <div className="tc-header">
              <div className="tc-badge-group">
                <span className={`tc-action-badge ${tradePlan.isLong ? 'badge-buy' : tradePlan.isShort ? 'badge-sell' : 'badge-wait'}`}>
                  {tradePlan.isLong ? <ArrowUpRight size={14} /> : tradePlan.isShort ? <ArrowDownRight size={14} /> : <Target size={14} />}
                  <span>{tradePlan.rawSignal}</span>
                </span>
                <span className="tc-conf-pill">Độ tin cậy: <strong>{tradePlan.confidence}</strong></span>
              </div>
              <span className="tc-timeframe-tag">{tradePlan.coinSymbol || 'BTC/USDT'} (1H/4H)</span>
            </div>

            {/* 4 Metric Boxes */}
            <div className="tc-metrics-grid">
              {tradePlan.entryZone && (
                <div className="tc-metric-box">
                  <span className="tc-m-label">🎯 Vùng Vào (Entry)</span>
                  <span className="tc-m-val font-mono">{tradePlan.entryZone}</span>
                </div>
              )}
              {tradePlan.stopLoss && (
                <div className="tc-metric-box tc-box-sl">
                  <span className="tc-m-label">🛑 Cắt Lỗ (Stop Loss)</span>
                  <span className="tc-m-val font-mono text-red">{tradePlan.stopLoss}</span>
                </div>
              )}
              {tradePlan.takeProfit1 && (
                <div className="tc-metric-box tc-box-tp1">
                  <span className="tc-m-label">🚀 Chốt Lời 1 (TP1)</span>
                  <span className="tc-m-val font-mono text-green">{tradePlan.takeProfit1}</span>
                </div>
              )}
              {tradePlan.takeProfit2 && (
                <div className="tc-metric-box tc-box-tp2">
                  <span className="tc-m-label">🏆 Chốt Lời 2 (TP2)</span>
                  <span className="tc-m-val font-mono text-cyan">{tradePlan.takeProfit2}</span>
                </div>
              )}
            </div>

            {/* S/R Highlight Pills */}
            {(tradePlan.s1 || tradePlan.r1) && (
              <div className="tc-sr-pills">
                {tradePlan.s1 && <span className="tc-sr-tag tag-support">🟢 Hỗ trợ S1: {tradePlan.s1}</span>}
                {tradePlan.s2 && <span className="tc-sr-tag tag-support-hard">🟢 Đáy S2: {tradePlan.s2}</span>}
                {tradePlan.r1 && <span className="tc-sr-tag tag-resist">🔴 Kháng cự R1: {tradePlan.r1}</span>}
                {tradePlan.r2 && <span className="tc-sr-tag tag-resist-hard">🔴 Cản R2: {tradePlan.r2}</span>}
              </div>
            )}

            {/* Risk & Trailing Footer */}
            <div className="tc-footer">
              <span className="tc-sub-pill">⚖️ R:R: <strong>{tradePlan.rrRatio}</strong></span>
              <span className="tc-sub-pill">🛡️ Trailing SL: <strong>+15% Hòa vốn</strong></span>
              <span className="tc-sub-pill">⚡ Đòn bẩy: <strong>5x - 15x</strong></span>
            </div>
          </div>
        )}

        {/* Detailed Explanation / Reasoning lines */}
        <div className="msg-text-body">
          {lines.map((line, idx) => {
            if (line.startsWith('### ')) {
              return <h3 key={idx} className="msg-h3">{line.replace('### ', '')}</h3>;
            }
            if (line.startsWith('#### ')) {
              return <h4 key={idx} className="msg-h4">{line.replace('#### ', '')}</h4>;
            }
            if (line.trim() === '---') {
              return <hr key={idx} className="msg-divider" />;
            }
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
              const text = line.trim().substring(2);
              return (
                <li key={idx} className="msg-li">
                  <span dangerouslySetInnerHTML={{ __html: formatBoldAndCode(text) }} />
                </li>
              );
            }
            if (/^\d+\.\s/.test(line.trim())) {
              return (
                <div key={idx} className="msg-numbered">
                  <span dangerouslySetInnerHTML={{ __html: formatBoldAndCode(line.trim()) }} />
                </div>
              );
            }
            if (!line.trim()) {
              return <div key={idx} className="msg-spacer" />;
            }
            return (
              <p key={idx} className="msg-p" dangerouslySetInnerHTML={{ __html: formatBoldAndCode(line) }} />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="chatbot-wrapper">
      {/* Bot Header */}
      <div className="chatbot-header">
        <div className="bot-info">
          <div className="bot-avatar">
            <Bot size={18} />
          </div>
          <div>
            <div className="bot-name flex-align gap-2">
              <span>AI Crypto Trading Advisor</span>
              <span className="status-dot-active" title="Quant Engine Online" />
            </div>
            <div className="bot-sub">
              {aiConfig?.provider === 'gemini' && aiConfig.geminiKey
                ? `Google Gemini (${aiConfig.geminiModel})`
                : aiConfig?.provider === 'openai' && aiConfig.openaiKey
                  ? `OpenAI (${aiConfig.openaiModel})`
                  : 'Built-in Quant Engine 24/7 (Đa Khung 1H/4H/1D)'}
            </div>
          </div>
        </div>

        <div className="bot-actions">
          <button 
            className="btn-icon-subtle" 
            onClick={onClearChat} 
            title="Xóa lịch sử đoạn chat"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="messages-scroll-area">
        {messages.map((msg, index) => {
          const isBot = msg.role !== 'user';
          return (
            <div key={index} className={`message-row ${isBot ? 'msg-bot' : 'msg-user'}`}>
              <div className="msg-avatar">
                {isBot ? <Sparkles size={15} /> : <User size={15} />}
              </div>
              <div className="msg-bubble">
                <div className="msg-content">
                  {renderFormattedContent(msg.content)}
                </div>

                <div className="msg-bubble-footer">
                  <span className="msg-time flex-align gap-1 font-mono">
                    <Clock size={10} />
                    <span>{msg.time || ''}</span>
                  </span>

                  {isBot && (
                    <button
                      className="btn-copy-bubble"
                      onClick={() => handleCopyMessage(msg.content, index)}
                      title="Sao chép toàn bộ phân tích"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check size={11} className="text-green" />
                          <span className="text-green">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="message-row msg-bot">
            <div className="msg-avatar animate-pulse">
              <Sparkles size={15} />
            </div>
            <div className="msg-bubble typing-bubble">
              <span className="dot-pulse" />
              <span className="dot-pulse" />
              <span className="dot-pulse" />
              <span className="typing-text">AI đang phân tích nến 1H/4H, vùng Hỗ trợ/Kháng cự & tin vĩ mô...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="quick-prompts-bar">
        {QUICK_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              className="quick-chip"
              disabled={isLoading}
              onClick={() => onSendMessage(item.prompt)}
              title={item.prompt}
            >
              <Icon size={12} className="text-cyan" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Area */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hỏi AI phân tích điểm vào lệnh, xu hướng, kháng cự..."
          rows={1}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="btn-send-chat" 
          disabled={!inputText.trim() || isLoading}
          title="Gửi câu hỏi"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
