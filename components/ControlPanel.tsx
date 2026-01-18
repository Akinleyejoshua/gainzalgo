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
    <div className="flex flex-col h-full bg-[#0d0e12] relative overflow-hidden">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-6">
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between lg:mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500 rounded-lg">
              <Activity size={18} className="text-black" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter text-white">GAINZALGO <span className="text-emerald-500">PRO</span></h1>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest leading-none">v4.2.0 Engine</p>
            </div>
          </div>
          <button className="lg:hidden p-2 text-gray-400">
            <Sliders size={18} />
          </button>
        </div>

        {/* Asset Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
            <BarChart2 size={12} className="text-emerald-500" />
            Market Selection
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Symbol Dropdown */}
            <div className="relative group col-span-2 lg:col-span-1">
              <label className="text-[10px] text-gray-600 absolute -top-2 left-2 bg-[#0d0e12] px-1 z-10">Symbol</label>
              <select
                value={currentSymbol.id}
                onChange={e => {
                  const s = SUPPORTED_SYMBOLS.find(sym => sym.id === e.target.value);
                  if (s) onSymbolChange(s);
                }}
                className="w-full bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
              >
                {SUPPORTED_SYMBOLS.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#1a1b23]">{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-emerald-500 transition-colors" size={14} />
            </div>

            {/* Timeframe Dropdown */}
            <div className="relative group col-span-2 lg:col-span-1">
              <label className="text-[10px] text-gray-600 absolute -top-2 left-2 bg-[#0d0e12] px-1 z-10">Interval</label>
              <select
                value={currentTimeframe}
                onChange={e => onTimeframeChange(e.target.value)}
                className="w-full bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer font-mono"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.id} value={tf.id} className="bg-[#1a1b23]">{tf.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 text-gray-500 pointer-events-none group-hover:text-emerald-500 transition-colors" size={14} />
            </div>
          </div>
        </div>

        {/* Algorithm Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">
            <Cpu size={12} className="text-purple-500" />
            Engine Parameters
          </div>

          <div className="bg-[#14151a] p-4 rounded-2xl border border-[#1e1e24] space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-400">Signal Sensitivity</label>
                <span className="text-xs font-mono text-emerald-400">{config.sensitivity}</span>
              </div>
              <input
                type="range" min="1" max="100" step="1"
                value={config.sensitivity}
                onChange={e => onConfigChange({ ...config, sensitivity: parseInt(e.target.value) })}
                className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-400">Risk/Reward Profile</label>
                <span className="text-xs font-mono text-purple-400">{config.riskReward}:1</span>
              </div>
              <input
                type="range" min="1" max="5" step="0.1"
                value={config.riskReward}
                onChange={e => onConfigChange({ ...config, riskReward: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1e1e24]">
              <label className="text-xs text-gray-400 block font-medium mb-1">Active Strategy</label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {(['TREND', 'REVERSAL', 'MOMENTUM'] as StrategyType[]).map(st => (
                  <button
                    key={st}
                    onClick={() => onConfigChange({ ...config, strategy: st })}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${config.strategy === st
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                      : 'bg-transparent border-[#1e1e24] text-gray-500 hover:border-gray-700'
                      }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1e1e24]">
              <label className="text-xs text-gray-400 block font-medium">Confirmation Filters</label>
              <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-[#1e1e24] transition">
                <span className="text-xs">RSI Filter</span>
                <input
                  type="checkbox"
                  checked={config.useRSIFilter}
                  onChange={e => onConfigChange({ ...config, useRSIFilter: e.target.checked })}
                  className="accent-emerald-500 w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-gray-300 cursor-pointer p-2 rounded hover:bg-[#1e1e24] transition">
                <span className="text-xs">Volume Spike</span>
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
                <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showTP}
                    onChange={e => onConfigChange({ ...config, showTP: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  Show TP
                </label>
                <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
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
        </div>

        {/* AI Intelligence Section */}
        <div className="bg-[#1a1b23]/50 rounded-2xl p-4 border border-indigo-500/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot size={18} className={config.aiModeEnabled ? "text-indigo-400" : "text-gray-600"} />
              <span className="text-sm font-bold text-white">AI Mode</span>
            </div>
            <button
              onClick={() => onConfigChange({ ...config, aiModeEnabled: !config.aiModeEnabled })}
              className={`w-10 h-5 rounded-full transition-all relative ${config.aiModeEnabled ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.aiModeEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {config.aiModeEnabled ? (
            <div className="space-y-4">
              <div className="space-y-4 pt-4 border-t border-indigo-500/10">
                <div className="flex justify-between items-center px-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Intelligence Window</span>
                    <span className="text-[9px] text-gray-500 italic">Reduces Groq 429 rate limits</span>
                  </div>
                  <span className="text-[10px] font-mono text-white bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/20">{config.aiLookback} candles</span>
                </div>
                <input
                  type="range" min="20" max="500" step="10"
                  value={config.aiLookback}
                  onChange={e => onConfigChange({ ...config, aiLookback: parseInt(e.target.value) })}
                  className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer p-2 rounded bg-indigo-500/5 border border-indigo-500/20 hover:bg-indigo-500/10 transition">
                <div className="flex flex-col text-left">
                  <span className="text-indigo-300 font-bold">Signal Enhancement</span>
                  <span className="text-[9px] text-gray-500 italic">Background real-time scanning</span>
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
                  <span className="animate-pulse flex items-center gap-2 text-xs"><Activity size={12} className="animate-spin" /> Scanning...</span>
                ) : (
                  <>
                    <Zap size={16} fill="currentColor" />
                    Intelligence Scan
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3 text-center border-2 border-dashed border-[#272730] rounded-xl group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => onConfigChange({ ...config, aiModeEnabled: true })}>
              <p className="text-[10px] text-gray-500 group-hover:text-indigo-400 transition-colors uppercase tracking-widest font-bold">Activate AI</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
