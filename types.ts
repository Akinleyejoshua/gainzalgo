export enum AssetType {
  CRYPTO = 'CRYPTO',
  FOREX = 'FOREX',
  COMMODITY = 'COMMODITY'
}

export interface SymbolDef {
  id: string;
  name: string;
  type: AssetType;
  basePrice: number;
  volatility: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '24h';

export type StrategyType = 'TREND' | 'REVERSAL' | 'MOMENTUM';

export interface MT5Account {
  login: string;
  server: string;
  password?: string;
  bridgeUrl: string;
  isConnected: boolean;
  isSimulator: boolean;
  balance: number;
  equity: number;
  currency: string;
}

export interface TradeSettings {
  lotSize: number;
  stopLossPips: number;
  takeProfitPips: number;
  autoTradeEnabled: boolean;
  maxTradesPerDay: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  time: number;
}

export interface TradeHistory {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  closeTime: number;
}

export interface AlgoConfig {
  sensitivity: number; // 1-100
  riskReward: number; // e.g. 2.0
  trendFilter: boolean;
  showTP: boolean;
  showSL: boolean;
  atrPeriod: number;

  // New Signal Logic Options
  strategy: StrategyType;
  useRSIFilter: boolean;
  useVolumeFilter: boolean;
  enableAISignals: boolean;
  aiModeEnabled: boolean;
  aiLookback: number; // New: Number of candles to send for AI analysis
  useAdxFilter: boolean;
  adxThreshold: number;
  useMacdFilter: boolean;
  useEmaTrendFilter: boolean;

  // Trading integration
  tradingEnabled: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  id: string;
  candleTime: number;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: 'ACTIVE' | 'HIT_TP' | 'HIT_SL' | 'PENDING';
  reason?: string; // To display which logic triggered it
  confidence: number; // 0-100 percentage
  isAI?: boolean;
}
