import { Candle, SymbolDef, AlgoConfig, Signal, Timeframe } from '../types';
import { TIMEFRAMES } from '../constants';

const MARKET_BASE = '/market-api';

// Maps our IDs to Bitstmap symbols
const SYMBOL_MAP: Record<string, string> = {
  'BTCUSD': 'btcusd',
  'ETHUSD': 'ethusd',
  'SOLUSD': 'solusd',
  'EURUSD': 'eurusd',
  'GBPUSD': 'gbpusd',
  'USDJPY': 'usdjpy',
  'XAUUSD': 'xauusd'
};

const INTERVAL_MAP: Record<string, string> = {
  '1m': '60',
  '5m': '300',
  '15m': '900',
  '1h': '3600',
  '4h': '14400',
  '24h': '86400'
};

// --- Professional Technical Analysis Math ---

// Exponential Moving Average
function calculateEMA(data: Candle[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(data.length).fill(0);

  // Initialize with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  emaArray[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    emaArray[i] = (data[i].close * k) + (emaArray[i - 1] * (1 - k));
  }
  return emaArray;
}

// Standard Deviation for Bollinger Bands
function calculateStdDev(data: Candle[], period: number, index: number, average: number): number {
  if (index < period - 1) return 0;
  let sumDiffSq = 0;
  for (let i = 0; i < period; i++) {
    const diff = data[index - i].close - average;
    sumDiffSq += diff * diff;
  }
  return Math.sqrt(sumDiffSq / period);
}

