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

// Average Directional Index (ADX)
function calculateADX(data: Candle[], period: number): number[] {
  if (data.length < period * 2) return new Array(data.length).fill(0);

  const tr: number[] = new Array(data.length).fill(0);
  const plusDM: number[] = new Array(data.length).fill(0);
  const minusDM: number[] = new Array(data.length).fill(0);

  // 1. Calculate TR and DM
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low - data[i - 1].close);
    tr[i] = Math.max(hl, hc, lc);

    const up = data[i].high - data[i - 1].high;
    const down = data[i - 1].low - data[i].low;

    if (up > down && up > 0) plusDM[i] = up;
    if (down > up && down > 0) minusDM[i] = down;
  }

  // 2. Smooth TR, +DM, -DM (Wilder's Smoothing)
  const smoothTR: number[] = new Array(data.length).fill(0);
  const smoothPlusDM: number[] = new Array(data.length).fill(0);
  const smoothMinusDM: number[] = new Array(data.length).fill(0);

  // First value is simple sum
  let sumTR = 0, sumPlus = 0, sumMinus = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += tr[i];
    sumPlus += plusDM[i];
    sumMinus += minusDM[i];
  }
  smoothTR[period] = sumTR; // Note: Strictly it should be average or sum, Wilder uses Sum for first, then smooths
  smoothPlusDM[period] = sumPlus;
  smoothMinusDM[period] = sumMinus;

  for (let i = period + 1; i < data.length; i++) {
    smoothTR[i] = smoothTR[i - 1] - (smoothTR[i - 1] / period) + tr[i];
    smoothPlusDM[i] = smoothPlusDM[i - 1] - (smoothPlusDM[i - 1] / period) + plusDM[i];
    smoothMinusDM[i] = smoothMinusDM[i - 1] - (smoothMinusDM[i - 1] / period) + minusDM[i];
  }

  // 3. Calculate DX and ADX
  const adx: number[] = new Array(data.length).fill(0);
  const dx: number[] = new Array(data.length).fill(0);

  for (let i = period; i < data.length; i++) {
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;

    if (plusDI + minusDI === 0) dx[i] = 0;
    else dx[i] = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
  }

  // ADX is smoothed DX
  // First ADX is average of DX
  let sumDX = 0;
  for (let i = period; i < period * 2; i++) sumDX += dx[i];
  adx[period * 2 - 1] = sumDX / period; // Approximation for first point

  for (let i = period * 2; i < data.length; i++) {
    adx[i] = ((adx[i - 1] * (period - 1)) + dx[i]) / period;
  }

  return adx;
}


// --- Realistic Data Generator (Market Cycles) ---

// --- Real Market Data Fetcher ---

export const fetchHistory = async (
  symbol: SymbolDef,
  timeframeId: string,
  count: number = 300
): Promise<Candle[]> => {
  // Directly use fallback for 1s as most APIs don't support 1s OHLC history
  if (timeframeId === '1s') {
    const latestPrice = await fetchLatestTick(symbol);
    return generateHistoryFallback(symbol, timeframeId, count, latestPrice ?? undefined);
  }

  const pair = SYMBOL_MAP[symbol.id] || symbol.id.toLowerCase();
  const step = INTERVAL_MAP[timeframeId] || '60';

  try {
    const response = await fetch(
      `${MARKET_BASE}/ohlc/${pair}/?step=${step}&limit=${count}`
    );

    if (!response.ok) throw new Error(`Status: ${response.status}`);

    const json = await response.json();
    const rawData = json.data.ohlc;

    if (!Array.isArray(rawData) || rawData.length === 0) throw new Error("Empty Data");

    const parsedData = rawData.map((d: any) => ({
      time: parseInt(d.timestamp) * 1000,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseFloat(d.volume)
    })).sort((a: Candle, b: Candle) => a.time - b.time);

    // Validate Data Quality
    if (parsedData.some((d: Candle) => isNaN(d.close) || d.close <= 0)) {
      throw new Error("Corrupt Data");
    }

    return parsedData;
  } catch (error) {
    console.warn(`Market API Down, using Deterministic Fallback for ${symbol.id}:`, error);
    const latestPrice = await fetchLatestTick(symbol);
    return generateHistoryFallback(symbol, timeframeId, count, latestPrice ?? undefined);
  }
};

