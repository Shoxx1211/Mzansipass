// services/geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import type { TripData, TransitNetwork, IssueReport } from "../types";

// ===============================
// INIT (SAFE)
// ===============================
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY
});

// ===============================
// CONFIG
// ===============================
const CONFIG = {
  TIMEOUT_MS: 5000,
  RETRIES: 2
};

// ===============================
// GENERIC RETRY + TIMEOUT WRAPPER
// ===============================
const withTimeout = async <T>(
  promise: Promise<T>,
  ms = CONFIG.TIMEOUT_MS
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI Timeout")), ms)
  );

  return Promise.race([promise, timeout]);
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = CONFIG.RETRIES
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};

// ===============================
// SAFE JSON PARSER
// ===============================
const safeParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// ===============================
// FALLBACK LOGIC (VERY IMPORTANT)
// ===============================
const basicTripHeuristics = (trip: TripData) => {
  const duration =
    ((trip.endTime || Date.now()) - trip.startTime) / 60000;

  return {
    isFastest: duration < 30,
    isCheapest: trip.fare < 20,
    isBest: true,
    isIntegrated: false,
    integratedNetworks: [trip.network as TransitNetwork]
  };
};

// ===============================
// TRIP ANALYSIS (PRODUCTION)
// ===============================
export const getDetailedTripAnalysis = async (
  trip: TripData
) => {
  const duration = Math.floor(
    ((trip.endTime || Date.now()) - trip.startTime) / 60000
  );

  const prompt = `
You are MzansiPass AI — a South African transport intelligence system.

Analyze this trip realistically:

Trip:
- Network: ${trip.network}
- Cost: R${trip.fare.toFixed(2)}
- Distance: ${trip.distance.toFixed(2)} km
- Duration: ${duration} minutes

Context:
- Taxi = flexible, often fastest in traffic
- Gautrain = fastest long-distance, expensive
- Metrorail = cheapest, unreliable
- BRT = structured but slower

Return STRICT JSON ONLY:
{
  "feedback": "max 12 words",
  "isCheapest": boolean,
  "isFastest": boolean,
  "isBest": boolean,
  "isIntegrated": boolean,
  "integratedNetworks": string[],
  "gautrainSubMode": "Train" | "Bus" | "Train + Feeder Bus" | null,
  "alternatives": {
    "faster": { "network": "string", "diffMinutes": number } | null,
    "cheaper": { "network": "string", "diffFare": number } | null
  }
}
`;

  try {
    const response = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                feedback: { type: Type.STRING },
                isCheapest: { type: Type.BOOLEAN },
                isFastest: { type: Type.BOOLEAN },
                isBest: { type: Type.BOOLEAN },
                isIntegrated: { type: Type.BOOLEAN },
                integratedNetworks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                gautrainSubMode: {
                  type: Type.STRING,
                  nullable: true
                },
                alternatives: {
                  type: Type.OBJECT,
                  properties: {
                    faster: {
                      type: Type.OBJECT,
                      nullable: true,
                      properties: {
                        network: { type: Type.STRING },
                        diffMinutes: { type: Type.NUMBER }
                      }
                    },
                    cheaper: {
                      type: Type.OBJECT,
                      nullable: true,
                      properties: {
                        network: { type: Type.STRING },
                        diffFare: { type: Type.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      )
    );

    const result = safeParse(response.text || "");

    if (!result) throw new Error("Invalid AI JSON");

    return {
      feedback:
        result.feedback ||
        "Efficient commute. Minor optimizations possible.",
      isCheapest: !!result.isCheapest,
      isFastest: !!result.isFastest,
      isBest: !!result.isBest,
      isIntegrated: !!result.isIntegrated,
      integratedNetworks:
        result.integratedNetworks || [trip.network],
      gautrainSubMode: result.gautrainSubMode || undefined,
      alternatives: result.alternatives || {}
    };
  } catch (error) {
    console.warn("⚠️ AI Trip Analysis Failed:", error);

    const fallback = basicTripHeuristics(trip);

    return {
      feedback: "AI offline. Using smart fallback insights.",
      ...fallback
    };
  }
};

// ===============================
// NETWORK PULSE SUMMARY
// ===============================
export const getNetworkPulseSummary = async (
  network: string,
  reports: IssueReport[]
): Promise<string> => {
  if (!reports.length) return "No recent commuter reports.";

  const recentReports = reports.filter(
    r => Date.now() - r.timestamp < 60 * 60 * 1000
  );

  if (!recentReports.length)
    return "Operating normally according to commuters.";

  const prompt = `
Summarize commuter reports for ${network} in South Africa.

Data:
${JSON.stringify(recentReports)}

Rules:
- Max 10 words
- Human-friendly
- Realistic

Return ONLY text.
`;

  try {
    const response = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt
        })
      )
    );

    return response.text?.trim() || "Live data updated.";
  } catch {
    return "Live commuter data updated.";
  }
};

// ===============================
// LIGHTWEIGHT MODE CLASSIFIER
// ===============================
export const refineTransportDetection = async (
  speed: number,
  distance: number
): Promise<string | null> => {
  // 🚀 First use local logic (FASTER + FREE)
  if (speed < 6) return "Walking";
  if (speed > 70) return "Train";
  if (speed > 20 && speed <= 70) return "Taxi";

  // 🔥 Only fallback to AI if uncertain
  try {
    const prompt = `
Classify transport mode in South Africa.

Speed: ${speed} km/h
Distance: ${distance} km

Options:
Taxi, Bus, Train, Walking

Return ONE word only.
`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      }),
      3000
    );

    return response.text?.trim() || null;
  } catch {
    return null;
  }
};