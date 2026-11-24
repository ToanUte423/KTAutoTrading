import React from 'react';
import { 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  PauseCircle, 
  Trash2, 
  Clock, 
  ShieldAlert, 
  Target,
  Download
} from 'lucide-react';

export default function SignalJournal({ journal, onClearJournal, isBotActive, scanIntervalSec }) {
  const total = journal.length;
  const longCount = journal.filter(j => j.action === 'BUY').length;
  const shortCount = journal.filter(j => j.action === 'SELL').length;

  return (
    <div className="journal-wrapper">
      {/* Header */}
      <div className="journal-header">
        <div className="journal-title-group">
          <div className="journal-avatar">
            <History size={18} />
          </div>
          <div>
            <div className="journal-title">Nhật Ký Tín Hiệu 24/7</div>
            <div className="journal-sub">
              Trạng thái Bot: <span className={isBotActive ? 'text-green font-semibold' : 'text-amber'}>
                {isBotActive ? `Đang quét liên tục (${scanIntervalSec}s / lần)` : 'Tạm dừng'}
              </span>
            </div>
          </div>
        </div>

        {total > 0 && (
          <button 
            className="btn-icon-subtle" 
            onClick={onClearJournal}
            title="Xóa lịch sử nhật ký"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="journal-stats-bar">
        <div className="j-stat-item">
          <span className="j-stat-label">Tổng quét:</span>
          <span className="j-stat-val font-mono">{total}</span>
        </div>
        <div className="j-stat-item">
          <span className="j-stat-label">Lệnh Long:</span>
          <span className="j-stat-val font-mono text-green">{longCount}</span>
        </div>
        <div className="j-stat-item">
          <span className="j-stat-label">Lệnh Short:</span>
          <span className="j-stat-val font-mono text-red">{shortCount}</span>
        </div>
      </div>

      {/* Journal Table/List */}
      <div className="journal-scroll-area">
        {total === 0 ? (
          <div className="journal-empty">
            <Clock size={28} className="text-muted" />
            <p>Chưa có lịch sử tín hiệu tự động.</p>
            <span>Khi bật <strong>"Bot Quét 24/7"</strong>, các tín hiệu vào lệnh MUA / BÁN sẽ được tự động lưu lại tại đây kèm âm thanh thông báo.</span>
          </div>
        ) : (
          journal.map((entry, index) => {
            const isBuy = entry.action === 'BUY';
            const isSell = entry.action === 'SELL';
            return (
              <div 
                key={index} 
                className={`journal-entry-card ${isBuy ? 'entry-buy' : isSell ? 'entry-sell' : 'entry-wait'}`}
              >
                <div className="j-entry-top">
                  <div className="j-entry-action">
                    {isBuy && <ArrowUpCircle size={15} className="text-green" />}
                    {isSell && <ArrowDownCircle size={15} className="text-red" />}
                    {!isBuy && !isSell && <PauseCircle size={15} className="text-amber" />}
                    <span className="j-action-text">{entry.signalType}</span>
                  </div>
                  <span className="j-entry-time font-mono">{entry.timestamp}</span>
                </div>

                <div className="j-entry-grid font-mono">
                  <div>
                    <span className="j-label">Giá lúc quét:</span>
                    <span className="j-val">${entry.price?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="j-label">Vào lệnh:</span>
                    <span className="j-val text-cyan">{entry.entryZone}</span>
                  </div>
                  <div>
                    <span className="j-label">Cắt lỗ:</span>
                    <span className="j-val text-red">
                      {typeof entry.stopLoss === 'number' ? `$${entry.stopLoss.toLocaleString()}` : entry.stopLoss}
                    </span>
                  </div>
                  <div>
                    <span className="j-label">Chốt lời 1:</span>
                    <span className="j-val text-green">
                      {typeof entry.takeProfit1 === 'number' ? `$${entry.takeProfit1.toLocaleString()}` : entry.takeProfit1}
                    </span>
                  </div>
                </div>

                <div className="j-entry-footer">
                  <span className="j-confidence">Độ tin cậy: <strong>{entry.confidence}%</strong></span>
                  <span className="j-rr">R:R: <strong>{entry.riskRewardRatio}</strong></span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
