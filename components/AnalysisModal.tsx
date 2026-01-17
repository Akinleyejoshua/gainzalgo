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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13141b] border border-[#2f303b] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#1e1e24]">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-lg">
              <Bot className="text-indigo-400" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Gemini Intelligence Hub</h3>
              <p className="text-xs text-gray-400">Market Analysis & Professional Trade Setups</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Analysis View */}
          <div className="flex-1 p-8 overflow-y-auto border-r border-[#1e1e24] text-gray-300">
            <div className="text-xs font-mono uppercase text-indigo-400 mb-4 tracking-widest">Executive Summary</div>
            <div className="prose prose-invert prose-indigo max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>

          {/* Trade Setups View */}
          <div className="w-full md:w-80 bg-[#0d0e12] p-6 overflow-y-auto">
            <div className="text-xs font-mono uppercase text-emerald-400 mb-4 tracking-widest flex items-center gap-2">
              <Target size={14} />
              AI Trade Setups
            </div>

            {aiSignals.length > 0 ? (
              <div className="space-y-4">
                {aiSignals.map((sig, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${sig.type === 'LONG' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sig.type === 'LONG' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                        {sig.type}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {sig.confidence}% Conf.
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Entry</span>
                        <span className="text-white font-mono font-bold">{sig.entryPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-500 flex items-center gap-1"><ArrowUpRight size={12} /> TP</span>
                        <span className="text-emerald-400 font-mono">{sig.takeProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-500 flex items-center gap-1"><Shield size={12} /> SL</span>
                        <span className="text-red-400 font-mono">{sig.stopLoss.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-gray-400 italic">
                      {sig.reason}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center opacity-40">
                <Shield size={32} className="mb-2 text-gray-600" />
                <p className="text-xs text-gray-500">No AI setups detected in current window.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#1e1e24] bg-[#0d0e12] rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-lg font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Acknowledge AI Guidance
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
