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
}

const AnalysisModal: React.FC<Props> = ({ isOpen, onClose, content, signals = [] }) => {
  if (!isOpen) return null;

  const aiSignals = signals.filter(s => s.isAI);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#14151a] w-full max-w-5xl max-h-[95vh] md:max-h-[85vh] rounded-3xl border border-[#1e1e24] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-[#1e1e24] flex items-center justify-between bg-[#1a1b23]/50">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter">INTELLIGENCE <div className="inline-block px-2 py-0.5 bg-indigo-600 text-[10px] rounded ml-2 align-middle">PRO</div></h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Llama 3.3-70B Deep Market Analysis</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content Body - Responsive Stack */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Analysis View */}
          <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar border-b md:border-b-0 md:border-r border-[#1e1e24]">
            <article className="prose prose-invert prose-sm max-w-none prose-p:text-gray-300 prose-headings:text-white prose-strong:text-emerald-400 prose-code:text-indigo-300 prose-pre:bg-[#0d0e12]">
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          </div>

          {/* AI Signals Sidebar */}
          <div className="w-full md:w-80 bg-[#0d0e12] p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold uppercase text-indigo-400 mb-6 tracking-[0.2em] flex items-center gap-2">
              <Target size={14} />
              Alpha Setup Only
            </div>

            {aiSignals.length > 0 ? (
              <div className="space-y-4">
                {aiSignals.map((sig, idx) => (
                  <div key={idx} className={`p-5 rounded-2xl border transition-all duration-500 shadow-xl ${sig.type === 'LONG' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${sig.type === 'LONG' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                        {sig.type}
                      </span>
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded text-[10px] font-mono font-bold text-gray-300">
                        {sig.confidence}% CONF
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 mb-4">
                      <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Entry Pt</span>
                        <span className="text-sm font-mono font-bold text-white">{sig.entryPrice.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                        <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-tight">Take Profit</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">{sig.takeProfit.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                        <span className="text-[10px] text-red-400 uppercase font-bold tracking-tight">Stop Loss</span>
                        <span className="text-sm font-mono font-bold text-red-400">{sig.stopLoss.toFixed(4)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-300 italic leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
                      <span className="text-indigo-400 font-bold mr-1">Logic:</span>
                      {sig.reason}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                <Target size={32} className="mb-2 text-gray-600" />
                <p className="text-xs text-gray-500 font-medium">No high-conviction <br />alpha setups detected.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-[#1e1e24] bg-[#1a1b23]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all active:scale-95"
          >
            Acknowledge Intelligence
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