// Wilder's Smoothed RSI
function calculateRSIArray(data: Candle[], period: number): number[] {
  const rsiArray: number[] = new Array(data.length).fill(0);
  let gains = 0;
  let losses = 0;

  // Initial SMA for first period
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsiArray[period] = 100 - (100 / (1 + (avgGain / avgLoss)));

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    if (avgLoss === 0) rsiArray[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      rsiArray[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsiArray;
}

// Average True Range (ATR)
function calculateATR(data: Candle[], period: number): number[] {
  const tr: number[] = [0];
  const atr: number[] = new Array(data.length).fill(0);

  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low - data[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  // Initial ATR (SMA of TR)
  let sumTR = 0;
  for (let i = 0; i < period; i++) sumTR += tr[i];
  atr[period - 1] = sumTR / period;

  for (let i = period; i < data.length; i++) {
    atr[i] = ((atr[i - 1] * (period - 1)) + tr[i]) / period;
  }
  return atr;
}

// --- Realistic Data Generator (Market Cycles) ---

// --- Real Market Data Fetcher ---

export const fetchHistory = async (
  symbol: SymbolDef,
  timeframeId: string,
  count: number = 300
): Promise<Candle[]> => {
  const pair = SYMBOL_MAP[symbol.id] || symbol.id.toLowerCase();
  const step = INTERVAL_MAP[timeframeId] || '60';

  try {
    const response = await fetch(
      `${MARKET_BASE}/ohlc/${pair}/?step=${step}&limit=${count}`
    );

    if (!response.ok) throw new Error(`Status: ${response.status}`);

    const json = await response.json();
    const rawData = json.data.ohlc;

    return rawData.map((d: any) => ({
      time: parseInt(d.timestamp) * 1000,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseFloat(d.volume)
    }));
  } catch (error) {
    console.warn(`Market API Down, using Deterministic Fallback for ${symbol.id}:`, error);
    return generateHistoryFallback(symbol, timeframeId, count);
  }
};

// Improved Deterministic Generator: Uses symbol + current hour as seed
// This ensures the chart is SAME on every refresh even if offline.
const generateHistoryFallback = (
  symbol: SymbolDef,
  timeframeId: string,
  count: number = 200
): Candle[] => {
  const timeframe = TIMEFRAMES.find(t => t.id === timeframeId) || TIMEFRAMES[0];
  const now = Date.now();
  // Round to nearest Hour to keep chart static across refreshes within the same hour
  const hourTs = Math.floor(now / 3600000) * 3600000;
  let currentTime = (now - (now % timeframe.ms)) - (count * timeframe.ms);

  let currentPrice = symbol.basePrice;
  const data: Candle[] = [];

  // Create a unique seed for this Symbol + Timeframe + Hour
  const seedString = `${symbol.id}-${timeframeId}-${hourTs}`;
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) seed += seedString.charCodeAt(i);

  // Pre-generate a list of deterministic values to prevent drift
  const getRand = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    const r1 = getRand(seed + i);
    const r2 = getRand(seed + i * 2);

    const volatility = symbol.volatility * (1 + getRand(seed + i * 3));
    const move = (r1 - 0.5) * volatility * currentPrice * 0.1;

    const open = currentPrice;
    const close = currentPrice + move;
    const high = Math.max(open, close) + getRand(seed + i * 4) * Math.abs(move);
    const low = Math.min(open, close) - getRand(seed + i * 5) * Math.abs(move);

    data.push({
      time: currentTime,
      open, high, low, close,
      volume: Math.floor(1000 + getRand(seed + i * 6) * 5000)
    });

    currentPrice = close;
    currentTime += timeframe.ms;
  }
  return data;
};

// --- Advanced Signal Logic ---

export const calculateSignals = (data: Candle[], config: AlgoConfig): Signal[] => {
  if (data.length < 50) return [];

  const signals: Signal[] = [];

  // 1. Sensitivity Logic
  const sensitivity = Math.max(1, Math.min(10, config.sensitivity));

  // Cooldown
  const cooldownCandles = Math.max(2, Math.round(18 - (sensitivity * 1.6)));

  // Momentum Lookback
  const momentumLookback = Math.max(5, Math.round(22 - (sensitivity * 1.7)));

  // RSI Thresholds
  const rsiLower = 25 + ((sensitivity - 1) * 2.2);
  const rsiUpper = 75 - ((sensitivity - 1) * 2.2);

  const candleDuration = data.length > 1 ? data[1].time - data[0].time : 60000;

  // 2. Pre-calculate Indicators
  const ema9 = calculateEMA(data, 9);
  const ema21 = calculateEMA(data, 21);
  const ema50 = calculateEMA(data, 50);
  const rsiArray = calculateRSIArray(data, 14);
  const atrArray = calculateATR(data, 14);

  // Iterate through historical data
  const startIndex = 50;

  for (let i = startIndex; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];
    const atr = atrArray[i];

    let isSignal = false;
    let type: 'LONG' | 'SHORT' = 'LONG';
    let reason = '';

    // --- Strategy 1: Trend Following (EMA Crossover) ---
    if (config.strategy === 'TREND') {
      const bullCross = prev.close < ema21[i - 1] && current.close > ema21[i] && ema9[i] > ema21[i];
      const bearCross = prev.close > ema21[i - 1] && current.close < ema21[i] && ema9[i] < ema21[i];

      if (bullCross && current.close > ema50[i]) {
        isSignal = true; type = 'LONG'; reason = 'EMA Trend Crossover';
      } else if (bearCross && current.close < ema50[i]) {
        isSignal = true; type = 'SHORT'; reason = 'EMA Trend Crossover';
      }
    }

    // --- Strategy 2: Reversal (Bollinger Band Rejection) ---
    else if (config.strategy === 'REVERSAL') {
      const stdDev = calculateStdDev(data, 20, i, ema21[i]);
      const upperBB = ema21[i] + (stdDev * 2);
      const lowerBB = ema21[i] - (stdDev * 2);
      const rsi = rsiArray[i];

      // Dynamic thresholds based on sensitivity
      if (prev.low < lowerBB && current.close > lowerBB && rsi < rsiLower && current.close > current.open) {
        isSignal = true; type = 'LONG'; reason = `BB Rejection (RSI < ${Math.round(rsiLower)})`;
      }
      else if (prev.high > upperBB && current.close < upperBB && rsi > rsiUpper && current.close < current.open) {
        isSignal = true; type = 'SHORT'; reason = `BB Rejection (RSI > ${Math.round(rsiUpper)})`;
      }
    }

    // --- Strategy 3: Momentum (Donchian Breakout) ---
    else if (config.strategy === 'MOMENTUM') {
      let highestHigh = 0;
      let lowestLow = Infinity;
      // Dynamic lookback based on sensitivity
      for (let j = 1; j <= momentumLookback; j++) {
        highestHigh = Math.max(highestHigh, data[i - j].high);
        lowestLow = Math.min(lowestLow, data[i - j].low);
      }

      if (current.close > highestHigh) {
        isSignal = true; type = 'LONG'; reason = `${momentumLookback}-Period Breakout`;
      } else if (current.close < lowestLow) {
        isSignal = true; type = 'SHORT'; reason = `${momentumLookback}-Period Breakdown`;
      }
    }

    // --- Signal Generation & Confidence Calculation ---

    if (isSignal) {
      // Confidence Logic (0-100)
      let confScore = 60; // Base confidence

      const rsi = rsiArray[i];
      const vol = current.volume;
      let avgVol = 0;
      for (let k = 1; k <= 10; k++) avgVol += data[i - k].volume;
      avgVol /= 10;

      // 1. RSI Factor
      if (type === 'LONG') {
        if (rsi < 35) confScore += 15; // Oversold + Trend Reversal
        else if (rsi > 60) confScore -= 10; // Overbought risk
      } else {
        if (rsi > 65) confScore += 15; // Overbought + Trend Reversal
        else if (rsi < 40) confScore -= 10; // Oversold risk
      }

      // 2. Volume Factor
      if (vol > avgVol * 1.5) confScore += 15;
      else if (vol > avgVol) confScore += 5;

      // 3. Trend Alignment Factor
      const isTrendLong = current.close > ema50[i] && ema21[i] > ema50[i];
      const isTrendShort = current.close < ema50[i] && ema21[i] < ema50[i];

      if ((type === 'LONG' && isTrendLong) || (type === 'SHORT' && isTrendShort)) confScore += 10;

      confScore = Math.max(30, Math.min(98, confScore));

      const lastSignal = signals[signals.length - 1];
      const timeSinceLast = lastSignal ? current.time - lastSignal.candleTime : Infinity;
      const minTime = cooldownCandles * candleDuration;

      if (timeSinceLast >= minTime) {
        const volatilityBuffer = atr * 2.0;
        const rewardTarget = volatilityBuffer * config.riskReward;

        signals.push({
          id: `sig-${current.time}`,
          candleTime: current.time,
          type: type,
          entryPrice: current.close,
          stopLoss: type === 'LONG' ? current.close - volatilityBuffer : current.close + volatilityBuffer,
          takeProfit: type === 'LONG' ? current.close + rewardTarget : current.close - rewardTarget,
          status: 'ACTIVE',
          reason: reason,
          confidence: confScore
        });
      }
    }
  }

  return signals;
};

