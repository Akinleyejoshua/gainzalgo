import React, { useState, useEffect } from 'react';
import {
    ShieldCheck,
    Settings2,
    LineChart,
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    Link,
    Link2Off,
    RefreshCw,
    Trophy,
    Activity,
    Bot
} from 'lucide-react';
import { MT5Account, TradeSettings, Position, TradeHistory, SymbolDef } from '../types';
import { mt5Service } from '../services/mt5Service';
import { notify } from '../services/notificationService';

interface Props {
    symbol: SymbolDef;
    account: MT5Account;
    settings: TradeSettings;
    onAccountUpdate: (acc: Partial<MT5Account>) => void;
    onSettingsUpdate: (settings: TradeSettings) => void;
    onTradeAction: (type: 'BUY' | 'SELL') => void;
}

const TradePanel: React.FC<Props> = ({
    symbol,
    account,
    settings,
    onAccountUpdate,
    onSettingsUpdate,
    onTradeAction
}) => {
    const [activeTab, setActiveTab] = useState<'CONNECT' | 'CONFIG' | 'STATS'>('CONNECT');
    const [isConnecting, setIsConnecting] = useState(false);
    const [positions, setPositions] = useState<Position[]>([]);
    const [history, setHistory] = useState<TradeHistory[]>([]);

    useEffect(() => {
        if (account.isConnected) {
            const interval = setInterval(async () => {
                const [accSummary, currentPositions, tradeHistory] = await Promise.all([
                    mt5Service.getAccountSummary(),
                    mt5Service.getPositions(),
                    mt5Service.getHistory()
                ]);
                onAccountUpdate(accSummary);
                setPositions(currentPositions);
                setHistory(tradeHistory);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [account.isConnected]);

    const handleConnect = async () => {
        setIsConnecting(true);
        const result = await mt5Service.connect(account);
        if (result.success) {
            const summary = await mt5Service.getAccountSummary();
            onAccountUpdate({ ...summary, isConnected: true });
            notify.success(`Successfully connected to MT5 Bridge`);
        } else {
            notify.error(`Connection failed: ${result.error}`);
        }
        setIsConnecting(false);
    };

    const handleAutoDiscover = async () => {
        const url = await mt5Service.probeLocalBridge();
        if (url) {
            onAccountUpdate({ bridgeUrl: url });
            notify.info(`Found local bridge at ${url}`);
        } else {
            notify.error('No local bridge found. Ensure your MT5 Python Bridge is running.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0e12] border-t border-[#1e1e24] mt-auto">
            {/* Tabs */}
            <div className="flex border-b border-[#1e1e24]">
                {(['CONNECT', 'CONFIG', 'STATS'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === tab
                            ? 'text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                {/* CONNECTION TAB */}
                {activeTab === 'CONNECT' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="text-amber-400" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-white uppercase leading-none">Simulator Mode</span>
                                    <span className="text-[8px] text-gray-500 italic">No real bridge required</span>
                                </div>
                            </div>
                            <button
                                onClick={() => onAccountUpdate({ isSimulator: !account.isSimulator })}
                                className={`w-9 h-4.5 rounded-full transition-all relative ${account.isSimulator ? 'bg-amber-600' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${account.isSimulator ? 'left-4.5' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-[#14151a] rounded-xl border border-[#1e1e24]">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${account.isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {account.isConnected ? <Link size={18} /> : <Link2Off size={18} />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white">MT5 Strategy Link</div>
                                    <div className="text-[10px] text-gray-500">
                                        {account.isConnected ? (account.isSimulator ? 'Simulator Active' : 'Bridge Active') : 'Disconnected'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${account.isConnected
                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                    : (account.isSimulator ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400')
                                    }`}
                            >
                                {isConnecting ? <RefreshCw className="animate-spin" size={14} /> : (account.isConnected ? 'DISCONNECT' : 'CONNECT')}
                            </button>
                        </div>

                        {!account.isSimulator && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest px-1">Broker Credentials</div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative col-span-2">
                                        <label className="text-[9px] text-gray-600 absolute -top-1.5 left-2 bg-[#0d0e12] px-1 z-10 uppercase tracking-tighter">Server</label>
                                        <input
                                            type="text"
                                            value={account.server}
                                            onChange={e => onAccountUpdate({ server: e.target.value })}
                                            className="w-full bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 font-mono"
                                            placeholder="e.g. MetaQuotes-Demo"
                                        />
                                    </div>

                                    <div className="relative">
                                        <label className="text-[9px] text-gray-600 absolute -top-1.5 left-2 bg-[#0d0e12] px-1 z-10 uppercase tracking-tighter">Login ID</label>
                                        <input
                                            type="text"
                                            value={account.login}
                                            onChange={e => onAccountUpdate({ login: e.target.value })}
                                            className="w-full bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 font-mono"
                                            placeholder="1234567"
                                        />
                                    </div>

                                    <div className="relative">
                                        <label className="text-[9px] text-gray-600 absolute -top-1.5 left-2 bg-[#0d0e12] px-1 z-10 uppercase tracking-tighter">Password</label>
                                        <input
                                            type="password"
                                            value={account.password || ''}
                                            onChange={e => onAccountUpdate({ password: e.target.value })}
                                            className="w-full bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 font-mono"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-[#1e1e24]">
                                    <div className="relative group">
                                        <label className="text-[9px] text-gray-600 absolute -top-1.5 left-2 bg-[#0d0e12] px-1 z-10 uppercase tracking-tighter">MT5 Bridge Gateway</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={account.bridgeUrl}
                                                onChange={e => onAccountUpdate({ bridgeUrl: e.target.value })}
                                                className="flex-1 bg-transparent border border-[#1e1e24] rounded-xl px-3 py-2 text-[10px] text-gray-400 outline-none focus:border-emerald-500/50 font-mono"
                                                placeholder="http://localhost:5000"
                                            />
                                            <button
                                                onClick={handleAutoDiscover}
                                                title="Auto-Discover Local Bridge"
                                                className="p-2 border border-[#1e1e24] rounded-xl text-gray-500 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
                                            >
                                                <RefreshCw size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* CONFIG TAB */}
                {activeTab === 'CONFIG' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={16} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-white uppercase">Automated Execution</span>
                            </div>
                            <button
                                onClick={() => {
                                    const newState = !settings.autoTradeEnabled;
                                    onSettingsUpdate({ ...settings, autoTradeEnabled: newState });
                                    if (newState) notify.success("System: Auto-Trading Activated");
                                    else notify.info("System: Auto-Trading Paused");
                                }}
                                className={`w-9 h-4.5 rounded-full transition-all relative ${settings.autoTradeEnabled ? 'bg-indigo-600' : 'bg-gray-700'}`}
                            >
                                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${settings.autoTradeEnabled ? 'left-4.5' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase">Lot Size</label>
                                    <span className="text-[10px] text-indigo-400 font-mono">{settings.lotSize}</span>
                                </div>
                                <input
                                    type="range" min="0.01" max="1.0" step="0.01"
                                    value={settings.lotSize}
                                    onChange={e => onSettingsUpdate({ ...settings, lotSize: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase">Stop Loss (Pips)</label>
                                    <span className="text-[10px] text-red-400 font-mono">{settings.stopLossPips}</span>
                                </div>
                                <input
                                    type="range" min="10" max="1000" step="10"
                                    value={settings.stopLossPips}
                                    onChange={e => onSettingsUpdate({ ...settings, stopLossPips: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-red-500"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase">Take Profit (Pips)</label>
                                    <span className="text-[10px] text-emerald-400 font-mono">{settings.takeProfitPips}</span>
                                </div>
                                <input
                                    type="range" min="10" max="2000" step="10"
                                    value={settings.takeProfitPips}
                                    onChange={e => onSettingsUpdate({ ...settings, takeProfitPips: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-[#1e1e24] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => onTradeAction('BUY')}
                                className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all active:scale-95"
                            >
                                <ArrowUpCircle size={16} /> BUY
                            </button>
                            <button
                                onClick={() => onTradeAction('SELL')}
                                className="flex-1 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95"
                            >
                                <ArrowDownCircle size={16} /> SELL
                            </button>
                        </div>
                    </div>
                )}

                {/* STATS TAB */}
                {activeTab === 'STATS' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        {/* Auto-Trade Status Indicator */}
                        <div className={`p-3 rounded-xl border flex items-center justify-between ${settings.autoTradeEnabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-500/5 border-gray-500/20'}`}>
                            <div className="flex items-center gap-2">
                                <Bot size={16} className={settings.autoTradeEnabled ? "text-emerald-500 animate-pulse" : "text-gray-500"} />
                                <span className="text-[10px] font-bold text-white uppercase">Automated Engine</span>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${settings.autoTradeEnabled ? 'bg-emerald-500 text-black' : 'bg-gray-700 text-gray-400'}`}>
                                {settings.autoTradeEnabled ? 'RUNNING' : 'PAUSED'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-[#14151a] border border-[#1e1e24] rounded-xl">
                                <div className="text-[8px] text-gray-500 uppercase flex items-center gap-1 mb-1">
                                    <Wallet size={10} /> Balance
                                </div>
                                <div className="text-sm font-bold text-white font-mono">${account.balance.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-[#14151a] border border-[#1e1e24] rounded-xl">
                                <div className="text-[8px] text-gray-500 uppercase flex items-center gap-1 mb-1">
                                    <Activity size={10} /> Equity
                                </div>
                                <div className="text-sm font-bold text-emerald-500 font-mono">${account.equity.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Active Positions */}
                        <div className="space-y-2">
                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest px-1">Active Positions ({positions.length})</div>
                            {positions.length === 0 ? (
                                <div className="text-[10px] text-gray-600 italic p-4 text-center border-2 border-dashed border-[#1e1e24] rounded-xl">No active market exposure</div>
                            ) : (
                                <div className="space-y-2">
                                    {positions.map(p => (
                                        <div key={p.ticket} className="p-2.5 bg-[#14151a] border border-[#1e1e24] rounded-xl flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black ${p.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>{p.type} {p.volume}</span>
                                                    <span className="text-[10px] font-mono text-gray-300">{p.symbol}</span>
                                                </div>
                                                <span className="text-[8px] text-gray-500 font-mono">@{p.openPrice}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs font-bold font-mono ${p.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {p.profit >= 0 ? '+' : ''}{p.profit.toFixed(2)}
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const res = await mt5Service.closePosition(p.ticket);
                                                        if (res.success) {
                                                            notify.success(`Closed ticket #${p.ticket}`);
                                                            // Immediate UI refresh for positions
                                                            const updated = await mt5Service.getPositions();
                                                            setPositions(updated);
                                                        } else {
                                                            notify.error(`Failed to close: ${res.error}`);
                                                        }
                                                    }}
                                                    className="text-[8px] text-gray-600 hover:text-red-500 underline uppercase tracking-tighter"
                                                >
                                                    Close Ticket
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Trade History */}
                        <div className="space-y-2 pt-2 border-t border-[#1e1e24]">
                            <div className="flex items-center justify-between px-1">
                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Trophy size={10} className="text-amber-500" /> Recent performance
                                </div>
                                <span className="text-[8px] text-gray-600 font-mono">{history.length} trades</span>
                            </div>

                            {history.length === 0 ? (
                                <div className="text-[9px] text-gray-700 text-center py-4 italic">No completed trades yet</div>
                            ) : (
                                <div className="space-y-1.5">
                                    {history.slice(-5).reverse().map(h => (
                                        <div key={h.ticket} className="p-2 bg-[#090a0d] border border-[#1e1e24]/50 rounded-lg flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[9px] font-bold ${h.type === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>{h.type}</span>
                                                    <span className="text-[9px] text-gray-400">{h.symbol}</span>
                                                </div>
                                                <span className="text-[7px] text-gray-600 font-mono">{new Date(h.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`text-[10px] font-bold font-mono ${h.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {h.profit >= 0 ? '+' : ''}{h.profit.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradePanel;
