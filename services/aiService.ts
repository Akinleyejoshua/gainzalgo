import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Candle, Signal, SymbolDef } from '../types';

export interface AIAnalysisResponse {
  analysis: string;
  signals: Signal[];
  provider?: string;
}

// Helper to detect if a key is a placeholder or empty
const isValidKey = (key: string): boolean => {
  return !!key && key !== "your_key_here" && !key.includes("insert_");
};

// Rate limiting prevention
let lastRequestTime = 0;
const COOLDOWN_MS = 20000; // 20 second cooldown between AI triggers

// Robust env retrieval for Vite
const getEnv = (key: string): string => {
  return (import.meta as any).env[key] || (process.env as any)[key] || "";
};

export const analyzeWithGemini = async (
  symbol: SymbolDef,
  timeframe: string,
  candles: Candle[],
  existingSignals: Signal[]
): Promise<AIAnalysisResponse> => {
  const metaKey = getEnv("VITE_META_AI_API_KEY") || getEnv("META_AI_API_KEY");
  const metaBase = getEnv("VITE_META_AI_BASE_URL") || 'https://api.openai.com/v1'; // Default to OpenAI compatible
  const metaModel = getEnv("VITE_META_AI_MODEL") || 'meta-llama/llama-3.1-70b-instruct';

  const groqKey = getEnv("VITE_GROQ_API_KEY") || getEnv("GROK_API_KEY");
  const groqBase = getEnv("VITE_GROQ_BASE_URL") || 'https://api.groq.com/openai/v1';
  const geminiKey = getEnv("VITE_GEMINI_API_KEY") || getEnv("GEMINI_API_KEY");

  // --- Frequency Protection ---
  const now = Date.now();
  if (now - lastRequestTime < COOLDOWN_MS) {
    return {
      analysis: "Intelligence scan throttled. Please wait 20s between requests to prevent API rate limits.",
      signals: [],
      provider: "Throttled"
    };
  }
  lastRequestTime = now;

  // --- Data Preparation (Common) ---
  const dataWindow = 30;
  const latestCandleTime = candles[candles.length - 1]?.time || Date.now();
  const recentCandles = candles.slice(-dataWindow).map(c => ({
    t: new Date(c.time).toISOString(),
    o: c.open.toFixed(4),
    h: c.high.toFixed(4),
    l: c.low.toFixed(4),
    c: c.close.toFixed(4),
    v: c.volume.toFixed(0)
  }));

  const recentSignals = existingSignals.filter(s => s.candleTime > (candles[candles.length - dataWindow]?.time || 0));

  const prompt = `
    You are GainzAlgo AI, a professional quantitative trading model.
    Analyze the market for ${symbol.name} on the ${timeframe} timeframe.

    MARKET DATA (Last ${dataWindow} periods):
    ${JSON.stringify(recentCandles)}

    EXISTING ALGO SIGNALS (Technical):
    ${JSON.stringify(recentSignals)}

    TASK:
    1. **ELABORATE ANALYSIS**: Provide a comprehensive, professional market analysis in Markdown. This must be detailed and insightful, not just a summary. 
       Use the following structure:
       - **## 📊 MARKET OVERVIEW**: Current trend bias, momentum strength, and overall sentiment.
       - **## 📉 PRICE ACTION & VOLATILITY**: Discussion on recent candle structures, volume patterns, and ATR-based volatility.
       - **## 🗺️ KEY STRATEGIC LEVELS**: Identify specific Support/Resistance zones and liquidity pockets.
       - **## 🛠️ TACTICAL EXECUTION PLAN**: A dedicated, detailed trade setup analysis that includes:
         - *Strategic Entry Zone*
         - *Aggressive vs. Conservative Take Profit targets*
         - *Hard Invalidation Point (Stop Loss logic)*
         - *Risk-to-Reward Ratio analysis*
    
    2. **ALPHA SIGNAL**: Identify the SINGLE most probable, high-conviction trade setup (Buy or Sell) for the structured side-panel. This signal must be based on the LATEST candle.
    3. **CONFIDENCE FILTER**: Confidence must be > 75% for an Alpha Signal. If it's lower, still provide the elaborate analysis but return an empty 'aiSignals' array.
    4. **CONSISTENCY**: Ensure the 'candleTime' in the JSON matches the timestamp of the VERY LAST candle in the provided data.
    
    FORMAT YOUR ENTIRE RESPONSE AS A JSON OBJECT:
    {
      "analysis": "Your extremely detailed markdown analysis here...",
      "aiSignals": [
        {
          "type": "LONG" | "SHORT",
          "entryPrice": number,
          "stopLoss": number,
          "takeProfit": number,
          "reason": "Short summary of the core logic",
          "confidence": number,
          "candleTime": number
        }
      ]
    }

    CRITICAL: The analysis must be long, professional, and data-driven. Do not be generic. Mention specific prices from the data. ONLY respond with the JSON object.
  `;

  const providerErrors: string[] = [];

  // --- 1. Try Meta AI (Llama 3) First ---
  if (isValidKey(metaKey)) {
    try {
      const meta = new OpenAI({
        apiKey: metaKey,
        baseURL: metaBase,
        dangerouslyAllowBrowser: true
      });

      const response = await meta.chat.completions.create({
        model: metaModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const responseText = (response.choices[0].message.content || "{}").replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(responseText);

      return {
        analysis: parsed.analysis || "Analysis completed.",
        signals: formatAISignals(parsed.aiSignals, latestCandleTime),
        provider: "Meta AI (Llama 3)"
      };
    } catch (error: any) {
      const status = error?.status;
      providerErrors.push(`Meta AI: ${status === 429 ? 'Rate Limit' : 'Error ' + (status || 'Unknown')}`);
      console.warn("Meta AI Analysis failed, trying Groq:", error);
    }
  } else {
    providerErrors.push("Meta AI: No valid API key.");
  }

  // --- 2. Try Groq ---
  if (isValidKey(groqKey)) {
    try {
      const groq = new OpenAI({
        apiKey: groqKey,
        baseURL: groqBase,
        dangerouslyAllowBrowser: true
      });

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const responseText = (response.choices[0].message.content || "{}").replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(responseText);

      return {
        analysis: parsed.analysis || "Analysis completed.",
        signals: formatAISignals(parsed.aiSignals, latestCandleTime),
        provider: "Groq"
      };
    } catch (error: any) {
      const status = error?.status;
      providerErrors.push(`Groq: ${status === 429 ? 'Rate Limit' : 'Error ' + (status || 'Unknown')}`);
      console.warn("Groq Analysis failed, trying Gemini:", error);
    }
  } else {
    providerErrors.push("Groq: No valid API key.");
  }

  // --- 3. Try Gemini (Final Fallback) ---
  if (isValidKey(geminiKey)) {
    try {
      const genAI = new (GoogleGenAI as any)(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(responseText);

      return {
        analysis: parsed.analysis || "Analysis completed.",
        signals: formatAISignals(parsed.aiSignals, latestCandleTime),
        provider: "Google Gemini"
      };
    } catch (error: any) {
      providerErrors.push(`Gemini: ${error?.message || 'Unknown Error'}`);
      console.error("Gemini failed:", error);
    }
  } else {
    providerErrors.push("Gemini: No valid API key.");
  }

  // If we get here, everything failed
  const errorReason = providerErrors.join(" | ");
  return {
    analysis: `### ⚠️ ANALYSIS FAILED\n\nAll AI providers in the chain failed to generate a response:\n\n**Diagnostic Log:**\n\`${errorReason}\`\n\n**Common Fixes:**\n1. Ensure you have at least one valid key in \`.env.local\`.\n2. If using the **1s timeframe**, wait 30s between scans to avoid Rate Limits (429).\n3. Check your internet connection.`,
    signals: [],
    provider: "None"
  };
};

const formatAISignals = (aiSignals: any[], latestCandleTime: number): Signal[] => {
  return (aiSignals || []).map((s: any) => {
    let { type, entryPrice, stopLoss, takeProfit } = s;

    // --- SANITIZATION & SAFETY CHECKS ---
    // Ensure numbers are valid
    entryPrice = Number(entryPrice);
    stopLoss = Number(stopLoss);
    takeProfit = Number(takeProfit);

    // 1. Validate Directions
    if (type === 'LONG') {
      // For BUY: TP must be > Entry, SL must be < Entry
      if (takeProfit <= entryPrice) {
        // AI Hallucination Fix: Recalculate TP based on Risk 1:2
        const risk = Math.abs(entryPrice - stopLoss);
        takeProfit = entryPrice + (risk * 2);
      }
      if (stopLoss >= entryPrice) {
        // AI Hallucination Fix: Set default tight SL
        stopLoss = entryPrice * 0.995;
        // Re-adjust TP if needed
        takeProfit = entryPrice + ((entryPrice - stopLoss) * 2);
      }
    } else if (type === 'SHORT') {
      // For SELL: TP must be < Entry, SL must be > Entry
      if (takeProfit >= entryPrice) {
        // AI Hallucination Fix: Recalculate TP based on Risk 1:2
        const risk = Math.abs(stopLoss - entryPrice);
        takeProfit = entryPrice - (risk * 2);
      }
      if (stopLoss <= entryPrice) {
        // AI Hallucination Fix: Set default tight SL
        stopLoss = entryPrice * 1.005;
        // Re-adjust TP
        takeProfit = entryPrice - ((stopLoss - entryPrice) * 2);
      }
    }

    return {
      id: `ai-sig-${latestCandleTime}-${Math.random().toString(36).substr(2, 5)}`,
      candleTime: latestCandleTime,
      type: type,
      entryPrice: entryPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      status: 'ACTIVE',
      reason: `[AI] ${s.reason}`,
      confidence: s.confidence,
      isAI: true
    };
  });
};
