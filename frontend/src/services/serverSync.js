/**
 * Frontend Synchronization Service with Raspberry Pi 5 Backend Daemon
 * On localhost: connects directly to port 5001
 * On public domain (via nginx/Cloudflare Tunnel): uses same-origin /ws path
 */

const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getWsUrl = () => {
  if (isLocalhost) return `ws://localhost:5001/ws`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
};

const getHttpUrl = () => {
  if (isLocalhost) return 'http://localhost:5001';
  return `${window.location.protocol}//${window.location.host}`;
};


export class ServerSyncService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.listeners = new Set();
    this.reconnectTimer = null;
  }

  connect(callbacks = {}) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('🟢 [SERVER SYNC] Connected to Pi 5 24/7 Backend Daemon on port 5001.');
        if (callbacks.onStatusChange) callbacks.onStatusChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (callbacks.onMessage) {
            callbacks.onMessage(type, payload);
          }
          this.notifyListeners(type, payload);
        } catch (err) {
          console.error('Error parsing server sync message:', err);
        }
      };

      this.ws.onerror = (err) => {
        // Silent catch for dev without backend
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (callbacks.onStatusChange) callbacks.onStatusChange(false);
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect(callbacks);
          }, 4000);
        }
      };
    } catch (e) {
      this.isConnected = false;
      if (callbacks.onStatusChange) callbacks.onStatusChange(false);
    }
  }

  notifyListeners(type, payload) {
    for (const fn of this.listeners) {
      try { fn(type, payload); } catch (e) {}
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async fetchStatus() {
    try {
      const res = await fetch(`${getHttpUrl()}/api/status`);
      if (res.ok) return await res.json();
    } catch (e) {
      // Backend offline
    }
    return null;
  }

  async closePosition(id, reason = 'Đóng qua Web Terminal', exitPrice = null) {
    try {
      const res = await fetch(`${getHttpUrl()}/api/position/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason, exitPrice })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to close position on server:', e);
    }
    return null;
  }

  async resetAccount() {
    try {
      const res = await fetch(`${getHttpUrl()}/api/account/reset`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to reset account on server:', e);
    }
    return null;
  }

  async toggleAutoTrade() {
    try {
      const res = await fetch(`${getHttpUrl()}/api/auto-trade/toggle`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to toggle auto trade on server:', e);
    }
    return null;
  }
}

export const serverSync = new ServerSyncService();
