import React from 'react';
import { X, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const AnalysisModal: React.FC<Props> = ({ isOpen, onClose, content }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13141b] border border-[#2f303b] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#1e1e24]">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-500/20 p-2 rounded-lg">
                <Bot className="text-indigo-400" size={24} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white">Gemini Market Scan</h3>
                <p className="text-xs text-gray-400">GainzAlgo AI Analyst Output</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto text-gray-300 leading-relaxed text-sm">
           <div className="prose prose-invert prose-indigo max-w-none">
             <ReactMarkdown>{content}</ReactMarkdown>
           </div>
        </div>

        <div className="p-4 border-t border-[#1e1e24] bg-[#0d0e12] rounded-b-2xl">
           <button 
             onClick={onClose}
             className="w-full py-3 bg-[#1e1e24] hover:bg-[#272730] text-white rounded-lg font-bold transition-all"
           >
             Dismiss Analysis
           </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
