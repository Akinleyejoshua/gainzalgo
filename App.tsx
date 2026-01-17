import React, { useState, useEffect, useRef } from 'react';
import ControlPanel from './components/ControlPanel';
import CandlestickChart from './components/CandlestickChart';
import LiveTicker from './components/LiveTicker';
import AnalysisModal from './components/AnalysisModal';
import { SymbolDef, AlgoConfig, Candle, Signal } from './types';
import { SUPPORTED_SYMBOLS, TIMEFRAMES } from './constants';
import { fetchHistory, updateCandleWithTick, fetchLatestTick, calculateSignals } from './services/marketService';
import { analyzeMarket } from './services/aiService';

const DEFAULT_CONFIG: AlgoConfig = {
  sensitivity: 5,
  riskReward: 2.0,
  trendFilter: true,
  showTP: true,
  showSL: true,
  atrPeriod: 14,
  strategy: 'MOMENTUM',
  useRSIFilter: false,
  useVolumeFilter: false
};

const App: React.FC = () => {
  // --- State with LocalStorage Persistence ---

  const [symbol, setSymbol] = useState<SymbolDef>(() => {
    const saved = localStorage.getItem('gainzalgo_symbol_id');
    return SUPPORTED_SYMBOLS.find(s => s.id === saved) || SUPPORTED_SYMBOLS[0];
  });

  const [timeframe, setTimeframe] = useState<string>(() => {
    return localStorage.getItem('gainzalgo_timeframe') || '1m';
  });

  const [config, setConfig] = useState<AlgoConfig>(() => {
    const saved = localStorage.getItem('gainzalgo_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [data, setData] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);

  // Track previous symbol to detect what kind of change triggered the effect
  const prevSymbolRef = useRef<string>(symbol.id);

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Refs for interval management
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('gainzalgo_symbol_id', symbol.id);
  }, [symbol]);

  useEffect(() => {
    localStorage.setItem('gainzalgo_timeframe', timeframe);
  }, [timeframe]);

  useEffect(() => {
    localStorage.setItem('gainzalgo_config', JSON.stringify(config));
  }, [config]);

  // --- Logic ---

  // Handle Symbol Change Wrapper to prevent stale data render
  const handleSymbolChange = (newSymbol: SymbolDef) => {
    if (newSymbol.id === symbol.id) return;
    setData([]); // Clear data immediately to unmount chart and prevent stale data issues
    setSymbol(newSymbol);
  };

  // Initialize Data on Symbol/Timeframe Change
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // Clear data immediately to show loading state if symbol changed
      if (prevSymbolRef.current !== symbol.id) {
        setData([]);
        prevSymbolRef.current = symbol.id;
      }

      const initialData = await fetchHistory(symbol, timeframe, 300);

      if (isMounted) {
        setData(initialData);
        setSignals(calculateSignals(initialData, config));
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [symbol, timeframe]);

  // Recalculate signals if config changes or data updates
  useEffect(() => {
    if (data.length > 0) {
      setSignals(calculateSignals(data, config));
    }
  }, [config, data]);

  // Live Tick Updates (Real Price Polling)
  useEffect(() => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    const updateTick = async () => {
      // Fetch latest real price
      const realPrice = await fetchLatestTick(symbol);

      setData(prevData => {
        if (prevData.length === 0) return prevData;

        const lastCandle = prevData[prevData.length - 1];
        const currentTfRecord = TIMEFRAMES.find(t => t.id === timeframe);
        const currentTfMs = currentTfRecord?.ms || 60000;
        const now = Date.now();

        // Check if we need a new candle
        if (now - lastCandle.time >= currentTfMs) {
          const newCandleBase = {
            ...lastCandle,
            time: lastCandle.time + currentTfMs,
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close,
            volume: 0
          };
          // Start the new candle with the real price if available
          const newCandle = updateCandleWithTick(newCandleBase, symbol.volatility, realPrice ?? undefined);
          const newData = [...prevData, newCandle];
          return newData.slice(-1000);
        } else {
          // Update existing candle
          const updatedCandle = updateCandleWithTick(lastCandle, symbol.volatility, realPrice ?? undefined);
          const newData = [...prevData];
          newData[newData.length - 1] = updatedCandle;
          return newData;
        }
      });
    };

    // Poll for real price every 2 seconds for efficiency, 
    // while we can still simulate small movements in between if we wanted, 
    // but here we'll just stick to real updates.
    tickIntervalRef.current = setInterval(updateTick, 2000);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [symbol, timeframe]);

  // AI Handler
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeMarket(symbol, timeframe, data, signals);
    setAnalysisResult(result);
    setIsAnalyzing(false);
    setShowAnalysis(true);
  };

  // --- Render ---
  return (
    <div className="flex h-screen w-screen bg-[#0d0e12] text-white overflow-hidden">
      {/* Sidebar Controls */}
      <ControlPanel
        currentSymbol={symbol}
        currentTimeframe={timeframe}
        config={config}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={setTimeframe}
        onConfigChange={setConfig}
        onAIAnalysis={handleAIAnalysis}
        isAnalyzing={isAnalyzing}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <LiveTicker
          symbol={symbol}
          currentCandle={data.length > 0 ? data[data.length - 1] : { time: 0, open: 0, close: 0, high: 0, low: 0, volume: 0 }}
        />

        <div className="flex-1 relative p-2 bg-[#0d0e12] flex items-center justify-center">
          {data.length > 0 ? (
            <CandlestickChart
              key={`${symbol.id}-${timeframe}`}
              data={data}
              signals={signals}
              config={config}
              symbolId={symbol.id}
              timeframeId={timeframe}
            />
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-4">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-500 font-mono text-sm animate-pulse">Initializing {symbol.name}...</span>
            </div>
          )}
        </div>
      </div>

      <AnalysisModal
        isOpen={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        content={analysisResult}
      />
    </div>
  );
};

export default App;