const generateHistoryFallback = (
  symbol: SymbolDef,
  timeframeId: string,
  count: number = 200,
  targetPrice?: number
): Candle[] => {
  const timeframe = TIMEFRAMES.find(t => t.id === timeframeId) || TIMEFRAMES[1];
  const now = Date.now();

  const alignedNow = Math.floor(now / timeframe.ms) * timeframe.ms;
  const startTime = alignedNow - (count * timeframe.ms);

  let baseSeed = 0;
  for (let i = 0; i < symbol.id.length; i++) baseSeed += symbol.id.charCodeAt(i);

  const getRand = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const volMult = symbol.type === 'CRYPTO' ? 1.5 : 0.5;
  const stepMs = timeframeId === '1s' ? 1000 : 60000;

  // 1. Generate path
  const path = new Map<number, number>();
  let p = 1.0;
  const walkStart = Math.floor(startTime / 3600000) * 3600000;

  for (let t = walkStart; t <= alignedNow; t += stepMs) {
    const stepSeed = baseSeed + (t / stepMs);
    const r1 = getRand(stepSeed);
    const driftScale = timeframeId === '1s' ? 0.001 : 0.003; // Increased 1s volatility
    p += (r1 - 0.5) * symbol.volatility * p * driftScale * volMult;
    path.set(t, p);
  }

  const endRelPrice = path.get(alignedNow) || p;
  const absoluteBase = (targetPrice ?? symbol.basePrice) / endRelPrice;

  const data: Candle[] = [];

  for (let t = startTime; t <= alignedNow; t += timeframe.ms) {
    const pricesInBar: number[] = [];

    // Aggregate from the path
    for (let mt = t; mt < t + timeframe.ms; mt += stepMs) {
      const mp = path.get(mt);
      if (mp !== undefined) pricesInBar.push(mp * absoluteBase);
    }

    if (pricesInBar.length > 0) {
      let open = pricesInBar[0];
      let close = pricesInBar[pricesInBar.length - 1];
      let high = Math.max(...pricesInBar);
      let low = Math.min(...pricesInBar);

      // FOR 1S CANDLES: If they are flat, fake a tiny spread for visual wicks
      if (timeframeId === '1s' && pricesInBar.length === 1) {
        const seed = baseSeed + (t / 1000);
        const spread = open * symbol.volatility * 0.0002;
        high = open + getRand(seed * 1.1) * spread;
        low = open - getRand(seed * 1.2) * spread;
        close = open + (getRand(seed * 1.3) - 0.5) * spread;
      }

      data.push({
        time: t,
        open, high, low, close,
        volume: Math.floor(1000 + getRand(baseSeed + t / 1000) * 5000)
      });
    }
  }

  return data;
};

// Weighted Moving Average (WMA)
function calculateWMA(data: number[], period: number): number[] {
  const wma: number[] = new Array(data.length).fill(0);
  const weights = (period * (period + 1)) / 2;

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - (period - 1) + j] * (j + 1);
    }
    wma[i] = sum / weights;
  }
  return wma;
}

// Hull Moving Average (HMA) - Reducing Lag
function calculateHMA(data: Candle[], period: number): number[] {
  const closes = data.map(d => d.close);

  // 1. WMA(n/2) * 2
  const wmaHalfLength = Math.floor(period / 2);
  const wmaHalf = calculateWMA(closes, wmaHalfLength).map(v => v * 2);

  // 2. WMA(n)
  const wmaFull = calculateWMA(closes, period);

  // 3. Diff = WMA(n/2)*2 - WMA(n)
  const diff = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    diff[i] = wmaHalf[i] - wmaFull[i];
  }

  // 4. WMA(sqrt(n)) of Diff
  const sqrtPeriod = Math.floor(Math.sqrt(period));
  return calculateWMA(diff, sqrtPeriod);
}

