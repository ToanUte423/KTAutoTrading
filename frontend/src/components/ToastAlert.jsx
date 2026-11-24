import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, X, Bell } from 'lucide-react';

export default function ToastAlert({ toast, onClose }) {
  if (!toast) return null;

  const isBuy = toast.action === 'BUY';
  const isSell = toast.action === 'SELL';

  return (
    <div className={`toast-notification ${isBuy ? 'toast-buy' : isSell ? 'toast-sell' : 'toast-info'}`}>
      <div className="toast-icon">
        {isBuy && <ArrowUpCircle size={22} className="text-green" />}
        {isSell && <ArrowDownCircle size={22} className="text-red" />}
        {!isBuy && !isSell && <Bell size={22} className="text-cyan" />}
      </div>

      <div className="toast-content">
        <div className="toast-title-row">
          <span className="toast-title">{toast.title}</span>
          <span className="toast-time">{toast.time}</span>
        </div>
        <div className="toast-message">{toast.message}</div>
        {toast.entryZone && (
          <div className="toast-details font-mono">
            <span>Entry: <strong>{toast.entryZone}</strong></span>
            <span>SL: <strong>${toast.stopLoss?.toLocaleString()}</strong></span>
            <span>TP: <strong>${toast.takeProfit1?.toLocaleString()}</strong></span>
          </div>
        )}
      </div>

      <button className="toast-close-btn" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
