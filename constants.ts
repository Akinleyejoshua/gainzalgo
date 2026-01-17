import { SymbolDef, AssetType } from './types';

export const SUPPORTED_SYMBOLS: SymbolDef[] = [
  { id: 'BTCUSD', name: 'Bitcoin / USD', type: AssetType.CRYPTO, basePrice: 95417.06, volatility: 0.02 },
  { id: 'ETHUSD', name: 'Ethereum / USD', type: AssetType.CRYPTO, basePrice: 2750.50, volatility: 0.025 },
  { id: 'SOLUSD', name: 'Solana / USD', type: AssetType.CRYPTO, basePrice: 155.20, volatility: 0.035 },
  { id: 'EURUSD', name: 'EUR / USD', type: AssetType.FOREX, basePrice: 1.0550, volatility: 0.004 },
  { id: 'GBPUSD', name: 'GBP / USD', type: AssetType.FOREX, basePrice: 1.2650, volatility: 0.005 },
  { id: 'USDJPY', name: 'USD / JPY', type: AssetType.FOREX, basePrice: 153.00, volatility: 0.004 },
  { id: 'XAUUSD', name: 'Gold / USD', type: AssetType.COMMODITY, basePrice: 2650.00, volatility: 0.008 },
];

export const TIMEFRAMES = [
  { id: '1m', label: '1m', ms: 60 * 1000 },
  { id: '5m', label: '5m', ms: 5 * 60 * 1000 },
  { id: '15m', label: '15m', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { id: '4h', label: '4h', ms: 4 * 60 * 60 * 1000 },
  { id: '24h', label: '1D', ms: 24 * 60 * 60 * 1000 },
];

export const CHART_COLORS = {
  bg: '#0d0e12',
  grid: '#1e1e24',
  text: '#82828b',
  candleUp: '#00d68f', // Green
  candleDown: '#ff3b30', // Red
  signalLong: '#00d68f',
  signalShort: '#ff3b30',
  tpLine: '#00d68f',
  slLine: '#ff3b30',
  entryLine: '#ffffff'
};