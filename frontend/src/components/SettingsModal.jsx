import React, { useState, useEffect } from 'react';
import { X, Key, Shield, ExternalLink, Cpu, Check, Eye, EyeOff, Send } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, config, onSaveConfig }) {
  if (!isOpen) return null;

  const [provider, setProvider] = useState(config.provider || 'gemini');
  const [geminiKey, setGeminiKey] = useState(config.geminiKey || '');
  const [geminiModel, setGeminiModel] = useState(config.geminiModel || 'gemini-2.5-flash');
  const [openaiKey, setOpenaiKey] = useState(config.openaiKey || '');
  const [openaiModel, setOpenaiModel] = useState(config.openaiModel || 'gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Telegram 24/7 Bot State
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestMsg, setTelegramTestMsg] = useState('');

  useEffect(() => {
    fetch('/api/telegram/config')
      .then(r => r.json())
      .then(d => {
        if (d && d.chatId) setTelegramChatId(d.chatId);
      })
      .catch(() => {});
  }, []);

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramTestMsg('');
    try {
      if (telegramToken || telegramChatId) {
        await fetch('/api/telegram/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: telegramToken, chatId: telegramChatId })
        });
      }
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTelegramTestMsg('✅ Gửi tin nhắn thử nghiệm thành công! Vui lòng kiểm tra Telegram.');
      } else {
        setTelegramTestMsg('⚠️ Gửi thất bại. Hãy kiểm tra lại Bot Token và Chat ID.');
      }
    } catch {
      setTelegramTestMsg('⚠️ Không thể kết nối tới server.');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSaveConfig({
      provider,
      geminiKey: geminiKey.trim(),
      geminiModel,
      openaiKey: openaiKey.trim(),
      openaiModel
    });

    if (telegramToken || telegramChatId) {
      fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken.trim(), chatId: telegramChatId.trim() })
      }).catch(() => {});
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <Cpu size={20} className="text-cyan" />
            <h3>Cấu Hình AI & API Key</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="modal-body">
          {/* Provider Selection */}
          <div className="form-group">
            <label className="form-label">Chọn Nhà Cung Cấp AI:</label>
            <div className="provider-grid">
              <div 
                className={`provider-card ${provider === 'gemini' ? 'active' : ''}`}
                onClick={() => setProvider('gemini')}
              >
                <div className="provider-badge-icon gemini-icon">✦</div>
                <div className="provider-info">
                  <div className="provider-name">Google Gemini</div>
                  <div className="provider-desc">Khuyên dùng (Miễn phí, cực nhanh)</div>
                </div>
              </div>

              <div 
                className={`provider-card ${provider === 'openai' ? 'active' : ''}`}
                onClick={() => setProvider('openai')}
              >
                <div className="provider-badge-icon openai-icon">✹</div>
                <div className="provider-info">
                  <div className="provider-name">OpenAI (ChatGPT)</div>
                  <div className="provider-desc">GPT-4o Mini & GPT-4o</div>
                </div>
              </div>

              <div 
                className={`provider-card ${provider === 'builtin' ? 'active' : ''}`}
                onClick={() => setProvider('builtin')}
              >
                <div className="provider-badge-icon builtin-icon">⚡</div>
                <div className="provider-info">
                  <div className="provider-name">Built-in Quant Engine</div>
                  <div className="provider-desc">Phân tích kỹ thuật (Không cần Key)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Gemini Settings */}
          {provider === 'gemini' && (
            <div className="provider-settings-box">
              <div className="form-group">
                <div className="flex-between">
                  <label className="form-label">Google Gemini API Key:</label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="link-external"
                  >
                    <span>Lấy Key miễn phí tại Google AI Studio</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="input-with-icon">
                  <Key size={15} className="input-icon" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="form-input"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-eye" 
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="field-hint">
                  API Key được lưu an toàn 100% trong LocalStorage trình duyệt của bạn, không gửi qua bất kỳ máy chủ trung gian nào.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Chọn Mô Hình Gemini:</label>
                <select 
                  className="form-select" 
                  value={geminiModel} 
                  onChange={(e) => setGeminiModel(e.target.value)}
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Mới nhất, siêu nhanh & chính xác)</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Tối ưu tốc độ)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Phân tích kỹ thuật)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ổn định)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Lập luận sâu khung 4H/1D)</option>
                </select>
              </div>
            </div>
          )}

          {/* OpenAI Settings */}
          {provider === 'openai' && (
            <div className="provider-settings-box">
              <div className="form-group">
                <div className="flex-between">
                  <label className="form-label">OpenAI API Key:</label>
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noreferrer"
                    className="link-external"
                  >
                    <span>Lấy OpenAI Key</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <div className="input-with-icon">
                  <Key size={15} className="input-icon" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="form-input"
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn-toggle-eye" 
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Chọn Mô Hình OpenAI:</label>
                <select 
                  className="form-select" 
                  value={openaiModel} 
                  onChange={(e) => setOpenaiModel(e.target.value)}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Nhanh & tiết kiệm)</option>
                  <option value="gpt-4o">GPT-4o (Mạnh nhất)</option>
                </select>
              </div>
            </div>
          )}

          {/* Builtin info */}
          {provider === 'builtin' && (
            <div className="provider-settings-box builtin-info-box">
              <Shield size={22} className="text-cyan" />
              <div>
                <strong>Chế độ Phân tích Lượng tử Cục bộ (Built-in Quant Engine)</strong>
                <p>Hệ thống tự động tính toán hợp lưu chỉ báo (EMA 20/50/200, RSI 14, MACD, Support/Resistance Breakout) theo thuật toán kỹ thuật mà không cần bất kỳ API key nào.</p>
              </div>
            </div>
          )}

          {/* Telegram Bot 24/7 Notifications Configuration */}
          <div className="form-group" style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <div className="flex-between">
              <label className="form-label font-semibold text-cyan flex-align" style={{ gap: '6px' }}>
                <Send size={15} />
                <span>Thông Báo Lệnh Telegram Bot 24/7</span>
              </label>
              <button 
                type="button" 
                className="btn-text-action text-xs"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                style={{ background: 'rgba(0, 229, 255, 0.1)', border: '1px solid var(--border-cyan)', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                {testingTelegram ? 'Đang gửi...' : 'Gửi tin nhắn thử nghiệm'}
              </button>
            </div>
            <p className="text-xs text-muted" style={{ margin: '4px 0 10px 0' }}>
              Tự động gửi thông báo về điện thoại khi Khớp Lệnh, Dời Stop Loss về Hòa Vốn, Chốt Lời / Cắt Lỗ.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="text-xs text-muted">Telegram Bot Token:</label>
                <input
                  type="password"
                  className="form-input text-xs font-mono"
                  placeholder="123456789:ABCdefGhI..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Telegram Chat ID:</label>
                <input
                  type="text"
                  className="form-input text-xs font-mono"
                  placeholder="Nhập Chat ID hoặc @username"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                />
              </div>
            </div>
            {telegramTestMsg && (
              <p className={`text-xs mt-1 ${telegramTestMsg.includes('thành công') ? 'text-green' : 'text-red'}`} style={{ marginTop: '8px' }}>
                {telegramTestMsg}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              {savedSuccess ? (
                <>
                  <Check size={16} />
                  <span>Đã lưu thành công!</span>
                </>
              ) : (
                'Lưu cấu hình'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
