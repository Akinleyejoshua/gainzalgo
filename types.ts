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

export interface AlgoConfig {
  sensitivity: number; // 1-10
  riskReward: number; // e.g. 2.0
  trendFilter: boolean;
  showTP: boolean;
  showSL: boolean;
  atrPeriod: number;
  
  // New Signal Logic Options
  strategy: StrategyType;
  useRSIFilter: boolean;
  useVolumeFilter: boolean;
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
}
