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

  // --- Data Preparation (Common) ---
  const dataWindow = 30;
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

  // --- 1. Try Meta AI (Llama 3) First (Fallback to Groq) ---
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
        signals: formatAISignals(parsed.aiSignals),
        provider: "Meta AI (Llama 3)"
      };
    } catch (error: any) {
      if (error?.status === 429) {
        console.warn("Meta AI Rate Limit (429), falling back...");
      } else {
        console.warn("Meta AI Analysis failed, falling back to Groq:", error);
      }
    }
  }

  // --- 2. Try Groq (Second in Chain) ---
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
        signals: formatAISignals(parsed.aiSignals),
        provider: "Groq"
      };
    } catch (error: any) {
      if (error?.status === 429) {
        console.warn("Groq Rate Limit (429), falling back to Gemini...");
      } else {
        console.warn("Groq Analysis failed, falling back to Gemini:", error);
      }
    }
  }

  // --- 3. Try Gemini (Final Fallback) ---
  try {
    if (!isValidKey(geminiKey)) throw new Error("No API keys available.");

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const responseText = (result.text || "{}").replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(responseText);

    return {
      analysis: parsed.analysis || "Analysis completed.",
      signals: formatAISignals(parsed.aiSignals),
      provider: "Google Gemini"
    };
  } catch (error) {
    console.error("All AI providers failed:", error);
    return {
      analysis: "Error: All AI providers (Meta, Groq, Gemini) failed or have no API keys configured.",
      signals: [],
      provider: "None"
    };
  }
};

const formatAISignals = (aiSignals: any[]): Signal[] => {
  return (aiSignals || []).map((s: any) => ({
    id: `ai-sig-${s.candleTime}-${Math.random().toString(36).substr(2, 5)}`,
    candleTime: s.candleTime,
    type: s.type,
    entryPrice: s.entryPrice,
    stopLoss: s.stopLoss,
    takeProfit: s.takeProfit,
    status: 'ACTIVE',
    reason: `[AI] ${s.reason}`,
    confidence: s.confidence,
    isAI: true
  }));
};
