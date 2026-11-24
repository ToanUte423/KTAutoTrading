import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers
} from 'lightweight-charts';
import {
  calculateEMA,
  calculateRSI,
  calculateBollingerBands
} from '../utils/indicators';
import {
  Layers,
  Maximize2,
  Target,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

// Helper to snap an order timestamp to the nearest candle time for Lightweight Charts
function findClosestCandleTime(candles, targetTimeSec) {
  if (!candles || candles.length === 0) return null;
  if (!targetTimeSec) return candles[candles.length - 1].time;
  
  let closest = candles[candles.length - 1].time;
  let minDiff = Infinity;
  for (let i = candles.length - 1; i >= 0; i--) {
    const diff = Math.abs(candles[i].time - targetTimeSec);
    if (diff < minDiff) {
      minDiff = diff;
      closest = candles[i].time;
    }
    if (diff === 0) break;
  }
  return closest;
}

// Prioritize 1h, 4h, 1D as preferred by user for HTF Support/Resistance swing trading
const TIMEFRAMES = [
  { label: '1H', value: '1h', isHTF: true },
  { label: '4H', value: '4h', isHTF: true },
  { label: '1D', value: '1d', isHTF: true },
  { label: '15m', value: '15m' },
  { label: '5m', value: '5m' }
];

export default function Chart({
  candles,
  timeframe,
  onTimeframeChange,
  signal,
  latestLiveCandle,
  snapshot,
  positions = [],
  trades = [],
  livePrice,
  symbol = 'BTCUSDT'
}) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);

  const chartRef = useRef(null);
  const rsiChartRef = useRef(null);

  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema20SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const markersPrimitiveRef = useRef(null);
  const srPriceLinesRef = useRef([]);

  const rsiSeriesRef = useRef(null);

  // Indicators toggle state
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showEMA200, setShowEMA200] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(true);
  const [showSRLines, setShowSRLines] = useState(true); // Toggle for S/R lines on chart
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  // Chart tooltip state
  const [hoveredCandle, setHoveredCandle] = useState(null);

  // Dataset tracking refs to prevent re-rendering entire chart on every live tick
  const lastRenderedKeyRef = useRef('');
  const lastCandleCountRef = useRef(0);

  // Reset hovered candle when symbol or timeframe changes
  useEffect(() => {
    setHoveredCandle(null);
  }, [symbol, timeframe]);

  // Initialize main chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0e131d' },
        textColor: '#848e9c',
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
        fontSize: 12
      },
      grid: {
        vertLines: { color: 'rgba(32, 42, 60, 0.6)', style: 1 },
        horzLines: { color: 'rgba(32, 42, 60, 0.6)', style: 1 }
      },
      crosshair: {
        mode: 1, // Magnet
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b'
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e293b'
        }
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (timestamp, tickMarkType) => {
          const date = new Date(timestamp * 1000);
          const opts = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
          // TickMarkType: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
          if (tickMarkType <= 1) {
            return date.toLocaleDateString('vi-VN', { ...opts, month: 'short', year: 'numeric' });
          } else if (tickMarkType === 2) {
            return date.toLocaleDateString('vi-VN', { ...opts, day: '2-digit', month: '2-digit' });
          } else {
            return date.toLocaleTimeString('vi-VN', { ...opts, hour: '2-digit', minute: '2-digit' });
          }
        }
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.12,
          bottom: 0.2
        }
      },
      localization: {
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      }
    });

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00e676',
      downColor: '#ff3366',
      borderVisible: false,
      wickUpColor: '#00e676',
      wickDownColor: '#ff3366'
    });

    // Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.82,
        bottom: 0
      }
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 }
    });

    // EMA Lines
    const ema20Series = chart.addSeries(LineSeries, {
      color: '#00f0ff',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'EMA 20'
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'EMA 50'
    });

    const ema200Series = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      priceLineVisible: false,
      title: 'EMA 200'
    });

    // Bollinger Bands
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(99, 102, 241, 0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      title: 'BB Upper'
    });
    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: 'rgba(99, 102, 241, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      title: 'BB Middle'
    });
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(99, 102, 241, 0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      title: 'BB Lower'
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candleSeries);
      if (data) {
        setHoveredCandle(data);
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Initialize RSI Sub-chart
  useEffect(() => {
    if (!rsiContainerRef.current || !showRSI) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      return;
    }

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { color: '#0a0e17' },
        textColor: '#848e9c',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10
      },
      grid: {
        vertLines: { color: 'rgba(32, 42, 60, 0.4)', style: 1 },
        horzLines: { color: 'rgba(32, 42, 60, 0.4)', style: 1 }
      },
      timeScale: {
        borderColor: '#1e293b',
        visible: false,
        timeVisible: true,
        tickMarkFormatter: (timestamp, tickMarkType) => {
          const date = new Date(timestamp * 1000);
          const opts = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
          if (tickMarkType <= 2) {
            return date.toLocaleDateString('vi-VN', { ...opts, day: '2-digit', month: '2-digit' });
          }
          return date.toLocaleTimeString('vi-VN', { ...opts, hour: '2-digit', minute: '2-digit' });
        }
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      crosshair: {
        vertLine: { color: '#3b82f6', width: 1, style: 3 },
        horzLine: { color: '#3b82f6', width: 1, style: 3 }
      },
      localization: {
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        }
      }
    });

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 2,
      priceLineVisible: true
    });

    rsiSeries.createPriceLine({
      price: 70,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '70 Quá Mua'
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '30 Quá Bán'
    });
    rsiSeries.createPriceLine({
      price: 50,
      color: '#64748b',
      lineWidth: 1,
      lineStyle: 3,
      axisLabelVisible: false,
      title: '50'
    });

    rsiChartRef.current = rsiChart;
    rsiSeriesRef.current = rsiSeries;

    if (chartRef.current) {
      const mainTimeScale = chartRef.current.timeScale();
      const rsiTimeScale = rsiChart.timeScale();

      mainTimeScale.subscribeVisibleLogicalRangeChange(range => {
        if (range && rsiChartRef.current) {
          rsiTimeScale.setVisibleLogicalRange(range);
        }
      });
      rsiTimeScale.subscribeVisibleLogicalRangeChange(range => {
        if (range && chartRef.current) {
          mainTimeScale.setVisibleLogicalRange(range);
        }
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (rsiContainerRef.current && rsiChart) {
        rsiChart.applyOptions({
          width: rsiContainerRef.current.clientWidth,
          height: rsiContainerRef.current.clientHeight
        });
      }
    });
    resizeObserver.observe(rsiContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      rsiChart.remove();
      rsiChartRef.current = null;
    };
  }, [showRSI]);

  // Update chart data when historical candles dataset changes
  useEffect(() => {
    if (!candles || candles.length === 0 || !candleSeriesRef.current) return;

    const currentKey = `${symbol}_${timeframe}`;
    const isNewDataset = lastRenderedKeyRef.current !== currentKey;
    const isBarCountChanged = Math.abs(candles.length - lastCandleCountRef.current) >= 1;

    // Only invoke heavy setData when dataset or bar count has legitimately changed
    if (isNewDataset || isBarCountChanged) {
      candleSeriesRef.current.setData(candles);
      markersPrimitiveRef.current = null;
      lastRenderedKeyRef.current = currentKey;
      lastCandleCountRef.current = candles.length;

      if (chartRef.current) {
        try {
          chartRef.current.priceScale('right').applyOptions({ autoScale: true });
          chartRef.current.timeScale().fitContent();
        } catch (e) {}
      }
    }

    if (volumeSeriesRef.current) {
      const volumeData = candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(0, 230, 118, 0.35)' : 'rgba(255, 51, 102, 0.35)'
      }));
      volumeSeriesRef.current.setData(showVolume ? volumeData : []);
    }

    if (ema20SeriesRef.current) {
      const ema20 = calculateEMA(candles, 20);
      ema20SeriesRef.current.setData(showEMA20 ? ema20 : []);
    }
    if (ema50SeriesRef.current) {
      const ema50 = calculateEMA(candles, 50);
      ema50SeriesRef.current.setData(showEMA50 ? ema50 : []);
    }
    if (ema200SeriesRef.current) {
      const ema200 = calculateEMA(candles, 200);
      ema200SeriesRef.current.setData(showEMA200 ? ema200 : []);
    }

    if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      if (showBB) {
        const bb = calculateBollingerBands(candles, 20, 2);
        bbUpperSeriesRef.current.setData(bb.map(b => ({ time: b.time, value: b.upper })));
        bbMiddleSeriesRef.current.setData(bb.map(b => ({ time: b.time, value: b.middle })));
        bbLowerSeriesRef.current.setData(bb.map(b => ({ time: b.time, value: b.lower })));
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbMiddleSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }

    if (rsiSeriesRef.current && showRSI) {
      const rsi = calculateRSI(candles, 14);
      rsiSeriesRef.current.setData(rsi);
    }

    // Candlestick Order Markers: Mũi tên Xanh hướng lên cho BUY, Mũi tên Đỏ hướng xuống cho SHORT
    if (candleSeriesRef.current && candles.length > 0) {
      const markers = [];
      const seenTimes = new Set();

      // Isolate positions and trades for the currently selected coin
      const cleanSym = (s) => (s || 'BTCUSDT').replace(/[^a-zA-Z]/g, '').toUpperCase();
      const targetSym = cleanSym(symbol);
      const coinPositions = (positions || []).filter(pos => cleanSym(pos.symbol) === targetSym);
      const coinTrades = (trades || []).filter(tr => cleanSym(tr.symbol) === targetSym);

      // 1. Vị thế đang mở (Active Bot Positions): Mua -> Mũi tên Xanh, Bán/Short -> Mũi tên Đỏ
      if (coinPositions.length > 0) {
        coinPositions.forEach((pos) => {
          const targetTime = pos.candleTime || Math.floor((pos.openedTimestamp || Date.now()) / 1000);
          const cTime = findClosestCandleTime(candles, targetTime);
          if (cTime) {
            const isLong = pos.side === 'LONG' || pos.side === 'BUY';
            markers.push({
              time: cTime,
              position: isLong ? 'belowBar' : 'aboveBar',
              color: isLong ? '#00e676' : '#ff3366',
              shape: isLong ? 'arrowUp' : 'arrowDown',
              text: isLong ? `LONG ${pos.leverage ? pos.leverage + 'x' : ''}` : `SHORT ${pos.leverage ? pos.leverage + 'x' : ''}`,
              size: 2
            });
            seenTimes.add(`${cTime}_${pos.side}`);
          }
        });
      }

      // 2. Lịch sử các lệnh đã đóng (Historical Bot Trades)
      if (coinTrades.length > 0) {
        coinTrades.slice(0, 30).forEach((tr) => {
          // 2.1 Mũi tên Vào Lệnh: Mua -> Mũi tên Xanh, Short -> Mũi tên Đỏ
          const targetTime = tr.candleTime || (tr.openedTimestamp ? Math.floor(tr.openedTimestamp / 1000) : null);
          if (targetTime) {
            const cTime = findClosestCandleTime(candles, targetTime);
            const isLong = tr.side === 'LONG' || tr.side === 'BUY';
            const entryKey = `${cTime}_${tr.side}_ENTRY`;
            if (cTime && !seenTimes.has(entryKey)) {
              markers.push({
                time: cTime,
                position: isLong ? 'belowBar' : 'aboveBar',
                color: isLong ? '#00e676' : '#ff3366',
                shape: isLong ? 'arrowUp' : 'arrowDown',
                text: isLong ? 'BUY' : 'SHORT',
                size: 2
              });
              seenTimes.add(entryKey);
            }
          }

          // 2.2 Mũi tên Đóng Lệnh: Màu Vàng (Yellow Arrow)
          const exitTime = tr.closedCandleTime || (tr.closedTimestamp ? Math.floor(tr.closedTimestamp / 1000) : null);
          if (exitTime) {
            const exitCTime = findClosestCandleTime(candles, exitTime);
            const isLong = tr.side === 'LONG' || tr.side === 'BUY';
            const exitKey = `${exitCTime}_${tr.id || tr.closedAt || exitTime}_EXIT`;
            if (exitCTime && !seenTimes.has(exitKey)) {
              const roeStr = tr.roePercent !== undefined && tr.roePercent !== null 
                ? ` (${tr.roePercent >= 0 ? '+' : ''}${tr.roePercent}%)` 
                : '';
              markers.push({
                time: exitCTime,
                position: isLong ? 'aboveBar' : 'belowBar',
                color: '#ffd600', // Mũi tên màu vàng khi đóng lệnh
                shape: isLong ? 'arrowDown' : 'arrowUp',
                text: `ĐÓNG${roeStr}`,
                size: 2
              });
              seenTimes.add(exitKey);
            }
          }
        });
      }

      // 3. Tín hiệu phân tích hiện tại (AI Signal Markers - chỉ hiển thị gợi ý khi không bị xung đột vị thế)
      if (signal && (signal.action === 'BUY' || signal.action === 'SELL')) {
        const hasActivePos = coinPositions.length > 0;
        const activeSide = hasActivePos ? coinPositions[0].side : null;
        const isLong = signal.action === 'BUY';
        const isConflictingOpposing = hasActivePos && ((activeSide === 'LONG' && !isLong) || (activeSide === 'SHORT' && isLong));

        // Ẩn tín hiệu gợi ý ngược chiều nếu bot đang quản lý 1 vị thế mở
        if (!isConflictingOpposing) {
          const lastCandle = candles[candles.length - 1];
          const key = `${lastCandle.time}_${isLong ? 'LONG' : 'SHORT'}`;
          if (!seenTimes.has(key)) {
            markers.push({
              time: lastCandle.time,
              position: isLong ? 'belowBar' : 'aboveBar',
              color: isLong ? '#00e676' : '#ff3366',
              shape: isLong ? 'arrowUp' : 'arrowDown',
              text: isLong ? 'BUY' : 'SHORT',
              size: 2
            });
          }
        }
      }

      // Sắp xếp thời gian tăng dần theo quy định nghiêm ngặt của lightweight-charts
      markers.sort((a, b) => a.time - b.time);

      try {
        if (!markersPrimitiveRef.current) {
          markersPrimitiveRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
        } else {
          try {
            markersPrimitiveRef.current.setMarkers(markers);
          } catch (err) {
            markersPrimitiveRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
          }
        }
      } catch (err) {
        // silent catch
      }
    }
  }, [candles, showEMA20, showEMA50, showEMA200, showVolume, showBB, showRSI, signal, positions, trades, symbol]);

  // Handle single realtime live candle tick
  useEffect(() => {
    if (!latestLiveCandle || !candleSeriesRef.current || !candles || candles.length === 0) return;

    // Safety: ensure live candle time is >= last candle time to avoid Lightweight Charts "Cannot update oldest data" error
    const lastCandle = candles[candles.length - 1];
    if (latestLiveCandle.time < lastCandle.time) return;

    // Safety: ensure live candle price magnitude matches current dataset (avoids applying $84k tick to $1.24 chart)
    if (lastCandle.close > 0) {
      const ratio = latestLiveCandle.close / lastCandle.close;
      if (ratio > 3 || ratio < 0.3) return;
    }

    try {
      candleSeriesRef.current.update(latestLiveCandle);

      if (volumeSeriesRef.current && showVolume && latestLiveCandle.volume !== undefined) {
        volumeSeriesRef.current.update({
          time: latestLiveCandle.time,
          value: latestLiveCandle.volume,
          color: latestLiveCandle.close >= latestLiveCandle.open
            ? 'rgba(0, 230, 118, 0.4)'
            : 'rgba(255, 51, 102, 0.4)'
        });
      }
    } catch (e) {
      // silent catch for disposed/transitional ticks
    }
  }, [latestLiveCandle, showVolume, candles]);

  // DRAW VISUAL SUPPORT & RESISTANCE PRICE LINES DIRECTLY ON THE CHART
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clean up previous lines
    srPriceLinesRef.current.forEach(line => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) { }
    });
    srPriceLinesRef.current = [];

    if (!showSRLines || !snapshot || !snapshot.supportResistance) return;

    const sr = snapshot.supportResistance;

    // Safety check: ensure S/R levels match the current candle price range (avoids drawing $84,000 BTC lines on a $1.24 SUI chart)
    if (candles && candles.length > 0) {
      const lastPrice = candles[candles.length - 1].close;
      if (lastPrice > 0 && sr.support1 && (sr.support1 > lastPrice * 3 || sr.support1 < lastPrice * 0.3)) {
        return; // Stale data from previous coin, skip drawing until new coin snapshot arrives
      }
    }

    const newLines = [];

    // Helper format price according to coin magnitude
    const fmt = (p) => {
      const val = Number(p);
      const dec = (val < 10 || symbol === 'SUIUSDT') ? 4 : 2;
      return val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    // 1. S1: Nearest Support Line (Green)
    if (sr.support1) {
      const lineS1 = candleSeriesRef.current.createPriceLine({
        price: sr.support1,
        color: '#00e676',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `🟢 HỖ TRỢ S1: $${fmt(sr.support1)}`
      });
      newLines.push(lineS1);
    }

    // 2. S2: Hard / Deep Support Line (Cyan)
    if (sr.support2 && sr.support2 !== sr.support1) {
      const lineS2 = candleSeriesRef.current.createPriceLine({
        price: sr.support2,
        color: '#00f0ff',
        lineWidth: 2,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: `🛡️ HỖ TRỢ CỨNG S2: $${fmt(sr.support2)}`
      });
      newLines.push(lineS2);
    }

    // 3. R1: Nearest Resistance Line (Red)
    if (sr.resistance1) {
      const lineR1 = candleSeriesRef.current.createPriceLine({
        price: sr.resistance1,
        color: '#ff3366',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `🔴 KHÁNG CỰ R1: $${fmt(sr.resistance1)}`
      });
      newLines.push(lineR1);
    }

    // 4. R2: Major Resistance Line (Purple/Magenta)
    if (sr.resistance2 && sr.resistance2 !== sr.resistance1) {
      const lineR2 = candleSeriesRef.current.createPriceLine({
        price: sr.resistance2,
        color: '#d946ef',
        lineWidth: 2,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: `⚠️ KHÁNG CỰ MẠNH R2: $${fmt(sr.resistance2)}`
      });
      newLines.push(lineR2);
    }

    srPriceLinesRef.current = newLines;

    return () => {
      newLines.forEach(line => {
        try {
          candleSeriesRef.current?.removePriceLine(line);
        } catch (e) { }
      });
    };
  }, [snapshot?.supportResistance, showSRLines, timeframe, symbol]);

  // Auto-fit chart immediately when timeframe or symbol changes
  useEffect(() => {
    if (chartRef.current && candles && candles.length > 0) {
      const t = setTimeout(() => {
        try { chartRef.current?.timeScale().fitContent(); } catch (e) {}
      }, 60);
      return () => clearTimeout(t);
    }
  }, [timeframe, symbol]);

  const fitChart = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const currentHover = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div className="chart-wrapper">
      {/* Chart Control Toolbar */}
      <div className="chart-toolbar">
        {/* Timeframe selector with HTF focus */}
        <div className="tf-group">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              className={`tf-btn ${timeframe === tf.value ? 'active' : ''} ${tf.isHTF ? 'htf-btn' : ''}`}
              onClick={() => onTimeframeChange(tf.value)}
              title={tf.isHTF ? `Khung lớn ${tf.label} (Phù hợp phân tích Hỗ Trợ/Kháng Cự)` : `Khung ${tf.label}`}
            >
              {tf.label}
              {tf.isHTF && <span className="htf-dot" />}
            </button>
          ))}
        </div>

        <div className="toolbar-divider" />

        {/* Toggle Support / Resistance Lines on Chart */}
        <button
          className={`btn-toolbar btn-sr-toggle ${showSRLines ? 'active-sr' : ''}`}
          onClick={() => setShowSRLines(!showSRLines)}
          title="Bật/Tắt đường kẻ Hỗ Trợ (Xanh) & Kháng Cự (Đỏ) trực tiếp trên biểu đồ"
        >
          <Target size={14} className={showSRLines ? 'text-green' : ''} />
          <span>{showSRLines ? 'Đang Kẻ Cản' : 'Hiện Đường Cản'}</span>
        </button>



        {/* Indicators Dropdown Menu */}
        <div className="relative">
          <button
            className={`btn-toolbar ${showIndicatorMenu ? 'active' : ''}`}
            onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
          >
            <Layers size={14} />
            <span>Chỉ Báo</span>
          </button>

          {showIndicatorMenu && (
            <div className="indicator-dropdown">
              <div className="dropdown-title">Chỉ Báo Kỹ Thuật</div>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showSRLines}
                  onChange={(e) => setShowSRLines(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#00e676' }} />
                <span>Kẻ Đường Hỗ Trợ & Kháng Cự (S/R)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showEMA20}
                  onChange={(e) => setShowEMA20(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#00f0ff' }} />
                <span>EMA 20 (Ngắn hạn)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showEMA50}
                  onChange={(e) => setShowEMA50(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#f59e0b' }} />
                <span>EMA 50 (Trung hạn)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showEMA200}
                  onChange={(e) => setShowEMA200(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#a855f7' }} />
                <span>EMA 200 (Dài hạn)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showBB}
                  onChange={(e) => setShowBB(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#6366f1' }} />
                <span>Bollinger Bands (20, 2)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#10b981' }} />
                <span>Khối Lượng (Volume)</span>
              </label>
              <label className="indicator-item">
                <input
                  type="checkbox"
                  checked={showRSI}
                  onChange={(e) => setShowRSI(e.target.checked)}
                />
                <span className="dot-indicator" style={{ background: '#eab308' }} />
                <span>RSI 14 (Chỉ số sức mạnh)</span>
              </label>
            </div>
          )}
        </div>

        {/* Live Candle OHLC Readout */}
        {currentHover && (
          <div className="ohlc-bar font-mono hide-sm">
            {(() => {
              const dec = (symbol === 'SUIUSDT' || (currentHover.close && currentHover.close < 10)) ? 4 : 2;
              const fmtOhlc = (v) => typeof v === 'number' ? v.toFixed(dec) : '---';
              return (
                <>
                  <span className="ohlc-item">
                    <span className="dim">O:</span>
                    <span className="val">{fmtOhlc(currentHover.open)}</span>
                  </span>
                  <span className="ohlc-item">
                    <span className="dim">H:</span>
                    <span className="val text-green">{fmtOhlc(currentHover.high)}</span>
                  </span>
                  <span className="ohlc-item">
                    <span className="dim">L:</span>
                    <span className="val text-red">{fmtOhlc(currentHover.low)}</span>
                  </span>
                  <span className="ohlc-item">
                    <span className="dim">C:</span>
                    <span className={`val ${currentHover.close >= currentHover.open ? 'text-green' : 'text-red'}`}>
                      {fmtOhlc(currentHover.close)}
                    </span>
                  </span>
                </>
              );
            })()}
          </div>
        )}

        <button
          className="btn-toolbar ml-auto"
          onClick={fitChart}
          title="Tự động căn chỉnh biểu đồ (Fit View)"
        >
          <Maximize2 size={13} />
          <span>Vừa màn hình</span>
        </button>
      </div>

      {/* Main Candlestick Chart Canvas */}
      <div
        ref={chartContainerRef}
        className="main-chart-canvas"
        style={{ height: showRSI ? 'calc(100% - 155px)' : 'calc(100% - 40px)', position: 'relative' }}
      />

      {/* RSI Sub-pane */}
      {showRSI && (
        <div className="rsi-pane-container">
          <div className="rsi-header">
            <span className="rsi-title">RSI (14)</span>
            <span className="rsi-legend">
              <span className="text-red">Quá mua (70)</span> | <span className="text-green">Quá bán (30)</span>
            </span>
          </div>
          <div ref={rsiContainerRef} className="rsi-chart-canvas" />
        </div>
      )}
    </div>
  );
}
