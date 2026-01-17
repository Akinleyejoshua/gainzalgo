import React, { useState, useEffect, useRef } from 'react';
import ControlPanel from './components/ControlPanel';
import CandlestickChart from './components/CandlestickChart';
import LiveTicker from './components/LiveTicker';
import AnalysisModal from './components/AnalysisModal';
import { X, Sliders } from 'lucide-react';
import { SymbolDef, AlgoConfig, Candle, Signal } from './types';
import { SUPPORTED_SYMBOLS, TIMEFRAMES } from './constants';
import { fetchHistory, updateCandleWithTick, fetchLatestTick, calculateSignals } from './services/marketService';
import { analyzeWithGemini } from './services/aiService';

const DEFAULT_CONFIG: AlgoConfig = {
  sensitivity: 5,
  riskReward: 2.0,
  trendFilter: true,
  showTP: true,
  showSL: true,
  atrPeriod: 14,
  strategy: 'MOMENTUM',
  useRSIFilter: false,
  useVolumeFilter: false,
  enableAISignals: false,
  aiModeEnabled: false
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
  const [aiSignals, setAiSignals] = useState<Signal[]>([]);
  const lastScannedCandleTime = useRef<number>(0);

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

    // Reset AI signals if AI enhancement is turned off
    if (!config.enableAISignals) {
      setAiSignals([]);
    }
  }, [config]);

  // --- Logic ---

  // Handle Symbol Change Wrapper to prevent stale data render
  const handleSymbolChange = (newSymbol: SymbolDef) => {
    if (newSymbol.id === symbol.id) return;
    setData([]); // Clear data immediately to unmount chart and prevent stale data issues
    setAiSignals([]); // Clear AI signals on symbol change
    setSymbol(newSymbol);
  };

  // Initialize Data on Symbol/Timeframe Change
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // Clear data immediately to show loading state if symbol changed
      if (prevSymbolRef.current !== symbol.id) {
        setData([]);
        setAiSignals([]);
        prevSymbolRef.current = symbol.id;
      }

      const initialData = await fetchHistory(symbol, timeframe, 300);

      if (isMounted) {
        setData(initialData);
        const techSignals = calculateSignals(initialData, config);
        setSignals(techSignals);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [symbol, timeframe]);

  // Recalculate signals if config changes or data updates
  useEffect(() => {
    if (data.length > 0) {
      const techSignals = calculateSignals(data, config);
      // Combine with AI signals if enabled
      if (config.enableAISignals) {
        const combined = [...techSignals, ...aiSignals];
        // Ensure signals are sorted by time for the chart markers
        combined.sort((a, b) => a.candleTime - b.candleTime);
        setSignals(combined);
      } else {
        setSignals(techSignals);
      }
    }
  }, [config, data, aiSignals]);

  // --- Real-time AI Signal Update ---
  useEffect(() => {
    let aiInterval: ReturnType<typeof setInterval> | null = null;

    if (config.enableAISignals && data.length > 0) {
      const backgroundScan = async () => {
        const lastCandle = data[data.length - 1];

        // Only scan if we haven't scanned this specific candle yet
        if (lastCandle.time === lastScannedCandleTime.current) return;

        try {
          const result = await analyzeWithGemini(symbol, timeframe, data, signals);
          lastScannedCandleTime.current = lastCandle.time;

          if (result.signals.length > 0) {
            setAiSignals(prev => {
              // Strictly keep only the most recent AI signal for the current candle context
              // This reduces noise and matches the "latest candle only" request
              const newSignal = result.signals[0];
              const filtered = prev.filter(s => s.candleTime !== newSignal.candleTime);
              return [...filtered, newSignal].slice(-20);
            });
          }
        } catch (err) {
          console.warn("Background AI update failed:", err);
        }
      };

      // Check every 10 seconds for a new candle close, but the internal logic 
      // ensures we only call the API once per candle.
      aiInterval = setInterval(backgroundScan, 10000);
      backgroundScan(); // Initial check
    }

    return () => {
      if (aiInterval) clearInterval(aiInterval);
    };
  }, [config.enableAISignals, symbol, timeframe, data.length]); // Added data.length to respond to new candles

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

    tickIntervalRef.current = setInterval(updateTick, 2000);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [symbol, timeframe]);

  // AI Handler
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeWithGemini(symbol, timeframe, data, signals);
      setAnalysisResult(result.analysis);

      if (config.enableAISignals) {
        setAiSignals(result.signals);
      }

      setShowAnalysis(true);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAnalysisResult("Analysis failed. Please check console.");
      setShowAnalysis(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Render ---
  return (
    <div className="flex flex-row h-screen w-screen bg-[#0d0e12] text-white overflow-hidden relative">
      {/* Sidebar Controls - Drawer on mobile, Sidebar on desktop */}
      <div className={`
        fixed lg:relative z-40 lg:z-auto transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-80 h-full bg-[#0d0e12] border-r border-[#1e1e24] shrink-0
      `}>
        <ControlPanel
          currentSymbol={symbol}
          currentTimeframe={timeframe}
          config={config}
          onSymbolChange={(s) => {
            handleSymbolChange(s);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onTimeframeChange={(tf) => {
            setTimeframe(tf);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onConfigChange={setConfig}
          onAIAnalysis={handleAIAnalysis}
          isAnalyzing={isAnalyzing}
        />

        {/* Mobile Close Button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400"
        >
          <X size={20} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 relative">
        {/* Floating Toggle Button (Mobile) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-20 w-14 h-14 bg-emerald-500 rounded-full shadow-2xl flex items-center justify-center text-black active:scale-95 transition-transform"
        >
          <Sliders size={24} />
        </button>

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
        signals={signals}
      />
    </div>
  );
};

export default App;