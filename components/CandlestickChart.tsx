import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LineStyle,
  SeriesMarker
} from 'lightweight-charts';
import { Candle, Signal, AlgoConfig } from '../types';
import { CHART_COLORS } from '../constants';

interface Props {
  data: Candle[];
  signals: Signal[];
  config: AlgoConfig;
  symbolId: string;
  timeframeId: string;
}

const CandlestickChart: React.FC<Props> = ({ data, signals, config, symbolId, timeframeId }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Track the current context loaded into the chart to preventing unnecessary full resets
  // Context = Symbol + Timeframe
  const loadedContextId = useRef<string | null>(null);

  // Lines refs
  const tpLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const entryLineRef = useRef<any>(null);

  // Helper to determine precision based on price
  const getPrecision = (price: number) => {
    if (price >= 1000) return 2;
    if (price >= 20) return 2;
    if (price >= 1) return 4;
    return 6;
  };

  // --- Initialization Effect ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d0e12' },
        textColor: '#82828b',
        fontFamily: 'JetBrains Mono',
      },
      grid: {
        vertLines: { color: '#1e1e24' },
        horzLines: { color: '#1e1e24' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2f303b',
      },
      timeScale: {
        borderColor: '#2f303b',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.candleUp,
      downColor: CHART_COLORS.candleDown,
      borderVisible: false,
      wickUpColor: CHART_COLORS.candleUp,
      wickDownColor: CHART_COLORS.candleDown,
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      loadedContextId.current = null; // Reset context on unmount
    };
  }, []);

  // --- Unified Data Effect ---
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || data.length === 0) return;

    const currentContextId = `${symbolId}-${timeframeId}`;
    const isContextSwitch = loadedContextId.current !== currentContextId;

    // Determine precision from the latest price
    const lastPrice = data[data.length - 1].close;
    const precision = getPrecision(lastPrice);
    const minMove = 1 / Math.pow(10, precision);

    seriesRef.current.applyOptions({
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      },
    });

    if (isContextSwitch) {
      // --- Full Data Set Reset ---
      // This runs only when Symbol or Timeframe changes, or on first load.
      const formattedData = data.map(d => ({
        time: Math.floor(d.time / 1000) as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      seriesRef.current.setData(formattedData);

      // Only fit content on a full reset, so we don't disturb user zoom during live updates
      chartRef.current.timeScale().fitContent();

      loadedContextId.current = currentContextId;

      // Clear lines on reset
      tpLineRef.current = null;
      slLineRef.current = null;
    } else {
      // --- Live Update (Tick) ---
      // This runs for every 100ms tick. 
      // We ONLY update the last candle to avoid expensive full redraws.
      // Even if 'data' array shifts (slices old data), we just keep appending/updating the head.
      const lastCandle = data[data.length - 1];

      try {
        seriesRef.current.update({
          time: Math.floor(lastCandle.time / 1000) as UTCTimestamp,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
        });
      } catch (e) {
        console.warn("Chart update failed (likely timing mismatch):", e);
      }
    }
  }, [data, symbolId, timeframeId]);

  // --- Signals & Markers Effect ---
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    // Update Markers
    // We update markers every render to ensure they match current signals state.
    // This is generally lightweight enough.
    const markers: SeriesMarker<UTCTimestamp>[] = signals.map(sig => {
      const isLong = sig.type === 'LONG';
      return {
        time: Math.floor(sig.candleTime / 1000) as UTCTimestamp,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: isLong ? CHART_COLORS.signalLong : CHART_COLORS.signalShort,
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `${isLong ? 'BUY' : 'SELL'} (${sig.confidence}%)`,
        size: 2,
      };
    });

    seriesRef.current.setMarkers(markers);

    // --- Active Signal TP/SL Lines ---
    // Efficiently manage price lines

    // 1. Remove old lines if they exist
    try {
      if (tpLineRef.current) {
        seriesRef.current.removePriceLine(tpLineRef.current);
        tpLineRef.current = null;
      }
      if (slLineRef.current) {
        seriesRef.current.removePriceLine(slLineRef.current);
        slLineRef.current = null;
      }
      if (entryLineRef.current) { // Remove entry line
        seriesRef.current.removePriceLine(entryLineRef.current);
        entryLineRef.current = null;
      }
    } catch (e) {
      // Ignore removal errors if series is fresh
    }

    // 2. Add new lines for latest signal
    const latestSignal = signals[signals.length - 1];

    if (latestSignal && latestSignal.status === 'ACTIVE') {
      // Entry Line
      entryLineRef.current = seriesRef.current.createPriceLine({
        price: latestSignal.entryPrice,
        color: CHART_COLORS.entryLine,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'ENTRY',
      });

      if (config.showTP) {
        tpLineRef.current = seriesRef.current.createPriceLine({
          price: latestSignal.takeProfit,
          color: CHART_COLORS.tpLine,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'TP',
        });
      }
      if (config.showSL) {
        slLineRef.current = seriesRef.current.createPriceLine({
          price: latestSignal.stopLoss,
          color: CHART_COLORS.slLine,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'SL',
        });
      }
    }

  }, [signals, config, data]); // Added data dependency to redraw lines if chart context refreshes

  return (
    <div className="w-full h-full relative" ref={chartContainerRef}>
      <div className="absolute top-2 left-2 z-10 opacity-30 pointer-events-none">
        <span className="text-[10px] font-mono font-bold text-gray-500">GAINZALGO // {symbolId} // {timeframeId.toUpperCase()}</span>
      </div>
    </div>
  );
};

export default CandlestickChart;