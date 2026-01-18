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
import { mt5Service } from './services/mt5Service';
import { MT5Account, TradeSettings } from './types';
import { Toaster } from 'react-hot-toast';
import { notify } from './services/notificationService';

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
  aiModeEnabled: false,
  aiLookback: 100,
  tradingEnabled: false
};

const DEFAULT_ACCOUNT: MT5Account = {
  login: '',
  server: '',
  bridgeUrl: 'http://localhost:8000',
  isConnected: false,
  isSimulator: false,
  balance: 0,
  equity: 0,
  currency: 'USD'
};

const DEFAULT_TRADE_SETTINGS: TradeSettings = {
  lotSize: 0.1,
  stopLossPips: 200,
  takeProfitPips: 400,
  autoTradeEnabled: false,
  maxTradesPerDay: 5
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
  const [activeProvider, setActiveProvider] = useState<string>("");
  const lastScannedCandleTime = useRef<number>(0);
  const lastAIScanTimestamp = useRef<number>(0); // Cooldown for API requests

  // Trading State
  const [mt5Account, setMt5Account] = useState<MT5Account>(() => {
    const saved = localStorage.getItem('gainzalgo_mt5_account');
    return saved ? JSON.parse(saved) : DEFAULT_ACCOUNT;
  });

  const [tradeSettings, setTradeSettings] = useState<TradeSettings>(() => {
    const saved = localStorage.getItem('gainzalgo_trade_settings');
    return saved ? JSON.parse(saved) : DEFAULT_TRADE_SETTINGS;
  });

  const executedSignalIds = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    localStorage.setItem('gainzalgo_mt5_account', JSON.stringify(mt5Account));
    mt5Service.updateConfig(mt5Account);
  }, [mt5Account]);

  useEffect(() => {
    localStorage.setItem('gainzalgo_trade_settings', JSON.stringify(tradeSettings));
  }, [tradeSettings]);

  // --- Logic ---

  // Handle Symbol Change Wrapper to prevent stale data render
  const handleSymbolChange = (newSymbol: SymbolDef) => {
    if (newSymbol.id === symbol.id) return;
    setData([]); // Clear data immediately to unmount chart and prevent stale data issues
    setAiSignals([]); // Clear AI signals on symbol change
    executedSignalIds.current.clear(); // Clear execution history for new symbol
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
        const techSignals = calculateSignals(initialData, config, timeframe);
        setSignals(techSignals);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [symbol, timeframe]);

  // Recalculate signals if config changes or data updates
  useEffect(() => {
    if (data.length > 0) {
      const techSignals = calculateSignals(data, config, timeframe);
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

  // --- Automated Trading Execution ---
  useEffect(() => {
    if (tradeSettings.autoTradeEnabled && mt5Account.isConnected && signals.length > 0) {
      const latestSignal = signals[signals.length - 1];

      // Check if this signal is fresh (within last 2 candles) and not already executed
      const lastCandleTime = data[data.length - 1]?.time || 0;
      const currentTfRecord = TIMEFRAMES.find(tf => tf.id === timeframe);
      const currentTfMs = currentTfRecord?.ms || 60000;
      const isFresh = lastCandleTime - latestSignal.candleTime <= currentTfMs * 2;

      if (isFresh && !executedSignalIds.current.has(latestSignal.id)) {
        console.log(`[AutoTrade] Triggering order for signal: ${latestSignal.id} on ${symbol.id}`);
        executedSignalIds.current.add(latestSignal.id);

        const isLong = latestSignal.type === 'LONG';

        mt5Service.placeOrder({
          symbol: symbol.id,
          type: isLong ? 'BUY' : 'SELL',
          volume: tradeSettings.lotSize,
          sl: latestSignal.stopLoss,
          tp: latestSignal.takeProfit
        }).then(res => {
          if (res.success) {
            notify.trade(isLong ? 'BUY' : 'SELL', symbol.id, tradeSettings.lotSize);
          } else {
            notify.error(`Auto-trade failed: ${res.error}`);
          }
        });
      }
    } else if (tradeSettings.autoTradeEnabled && !mt5Account.isConnected && signals.length > 0) {
      // Optional: Log once or show a hint that auto-trade is waiting for connection
    }
  }, [signals, tradeSettings.autoTradeEnabled, mt5Account.isConnected, symbol, data, timeframe]);

  // --- Real-time AI Signal Update ---
  useEffect(() => {
    let aiInterval: ReturnType<typeof setInterval> | null = null;

    if (config.enableAISignals && data.length > 0) {
      const backgroundScan = async () => {
        const lastCandle = data[data.length - 1];

        // Hard Cooldown: Max 1 request every 30 seconds
        const now = Date.now();
        if (now - lastAIScanTimestamp.current < 30000) return;

        // Only scan if we haven't scanned this specific candle yet
        if (lastCandle.time === lastScannedCandleTime.current) return;

        try {
          // Optimization: Only send the requested lookback window to reduce tokens and rate limits
          const slicedData = data.slice(-config.aiLookback);
          const slicedSignals = signals.filter(s => s.candleTime >= (slicedData[0]?.time || 0));

          const result = await analyzeWithGemini(symbol, timeframe, slicedData, slicedSignals);
          lastScannedCandleTime.current = lastCandle.time;
          lastAIScanTimestamp.current = Date.now();

          if (result.signals.length > 0) {
            setAiSignals(prev => {
              // Strictly keep only the most recent AI signal for the current candle context
              // This reduces noise and matches the "latest candle only" request
              const newSignal = result.signals[result.signals.length - 1];
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
          // Calculate the exact aligned time for the new candle
          const alignedTime = Math.floor(now / currentTfMs) * currentTfMs;

          const newCandleBase = {
            ...lastCandle,
            time: alignedTime,
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

    const intervalRate = timeframe === '1s' ? 500 : 2000;
    tickIntervalRef.current = setInterval(updateTick, intervalRate);

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [symbol, timeframe]);

  // AI Handler
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const slicedData = data.slice(-config.aiLookback);
      const slicedSignals = signals.filter(s => s.candleTime >= (slicedData[0]?.time || 0));

      const result = await analyzeWithGemini(symbol, timeframe, slicedData, slicedSignals);
      setAnalysisResult(result.analysis);
      setActiveProvider(result.provider || "");

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

  const handleManualTrade = async (type: 'BUY' | 'SELL') => {
    if (!mt5Account.isConnected) {
      notify.error("MT5 not connected. Please connect in the Trading panel.");
      return;
    }

    const lastPrice = data[data.length - 1]?.close || 0;
    const isLong = type === 'BUY';
    const pipValue = symbol.type === 'FOREX' ? 0.0001 : (symbol.id.includes('JPY') ? 0.01 : 1.0);

    // Calculate SL/TP based on settings
    const sl = isLong ? lastPrice - (tradeSettings.stopLossPips * pipValue) : lastPrice + (tradeSettings.stopLossPips * pipValue);
    const tp = isLong ? lastPrice + (tradeSettings.takeProfitPips * pipValue) : lastPrice - (tradeSettings.takeProfitPips * pipValue);

    const result = await mt5Service.placeOrder({
      symbol: symbol.id,
      type,
      volume: tradeSettings.lotSize,
      sl,
      tp
    });

    if (result.success) {
      notify.trade(type, symbol.id, tradeSettings.lotSize);
    } else {
      notify.error(`Order failed: ${result.error}`);
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
            if (tf === timeframe) return;
            setData([]); // Clear data to show loading and prevent alignment issues
            setTimeframe(tf);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onConfigChange={setConfig}
          onAIAnalysis={handleAIAnalysis}
          isAnalyzing={isAnalyzing}
          mt5Account={mt5Account}
          tradeSettings={tradeSettings}
          onAccountUpdate={(acc) => setMt5Account(prev => ({ ...prev, ...acc }))}
          onSettingsUpdate={setTradeSettings}
          onTradeAction={handleManualTrade}
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

        {/* Auto-Trading Status Banner */}
        {tradeSettings.autoTradeEnabled && (
          <div className={`mx-2 mt-2 px-4 py-2 rounded-xl border flex items-center justify-between animate-in slide-in-from-top duration-500 ${mt5Account.isConnected
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${mt5Account.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {mt5Account.isConnected ? 'GainzAlgo Auto-Trading System Live' : 'Auto-Trading Waiting for MT5 Connection'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-bold uppercase opacity-80">
              <span className="hidden sm:inline">Lot: {tradeSettings.lotSize}</span>
              <span className="hidden sm:inline">Asset: {symbol.id}</span>
              <button
                onClick={() => setTradeSettings(prev => ({ ...prev, autoTradeEnabled: false }))}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md transition-all"
              >
                Deactivate
              </button>
            </div>
          </div>
        )}

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
        provider={activeProvider}
      />
      <Toaster position="top-right" />
    </div>
  );
};

export default App;