import { GoogleGenAI } from "@google/genai";
import { Candle, Signal, SymbolDef } from '../types';

export const analyzeMarket = async (
  symbol: SymbolDef,
  timeframe: string,
  candles: Candle[],
  signals: Signal[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare data summary for AI (last 20 candles + recent signals)
    const recentCandles = candles.slice(-20).map(c => ({
      t: new Date(c.time).toLocaleTimeString(),
      o: c.open.toFixed(2),
      h: c.high.toFixed(2),
      l: c.low.toFixed(2),
      c: c.close.toFixed(2)
    }));

    const recentSignals = signals.filter(s => s.candleTime > candles[candles.length - 20].time);

    const prompt = `
      You are a senior GainzAlgo Trading Analyst. 
      Analyze this market data for ${symbol.name} (${timeframe}).
      
      Recent Market Data (OHLC):
      ${JSON.stringify(recentCandles, null, 2)}
      
      Recent Algo Signals Detected:
      ${JSON.stringify(recentSignals, null, 2)}
      
      Provide a concise, professional executive summary formatted in Markdown.
      
      STRUCTURE YOUR RESPONSE WITH THESE EXACT SECTIONS:
      1. Market Structure (Bullish/Bearish/Ranging)
      2. Key Levels (Support/Resistance estimation based on data)
      3. Algo Performance Review (Are signals aligning with trend?)
      4. Recommendation (HOLD, BUY, or SELL)
      5. Trade Setup (Provide specific Entry Price, TP, and SL if a trade is recommended, otherwise state N/A)
      
      Keep it strictly analytical and professional.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thought for this
      }
    });

    return response.text || "Analysis currently unavailable.";

  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check API Key or try again later.";
  }
};
