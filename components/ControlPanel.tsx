import React from 'react';
import { AssetType, AlgoConfig, SymbolDef, Timeframe, StrategyType } from '../types';
import { SUPPORTED_SYMBOLS, TIMEFRAMES } from '../constants';
import { Activity, Sliders, ChevronDown, BarChart2, ShieldAlert, Cpu, Bot, Zap } from 'lucide-react';

interface Props {
  currentSymbol: SymbolDef;
  currentTimeframe: string;
  config: AlgoConfig;
  onSymbolChange: (s: SymbolDef) => void;
  onTimeframeChange: (t: string) => void;
  onConfigChange: (c: AlgoConfig) => void;
  onAIAnalysis: () => void;
  isAnalyzing: boolean;
}

const ControlPanel: React.FC<Props> = ({
  currentSymbol,
  currentTimeframe,
  config,
  onSymbolChange,
  onTimeframeChange,
  onConfigChange,
  onAIAnalysis,
  isAnalyzing
}) => {
  return (
    <div className="w-full lg:w-80 border-r border-[#1e1e24] bg-[#13141b] flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-[#1e1e24]">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
          <Activity className="text-emerald-400" />
          GainzAlgo
        </h1>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-mono">Pro Indicator Suite</p>
      </div>

      {/* Symbol Selector */}
      <div className="p-6 border-b border-[#1e1e24]">
        <label className="text-sm text-gray-400 font-medium mb-3 block">Asset</label>
        <div className="space-y-2">
          {Object.values(AssetType).map(type => (
            <div key={type} className="mb-4 last:mb-0">
              <div className="text-xs text-gray-600 mb-2 font-mono ml-1">{type}</div>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_SYMBOLS.filter(s => s.type === type).map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSymbolChange(s)}
                    className={`px-3 py-2 text-left rounded-lg text-sm transition-all border ${currentSymbol.id === s.id
                      ? 'bg-[#1e1e24] border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                      : 'bg-[#0d0e12] border-[#272730] text-gray-400 hover:border-gray-600'
                      }`}
                  >
                    <div className="font-bold">{s.id}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="p-6 border-b border-[#1e1e24]">
        <label className="text-sm text-gray-400 font-medium mb-3 block">Timeframe</label>
        <div className="grid grid-cols-3 gap-2">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.id}
              onClick={() => onTimeframeChange(tf.id)}
              className={`px-2 py-2 text-center rounded text-xs font-mono transition-all ${currentTimeframe === tf.id
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-[#1e1e24] text-gray-400 hover:bg-[#272730]'
                }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Algo Config */}
      <div className="p-6 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={16} className="text-emerald-400" />
          <label className="text-sm text-white font-bold">Indicator Logic</label>
        </div>

        <div className="space-y-6">
          {/* Strategy Type Selection */}
          <div className="bg-[#1e1e24] p-3 rounded-lg border border-[#2f303b]">
            <label className="text-xs text-gray-400 mb-2 block font-medium">Core Strategy</label>
            <select
              value={config.strategy}
              onChange={(e) => onConfigChange({ ...config, strategy: e.target.value as StrategyType })}
              className="w-full bg-[#0d0e12] text-white text-sm p-2 rounded border border-[#272730] focus:border-emerald-500 focus:outline-none"
            >
              <option value="MOMENTUM">Momentum Breakout</option>
              <option value="TREND">SMA Trend Following</option>
              <option value="REVERSAL">RSI Mean Reversion</option>
            </select>
            <div className="text-[10px] text-gray-500 mt-2 leading-tight">
              {config.strategy === 'MOMENTUM' && "Triggers on high volatility breakouts."}
              {config.strategy === 'TREND' && "Triggers on moving average crossovers."}
              {config.strategy === 'REVERSAL' && "Triggers on overbought/oversold conditions."}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Sensitivity</span>
              <span className="font-mono text-emerald-400">{config.sensitivity}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={config.sensitivity}
              onChange={(e) => onConfigChange({ ...config, sensitivity: parseInt(e.target.value) })}
              className="w-full h-1 bg-[#272730] rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Risk/Reward Ratio</span>
              <span className="font-mono text-blue-400">1:{config.riskReward}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={config.riskReward}
              onChange={(e) => onConfigChange({ ...config, riskReward: parseFloat(e.target.value) })}
              className="w-full h-1 bg-[#272730] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-[#1e1e24]">
            <label className="text-xs text-gray-400 block font-medium">Confirmation Filters</label>
            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-[#1e1e24] transition">
              <span>RSI Confirmation</span>
              <input
                type="checkbox"
                checked={config.useRSIFilter}
                onChange={e => onConfigChange({ ...config, useRSIFilter: e.target.checked })}
                className="accent-emerald-500 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-[#1e1e24] transition">
              <span>Volume Spike</span>
              <input
                type="checkbox"
                checked={config.useVolumeFilter}
                onChange={e => onConfigChange({ ...config, useVolumeFilter: e.target.checked })}
                className="accent-yellow-500 w-4 h-4"
              />
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#1e1e24]">
            <label className="text-xs text-gray-400 block font-medium">Visuals</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showTP}
                  onChange={e => onConfigChange({ ...config, showTP: e.target.checked })}
                  className="accent-emerald-500"
                />
                Show TP
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showSL}
                  onChange={e => onConfigChange({ ...config, showSL: e.target.checked })}
                  className="accent-red-500"
                />
                Show SL
              </label>
            </div>
          </div>
        </div>

        {/* AI Intelligence Section */}
        <div className="mt-4 pt-6 border-t border-[#1e1e24] bg-[#1a1b23]/50 -mx-6 px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot size={18} className={config.aiModeEnabled ? "text-indigo-400" : "text-gray-600"} />
              <span className="text-sm font-bold text-white">AI Intelligence</span>
            </div>
            <button
              onClick={() => onConfigChange({ ...config, aiModeEnabled: !config.aiModeEnabled })}
              className={`w-10 h-5 rounded-full transition-all relative ${config.aiModeEnabled ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.aiModeEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {config.aiModeEnabled ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer p-2 rounded bg-indigo-500/5 border border-indigo-500/20 hover:bg-indigo-500/10 transition">
                <div className="flex flex-col">
                  <span className="text-indigo-300 font-bold">Signal Enhancement</span>
                  <span className="text-[9px] text-gray-500 italic">Inject AI signals into chart</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableAISignals}
                  onChange={e => onConfigChange({ ...config, enableAISignals: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4"
                />
              </label>

              <button
                onClick={onAIAnalysis}
                disabled={isAnalyzing}
                className="w-full py-3 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <span className="animate-pulse flex items-center gap-2"><Activity size={14} className="animate-spin" /> Analyzing...</span>
                ) : (
                  <>
                    <Zap size={16} fill="currentColor" />
                    Perform AI Market Scan
                  </>
                )}
              </button>
              <p className="text-[9px] text-gray-600 text-center uppercase tracking-tighter">
                Utilizing Gemini 1.5 Flash Optimization
              </p>
            </div>
          ) : (
            <div className="p-4 py-6 text-center border-2 border-dashed border-[#272730] rounded-xl group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => onConfigChange({ ...config, aiModeEnabled: true })}>
              <p className="text-[11px] text-gray-500 group-hover:text-indigo-400 transition-colors">Click to activate AI Market Analysis features.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
