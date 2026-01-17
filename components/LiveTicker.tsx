import React from 'react';
import { SymbolDef, Candle } from '../types';
import { ArrowUp, ArrowDown, Zap } from 'lucide-react';

interface Props {
  symbol: SymbolDef;
  currentCandle: Candle;
}

const LiveTicker: React.FC<Props> = ({ symbol, currentCandle }) => {
  const isUp = currentCandle.close >= currentCandle.open;
  const change = currentCandle.close - currentCandle.open;
  const percent = (change / currentCandle.open) * 100;

  return (
    <div className="bg-[#13141b] border-b border-[#1e1e24] px-6 py-3 flex items-center justify-between shadow-lg z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-white text-xs">
            {symbol.id.substring(0, 3)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">{symbol.name}</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 font-mono">LIVE FEED</span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-[#272730] mx-2 hidden sm:block"></div>

        <div className="hidden sm:flex flex-col">
            <span className="text-xs text-gray-500 font-medium">PRICE</span>
            <span className={`text-xl font-mono font-bold tracking-tight ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {currentCandle.close.toFixed(2)}
            </span>
        </div>

        <div className="hidden sm:flex flex-col">
            <span className="text-xs text-gray-500 font-medium">24H CHANGE</span>
            <div className={`flex items-center gap-1 font-mono font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                <span>{Math.abs(percent).toFixed(2)}%</span>
            </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
              <div className="text-xs text-gray-500">SESSION VOL</div>
              <div className="text-sm text-gray-300 font-mono">{(currentCandle.volume * 1542).toLocaleString()}</div>
          </div>
          <button className="bg-[#1e1e24] hover:bg-[#272730] text-emerald-400 px-3 py-2 rounded flex items-center gap-2 transition-colors border border-emerald-500/20">
             <Zap size={16} fill="currentColor" />
             <span className="text-xs font-bold">FAST EXECUTION</span>
          </button>
      </div>
    </div>
  );
};

export default LiveTicker;
