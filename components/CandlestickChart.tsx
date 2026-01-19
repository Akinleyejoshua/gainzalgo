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
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);

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
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2f303b',
        timeVisible: true,
        secondsVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.candleUp,
      downColor: CHART_COLORS.candleDown,
      borderVisible: false,
      wickUpColor: CHART_COLORS.candleUp,
      wickDownColor: CHART_COLORS.candleDown,
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: '#00d68f',
      topColor: 'rgba(0, 214, 143, 0.4)',
      bottomColor: 'rgba(0, 214, 143, 0.0)',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    areaSeriesRef.current = areaSeries;

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
      areaSeriesRef.current = null;
      loadedContextId.current = null; // Reset context on unmount
    };
  }, []);

  // --- Unified Data Effect ---
  useEffect(() => {
    if (!seriesRef.current || !areaSeriesRef.current || !chartRef.current || data.length === 0) return;

    const is1s = timeframeId === '1s';
    const currentContextId = `${symbolId}-${timeframeId}`;
    const isContextSwitch = loadedContextId.current !== currentContextId;

    // Toggle visibility based on timeframe
    seriesRef.current.applyOptions({ visible: !is1s });
    areaSeriesRef.current.applyOptions({ visible: is1s });

    // Determine precision from the latest price
    const lastPrice = data[data.length - 1].close;
    const precision = getPrecision(lastPrice);
    const minMove = 1 / Math.pow(10, precision);

    const activeSeries = is1s ? areaSeriesRef.current : seriesRef.current;

    activeSeries.applyOptions({
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: minMove,
      },
    });

    if (isContextSwitch) {
      // --- Full Data Set Reset ---
      if (is1s) {
        areaSeriesRef.current.setData(data.map(d => ({
          time: Math.floor(d.time / 1000) as UTCTimestamp,
          value: d.close,
        })));
      } else {
        seriesRef.current.setData(data.map(d => ({
          time: Math.floor(d.time / 1000) as UTCTimestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        })));
      }

      chartRef.current.timeScale().fitContent();
      loadedContextId.current = currentContextId;
      tpLineRef.current = null;
      slLineRef.current = null;
      entryLineRef.current = null;
    } else {
      // --- Live Update (Tick) ---
      const lastCandle = data[data.length - 1];
      try {
        if (is1s) {
          areaSeriesRef.current.update({
            time: Math.floor(lastCandle.time / 1000) as UTCTimestamp,
            value: lastCandle.close,
          });
        } else {
          seriesRef.current.update({
            time: Math.floor(lastCandle.time / 1000) as UTCTimestamp,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
          });
        }
      } catch (e) {
        console.warn("Chart update failed:", e);
      }
    }
  }, [data, symbolId, timeframeId]);

  // Track the last signal ID to prevent unnecessary line flickering
  const lastSignalIdRef = useRef<string | null>(null);

  // Track state to determine if we need to redraw lines (Refreshes on Toggle OR Value Update)
  const lastRenderedStateRef = useRef<{
    showTP: boolean;
    showSL: boolean;
    tpValue: number | null;
    slValue: number | null;
  }>({
    showTP: config.showTP,
    showSL: config.showSL,
    tpValue: null,
    slValue: null
  });

  // --- Signals & Markers Effect ---
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    // Update Markers
    // We update markers every render to ensure they match current signals state.
    const markers: SeriesMarker<UTCTimestamp>[] = signals.map(sig => {
      const isLong = sig.type === 'LONG';
      const isAI = sig.isAI;

      let color = isLong ? CHART_COLORS.signalLong : CHART_COLORS.signalShort;
      if (isAI) color = CHART_COLORS.aiSignal; // Purple for AI

      return {
        time: Math.floor(sig.candleTime / 1000) as UTCTimestamp,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: color,
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `${isAI ? '[AI] ' : ''}${isLong ? 'BUY' : 'SELL'} (${sig.confidence}%)`,
        size: isAI ? 3 : 2,
      };
    });

    seriesRef.current.setMarkers(markers);

    // --- Active Signal TP/SL Lines ---
    const latestSignal = signals[signals.length - 1];

    // Check if we need to update lines
    // Update if:
    // 1. No latest signal (clear lines)
    // 2. Latest signal ID is different from cached
    // 3. Latest signal status changed (e.g. cancelled/closed - though typically we only chart active)

    if (!latestSignal || latestSignal.status !== 'ACTIVE') {
      if (tpLineRef.current) { seriesRef.current.removePriceLine(tpLineRef.current); tpLineRef.current = null; }
      if (slLineRef.current) { seriesRef.current.removePriceLine(slLineRef.current); slLineRef.current = null; }
      if (entryLineRef.current) { seriesRef.current.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
      lastSignalIdRef.current = null;
      return;
    }

    // Track config state to allow redrawing lines when toggles change OR values change
    const stateChanged =
      lastRenderedStateRef.current.showTP !== config.showTP ||
      lastRenderedStateRef.current.showSL !== config.showSL ||
      lastRenderedStateRef.current.tpValue !== latestSignal.takeProfit ||
      lastRenderedStateRef.current.slValue !== latestSignal.stopLoss;

    if (latestSignal.id === lastSignalIdRef.current && !stateChanged) {
      return;
    }

    // --- Redraw Lines ---

    // 1. Remove old lines
    if (tpLineRef.current) { seriesRef.current.removePriceLine(tpLineRef.current); tpLineRef.current = null; }
    if (slLineRef.current) { seriesRef.current.removePriceLine(slLineRef.current); slLineRef.current = null; }
    if (entryLineRef.current) { seriesRef.current.removePriceLine(entryLineRef.current); entryLineRef.current = null; }

    const isAI = latestSignal.isAI;

    // Entry Line
    entryLineRef.current = seriesRef.current.createPriceLine({
      price: latestSignal.entryPrice,
      color: isAI ? CHART_COLORS.aiEntryLine : CHART_COLORS.entryLine,
      lineWidth: isAI ? 2 : 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `${isAI ? '[AI] ' : ''}ENTRY`,
    });

    if (config.showTP) {
      tpLineRef.current = seriesRef.current.createPriceLine({
        price: latestSignal.takeProfit,
        color: isAI ? CHART_COLORS.aiTpLine : CHART_COLORS.tpLine,
        lineWidth: isAI ? 2 : 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${isAI ? '[AI] ' : ''}TP`,
      });
    }
    if (config.showSL) {
      slLineRef.current = seriesRef.current.createPriceLine({
        price: latestSignal.stopLoss,
        color: isAI ? CHART_COLORS.aiSlLine : CHART_COLORS.slLine,
        lineWidth: isAI ? 2 : 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${isAI ? '[AI] ' : ''}SL`,
      });
    }

    lastSignalIdRef.current = latestSignal.id;
    lastRenderedStateRef.current = {
      showTP: config.showTP,
      showSL: config.showSL,
      tpValue: latestSignal.takeProfit,
      slValue: latestSignal.stopLoss
    };

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