// Real Tick Fetcher
export const fetchLatestTick = async (symbol: SymbolDef): Promise<number | null> => {
  const pair = SYMBOL_MAP[symbol.id] || symbol.id.toLowerCase();
  try {
    const response = await fetch(`${MARKET_BASE}/ticker/${pair}/`);
    if (!response.ok) return null;
    const data = await response.json();
    return parseFloat(data.last);
  } catch {
    return null;
  }
};

// Updated simulateTick to accept an optional real price
export const updateCandleWithTick = (currentCandle: Candle, symbolVolatility: number, realPrice?: number): Candle => {
  if (realPrice !== undefined) {
    return {
      ...currentCandle,
      close: realPrice,
      high: Math.max(currentCandle.high, realPrice),
      low: Math.min(currentCandle.low, realPrice),
      volume: currentCandle.volume + Math.floor(Math.random() * 10)
    };
  }

  // Fallback: Simulation if real price not provided
  const baseTickVol = currentCandle.close * symbolVolatility * 0.005;
  const currentRange = currentCandle.high - currentCandle.low;
  const effectiveVol = Math.max(currentRange * 0.15, baseTickVol);

  let bias = 0;
  if (Math.abs(currentCandle.close - currentCandle.open) < baseTickVol * 0.1) {
    bias = Math.random() > 0.5 ? baseTickVol * 0.2 : -baseTickVol * 0.2;
  }

  const move = ((Math.random() - 0.5) * effectiveVol) + bias;
  const drift = (Math.random() - 0.5) * (baseTickVol * 0.5);

  let newClose = currentCandle.close + move + drift;
  const newHigh = Math.max(currentCandle.high, newClose, currentCandle.open);
  const newLow = Math.min(currentCandle.low, newClose, currentCandle.open);

  return {
    ...currentCandle,
    close: newClose,
    high: newHigh,
    low: newLow,
    volume: currentCandle.volume + Math.floor(Math.random() * 25)
  };
};