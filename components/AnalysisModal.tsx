import React from 'react';
import { X, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { Signal } from '../types';
import { Target, Shield, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  signals?: Signal[];
  provider?: string;
}

const AnalysisModal: React.FC<Props> = ({ isOpen, onClose, content, signals = [], provider }) => {
  if (!isOpen) return null;

  const aiSignals = signals.filter(s => s.isAI);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0b0c10] w-full max-w-6xl max-h-[95vh] md:max-h-[85vh] rounded-[2rem] border border-[#23242b] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 md:p-8 border-b border-[#23242b] flex items-center justify-between bg-gradient-to-r from-[#14151a] to-[#0b0c10]">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter flex items-center gap-3">
              <Bot size={28} className="text-indigo-500" />
              GAINZALGO INTELLIGENCE
              <div className="px-2 py-0.5 bg-indigo-600 text-[10px] rounded align-middle uppercase tracking-widest">QUANTUM</div>
              {provider && (
                <div className="px-2 py-0.5 bg-white/5 text-[9px] text-gray-500 rounded border border-white/10 font-mono">
                  {provider}
                </div>
              )}
            </h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] mt-2 font-bold opacity-70">Strategic Market Reconstruction // Multi-Layer Depth Analysis</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full transition-all hover:rotate-90">
            <X size={24} className="text-gray-500 hover:text-white" />
          </button>
        </div>

        {/* Content Body - Responsive Stack */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Analysis View */}
          <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar border-b md:border-b-0 md:border-r border-[#23242b] bg-[#0d0e12]/40">
            <div className="max-w-3xl">
              <article className="prose prose-invert prose-base max-w-none 
                prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-6
                prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight
                prose-h2:text-indigo-400 prose-h2:border-b prose-h2:border-indigo-500/20 prose-h2:pb-2 prose-h2:mt-12 prose-h2:mb-6
                prose-h3:text-emerald-400 prose-h3:mt-8
                prose-strong:text-emerald-400 prose-strong:font-bold prose-strong:bg-emerald-400/5 prose-strong:px-1 prose-strong:rounded
                prose-ul:my-6 prose-li:text-gray-400 prose-li:marker:text-indigo-500
                prose-blockquote:border-l-indigo-500 prose-blockquote:bg-indigo-500/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:italic
                ">
                <ReactMarkdown>{content}</ReactMarkdown>
              </article>
            </div>
          </div>

          {/* AI Signals Sidebar */}
          <div className="w-full md:w-[360px] bg-[#08090d] p-6 md:p-8 overflow-y-auto custom-scrollbar shadow-inner flex flex-col">
            <div className="flex flex-col gap-1 mb-8">
              <div className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] flex items-center gap-2">
                <Target size={14} className="animate-pulse" />
                Structural Alpha
              </div>
              <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">High-Conviction Machine Learning Setup</p>
            </div>

            {aiSignals.length > 0 ? (
              <div className="space-y-6">
                {aiSignals.map((sig, idx) => (
                  <div key={idx} className={`p-6 rounded-[1.5rem] border transition-all duration-500 shadow-2xl relative overflow-hidden group ${sig.type === 'LONG' ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-red-500/20 bg-red-500/[0.02]'}`}>
                    {/* Decorative Gradient Overlay */}
                    <div className={`absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none ${sig.type === 'LONG' ? 'bg-gradient-to-br from-emerald-500/20 to-transparent' : 'bg-gradient-to-br from-red-500/20 to-transparent'}`} />

                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <span className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-[0.2em] shadow-lg ${sig.type === 'LONG' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                        {sig.type}
                      </span>
                      <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-black text-gray-300">
                        {sig.confidence}% CONF
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-6 relative z-10">
                      <div className="flex flex-col gap-1 p-4 bg-white/[0.03] rounded-2xl border border-white/5 group-hover:border-white/10 transition-colors">
                        <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Entry Limit</span>
                        <span className="text-lg font-mono font-bold text-white tracking-tight">{sig.entryPrice.toFixed(sig.entryPrice > 1000 ? 2 : 4)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex flex-col gap-1 p-4 bg-emerald-500/[0.03] rounded-2xl border border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
                          <span className="text-[9px] text-emerald-500 uppercase font-black tracking-widest">Target</span>
                          <span className="text-base font-mono font-bold text-emerald-400">{sig.takeProfit.toFixed(sig.takeProfit > 1000 ? 2 : 4)}</span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1 p-4 bg-red-500/[0.03] rounded-2xl border border-red-500/10 hover:border-red-500/30 transition-colors">
                          <span className="text-[9px] text-red-400 uppercase font-black tracking-widest">Risk Off</span>
                          <span className="text-base font-mono font-bold text-red-400">{sig.stopLoss.toFixed(sig.stopLoss > 1000 ? 2 : 4)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-400 leading-relaxed bg-black/60 p-4 rounded-[1.2rem] border border-white/5 relative z-10 group-hover:text-gray-200 transition-colors">
                      <span className="text-indigo-400 font-black mr-2 uppercase tracking-widest text-[9px]">Neural Driver:</span>
                      {sig.reason}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-center opacity-30 px-6">
                <Target size={48} className="mb-4 text-gray-700" />
                <p className="text-xs text-gray-600 font-bold uppercase tracking-widest leading-loose">
                  Scanning for high probability <br /> market inefficiencies...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-6 border-t border-[#23242b] bg-[#08090d] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              Live Feed
            </div>
            <div className="w-1 h-1 bg-gray-700 rounded-full" />
            No Financial Advice
          </div>
          <button
            onClick={onClose}
            className="w-full md:w-auto px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 group flex items-center justify-center gap-3"
          >
            Acknowledge Intelligence
            <Bot size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
