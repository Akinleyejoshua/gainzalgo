import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Candle, Signal, SymbolDef } from '../types';

export interface AIAnalysisResponse {
  analysis: string;
  signals: Signal[];
}

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
    1. Provide a professional market analysis in Markdown focusing on current structure and immediate bias.
    2. Identify the SINGLE most probable, high-conviction trade setup (Buy or Sell) based specifically on the price action of the LATEST candle (the last one in the dataset).
    3. Do NOT provide a setup if no high-probability opportunity exists (Confidence must be > 75%).
    4. Ensure the 'candleTime' in your response matches the timestamp of the VERY LAST candle in the provided Market Data.
    
    FORMAT YOUR ENTIRE RESPONSE AS A JSON OBJECT:
    {
      "analysis": "Your markdown analysis here...",
      "aiSignals": [
        {
          "type": "LONG" | "SHORT",
          "entryPrice": number,
          "stopLoss": number,
          "takeProfit": number,
          "reason": "Clear explanation of why this is relevant to the LATEST candle (max 15 words)",
          "confidence": number (75-100),
          "candleTime": number (The timestamp of the VERY LAST candle in the market data array.)
        }
      ]
    }

    CRITICAL: Only 1 setup allowed. ONLY provide a signal if it is valid for the LATEST candle. If no setup exists for the current moment, return an empty 'aiSignals' array. ONLY respond with the JSON object. Do not include markdown code blocks.
  `;

  // --- Try Groq First ---
  if (groqKey) {
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
        signals: formatAISignals(parsed.aiSignals)
      };
    } catch (error) {
      console.error("Groq Analysis failed, falling back to Gemini:", error);
    }
  }

  // --- Fallback to Gemini ---
  try {
    if (!geminiKey) throw new Error("No API keys available.");

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
      signals: formatAISignals(parsed.aiSignals)
    };
  } catch (error) {
    console.error("All AI providers failed:", error);
    return {
      analysis: "Error: AI analysis quota exceeded or service unavailable. Please check API keys.",
      signals: []
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
