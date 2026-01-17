import { Candle, SymbolDef, AlgoConfig, Signal } from '../types';
import { TIMEFRAMES } from '../constants';

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

// State to hold simulation context
let marketTrend = 0; // -1 to 1
let marketPhase = 0; // 0 to 2PI

export const generateHistory = (
  symbol: SymbolDef, 
  timeframeId: string, 
  count: number = 200,
  targetEndPrice?: number
): Candle[] => {
  const timeframe = TIMEFRAMES.find(t => t.id === timeframeId) || TIMEFRAMES[0];
  const now = Date.now();
  let currentTime = now - (now % timeframe.ms) - (count * timeframe.ms);
  
  let currentPrice = symbol.basePrice;
  const data: Candle[] = [];
  
  // Initialize random phase
  marketPhase = Math.random() * Math.PI * 2;
  marketTrend = (Math.random() - 0.5) * 0.5;

  for (let i = 0; i < count; i++) {
    // Evolve trend slowly (Perlin-ish noise)
    marketPhase += 0.05;
    const cycle = Math.sin(marketPhase); // Cyclic component
    marketTrend += (Math.random() - 0.5) * 0.1; // Random drift
    marketTrend = Math.max(-1, Math.min(1, marketTrend)); // Clamp

    // Volatility varies with trend intensity
    const volatility = symbol.volatility * (1 + Math.abs(marketTrend)) * 0.5;
    
    const noise = (Math.random() - 0.5) * volatility * currentPrice;
    const trendMove = (marketTrend * 0.05 + cycle * 0.02) * volatility * currentPrice;
    
    const move = noise + trendMove;
    const open = currentPrice;
    const close = currentPrice + move;
    
    // Wicks
    let high = Math.max(open, close) + Math.random() * Math.abs(move) * 0.5;
    let low = Math.min(open, close) - Math.random() * Math.abs(move) * 0.5;
    
    // Ensure high/low consistency
    if (high < Math.max(open, close)) high = Math.max(open, close) + symbol.basePrice * 0.0001;
    if (low > Math.min(open, close)) low = Math.min(open, close) - symbol.basePrice * 0.0001;

    // Volume is higher on strong moves
    const volume = Math.floor(1000 + Math.abs(move / currentPrice) * 1000000 + Math.random() * 500);

    data.push({
      time: currentTime,
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
    currentTime += timeframe.ms;
  }

  // --- Price Continuity Logic ---
  // If we provided a target price (e.g. from switching timeframes), shift the whole history
  // so the last candle closes exactly at that price.
  if (targetEndPrice !== undefined && data.length > 0) {
    const lastClose = data[data.length - 1].close;
    const diff = targetEndPrice - lastClose;

    return data.map(d => ({
      ...d,
      open: d.open + diff,
      high: d.high + diff,
      low: d.low + diff,
      close: d.close + diff
    }));
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
    const prev = data[i-1];
    const atr = atrArray[i];

    let isSignal = false;
    let type: 'LONG' | 'SHORT' = 'LONG';
    let reason = '';

    // --- Strategy 1: Trend Following (EMA Crossover) ---
    if (config.strategy === 'TREND') {
      const bullCross = prev.close < ema21[i-1] && current.close > ema21[i] && ema9[i] > ema21[i];
      const bearCross = prev.close > ema21[i-1] && current.close < ema21[i] && ema9[i] < ema21[i];

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
        highestHigh = Math.max(highestHigh, data[i-j].high);
        lowestLow = Math.min(lowestLow, data[i-j].low);
      }

      if (current.close > highestHigh) {
        isSignal = true; type = 'LONG'; reason = `${momentumLookback}-Period Breakout`;
      } else if (current.close < lowestLow) {
        isSignal = true; type = 'SHORT'; reason = `${momentumLookback}-Period Breakdown`;
      }
    }

    // --- Filters ---

    if (isSignal && config.useRSIFilter) {
      const rsi = rsiArray[i];
      if (type === 'LONG' && (rsi < 40 || rsi > 70)) isSignal = false; 
      if (type === 'SHORT' && (rsi > 60 || rsi < 30)) isSignal = false;
    }

    if (isSignal && config.useVolumeFilter) {
      let avgVol = 0;
      for(let k=1; k<=10; k++) avgVol += data[i-k].volume;
      avgVol /= 10;
      if (current.volume < avgVol * 1.2) isSignal = false; 
    }

    // --- Signal Generation & Cooldown Check ---
    
    if (isSignal) {
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
          reason: reason
        });
      }
    }
  }

  return signals;
};

// Simulate a live tick update 
export const simulateTick = (currentCandle: Candle, symbolVolatility: number): Candle => {
    // 0.01 = 1% baseline daily volatility
    // We want a live tick to be a small fraction of that, but visible.
    // Increased from 0.002 to 0.005 for better visibility
    const baseTickVol = currentCandle.close * symbolVolatility * 0.005; 
    
    // Use the larger of existing range or base tick vol to ensure new candles (range=0) move immediately
    const currentRange = currentCandle.high - currentCandle.low;
    const effectiveVol = Math.max(currentRange * 0.15, baseTickVol);
    
    // Random Walk with Momentum
    // Add bias to move away from open if close is too close to open (prevents doji-lock)
    let bias = 0;
    if (Math.abs(currentCandle.close - currentCandle.open) < baseTickVol * 0.1) {
        bias = Math.random() > 0.5 ? baseTickVol * 0.2 : -baseTickVol * 0.2;
    }

    const move = ((Math.random() - 0.5) * effectiveVol) + bias;
    const drift = (Math.random() - 0.5) * (baseTickVol * 0.5);

    let newClose = currentCandle.close + move + drift;
    
    // Enforce logic: High must be >= Close, Low must be <= Close
    // Also High must be >= Open, Low must be <= Open
    // This ensures wicks form correctly immediately
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