// SuperTrend Indicator
function calculateSuperTrend(data: Candle[], atr: number[], factor: number = 3, period: number = 10): { superTrend: number[], direction: number[] } {
  const superTrend: number[] = new Array(data.length).fill(0);
  const direction: number[] = new Array(data.length).fill(1); // 1 = Buy, -1 = Sell
  const upperBand: number[] = new Array(data.length).fill(0);
  const lowerBand: number[] = new Array(data.length).fill(0);

  // Initialize
  for (let i = 0; i < period; i++) {
    superTrend[i] = data[i].close;
  }

  for (let i = period; i < data.length; i++) {
    const hl2 = (data[i].high + data[i].low) / 2;
    const currentAtr = atr[i];

    // Calculate bands
    let currUpper = hl2 + (factor * currentAtr);
    let currLower = hl2 - (factor * currentAtr);

    // Filter bands (don't move against the trend)
    if (currUpper < upperBand[i - 1] || data[i - 1].close > upperBand[i - 1]) {
      upperBand[i] = currUpper;
    } else {
      upperBand[i] = upperBand[i - 1];
    }

    if (currLower > lowerBand[i - 1] || data[i - 1].close < lowerBand[i - 1]) {
      lowerBand[i] = currLower;
    } else {
      lowerBand[i] = lowerBand[i - 1];
    }

    // Determine Direction
    let currDir = direction[i - 1];

    // Flip to Uptrend
    if (currDir === -1 && data[i].close > upperBand[i - 1]) {
      currDir = 1;
    }
    // Flip to Downtrend
    else if (currDir === 1 && data[i].close < lowerBand[i - 1]) {
      currDir = -1;
    }

    direction[i] = currDir;
    superTrend[i] = currDir === 1 ? lowerBand[i] : upperBand[i];
  }

  return { superTrend, direction };
}

// MACD (Moving Average Convergence Divergence)
function calculateMACD(data: Candle[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): { macdLine: number[], signalLine: number[], histogram: number[] } {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);

  const macdLine: number[] = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    macdLine[i] = fastEMA[i] - slowEMA[i];
  }

  // Signal line is EMA of MACD Line
  const signalLine: number[] = new Array(data.length).fill(0);
  const k = 2 / (signalPeriod + 1);

  // Initial SMA for Signal Line
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) sum += macdLine[i];
  signalLine[signalPeriod - 1] = sum / signalPeriod;

  for (let i = signalPeriod; i < data.length; i++) {
    signalLine[i] = (macdLine[i] * k) + (signalLine[i - 1] * (1 - k));
  }

  const histogram: number[] = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    histogram[i] = macdLine[i] - signalLine[i];
  }

  return { macdLine, signalLine, histogram };
}


// --- Advanced Signal Logic ---

export const calculateSignals = (data: Candle[], config: AlgoConfig, timeframeId?: string): Signal[] => {
  if (data.length < 50) return [];

  const signals: Signal[] = [];

  // 1. Sensitivity Logic (1-100)
  const sensitivity = Math.max(1, Math.min(100, config.sensitivity));

  // Cooldown - Higher Sensitivity = Lower Cooldown
  // Range: ~2 to 20 candles
  let cooldownCandles = Math.max(2, Math.round(20 - (sensitivity * 0.18)));
  if (timeframeId === '1s') cooldownCandles *= 4;

  // Momentum Lookback - Higher Sensitivity = Shorter Lookback (Faster reaction)
  // Range: ~5 to 30 candles
  const momentumLookback = Math.max(5, Math.round(30 - (sensitivity * 0.25)));

  // RSI Thresholds - Higher Sensitivity = Wider acceptance range
  // Lower: Grows from 20 to 45 (Easier to find dip)
  // Upper: Shrinks from 80 to 55 (Easier to find peak)
  const rsiLower = 20 + (sensitivity * 0.25);
  const rsiUpper = 80 - (sensitivity * 0.25);

  const candleDuration = data.length > 1 ? data[1].time - data[0].time : 60000;

  // 2. Pre-calculate Indicators
  const ema9 = calculateEMA(data, 9);
  const ema21 = calculateEMA(data, 21);
  const ema50 = calculateEMA(data, 50);
  const ema200 = calculateEMA(data, 200); // For Major Trend Filter
  const rsiArray = calculateRSIArray(data, 14);
  const atrArray = calculateATR(data, 14);
  const adxArray = calculateADX(data, 14);
  const macdData = calculateMACD(data);

  // GainZAlgo Specific Indicators (HMA + SuperTrend)
  // Dynamic SuperTrend Settings based on sensitivity
  // Factor: 4.0 (Safe) -> 1.5 (Aggressive)
  const stFactor = 4.0 - (sensitivity * 0.025);
  // Period: 14 (Slow) -> 7 (Fast)
  const stPeriod = Math.max(7, Math.round(14 - (sensitivity * 0.07)));

  const hma9 = calculateHMA(data, 9);
  const stData = calculateSuperTrend(data, atrArray, stFactor, stPeriod);

  // Iterate through historical data
  const startIndex = 200; // Need 200 for EMA200

  for (let i = startIndex; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];
    const atr = atrArray[i];
    const adx = adxArray[i];

    let isSignal = false;
    let type: 'LONG' | 'SHORT' = 'LONG';
    let reason = '';

    // --- Strategy 1: Smart Trend (GainZAlgo Logic) ---
    // Uses SuperTrend for Direction + HMA for fast entry timing
    if (config.strategy === 'TREND') {
      const stDir = stData.direction[i];
      const hma = hma9[i];
      const prevHma = hma9[i - 1];

      // SuperTrend Flip (Major Trend Change)
      const stFlipUp = stData.direction[i - 1] === -1 && stDir === 1;
      const stFlipDown = stData.direction[i - 1] === 1 && stDir === -1;

      // HMA Crossover (Pullback Entry in Trend)
      const hmaCrossUp = prev.close < prevHma && current.close > hma && stDir === 1;
      const hmaCrossDown = prev.close > prevHma && current.close < hma && stDir === -1;

      if (stFlipUp) {
        isSignal = true; type = 'LONG'; reason = 'SuperTrend Buy Flip';
      } else if (stFlipDown) {
        isSignal = true; type = 'SHORT'; reason = 'SuperTrend Sell Flip';
      } else if (hmaCrossUp) {
        isSignal = true; type = 'LONG'; reason = 'HMA Trend Entry';
      } else if (hmaCrossDown) {
        isSignal = true; type = 'SHORT'; reason = 'HMA Trend Entry';
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
      // 1. MACD Filter
      if (config.useMacdFilter) {
        const hist = macdData.histogram[i];
        const histPrev = macdData.histogram[i - 1];
        // Simple logic: Long requires Green Histogram (or trending up), Short requires Red
        if (type === 'LONG' && hist < 0) {
          isSignal = false;
          continue;
        }
        if (type === 'SHORT' && hist > 0) {
          isSignal = false;
          continue;
        }
        reason += ' (MACD)';
      }

      // 2. EMA 200 Major Trend Filter
      if (config.useEmaTrendFilter) {
        const above200 = current.close > ema200[i];
        if (type === 'LONG' && !above200) {
          isSignal = false;
          continue;
        }
        if (type === 'SHORT' && above200) {
          isSignal = false;
          continue;
        }
        reason += ' (Trend)';
      }

      // 3. ADX Filter Check
      if (config.useAdxFilter && adx < config.adxThreshold) {
        // Trend is too weak, ignore signal
        isSignal = false;
        continue;
      } else if (config.useAdxFilter) {
        reason += ` (ADX ${adx.toFixed(1)})`;
      }

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

      // 4. ADX Boost
      if (adx > 30) confScore += 10;

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

  // Skip API for non-crypto if we know the API (likely Bitstamp) doesn't support them
  // This prevents unnecessary 404s and delays
  if (symbol.type !== 'CRYPTO') return null;

  try {
    const response = await fetch(`${MARKET_BASE}/ticker/${pair}/`);
    if (!response.ok) return null;
    const data = await response.json();
    const val = parseFloat(data.last);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
};

// Updated simulateTick to accept an optional real price and add micro-jitter
export const updateCandleWithTick = (currentCandle: Candle, symbolVolatility: number, realPrice?: number): Candle => {
  // Base volatility for micro-movements
  const baseTickVol = currentCandle.close * symbolVolatility * 0.002;

  // Simulated drift to keep it moving even if realPrice is stagnant or missing
  const drift = (Math.random() - 0.5) * baseTickVol;

  if (realPrice !== undefined) {
    // If we have a real price, we "pull" the candle towards it but keep micro-jitter for visual life
    // This prevents the chart from looking "frozen" if the API ticker is slow to update.
    const alpha = 0.3; // Smoothing factor
    const targetClose = (realPrice * (1 - alpha)) + (currentCandle.close * alpha) + (drift * 0.2);

    return {
      ...currentCandle,
      close: targetClose,
      high: Math.max(currentCandle.high, targetClose, realPrice),
      low: Math.min(currentCandle.low, targetClose, realPrice),
      volume: currentCandle.volume + Math.floor(Math.random() * 5)
    };
  }

  // Fallback: Full simulation
  const move = ((Math.random() - 0.5) * baseTickVol * 2) + (drift * 0.5);
  let newClose = currentCandle.close + move;

  // Prevent excessive drift from initial open
  const maxDev = currentCandle.open * 0.02;
  if (Math.abs(newClose - currentCandle.open) > maxDev) {
    newClose = currentCandle.open + (Math.sign(newClose - currentCandle.open) * maxDev);
  }

  return {
    ...currentCandle,
    close: newClose,
    high: Math.max(currentCandle.high, newClose),
    low: Math.min(currentCandle.low, newClose),
    volume: currentCandle.volume + Math.floor(Math.random() * 15)
  };
};