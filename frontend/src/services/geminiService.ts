// services/geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import type { TripData, TransitNetwork, IssueReport, Location } from "../types";

// ===============================
// INIT
// ===============================
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY
});

// ===============================
// CONFIG
// ===============================
const CONFIG = {
  TIMEOUT_MS: 5000,
  RETRIES: 2,
  ENABLE_AI: true // 🔥 kill switch for production safety
};

// ===============================
// UTILS
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

const safeParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// ===============================
// 🔥 PRE-TRIP ASSISTANT (NEW CORE)
// ===============================
export const getTripRecommendation = async (
  start: Location,
  end: Location,
  estimatedDistance: number
) => {
  if (!CONFIG.ENABLE_AI) return null;

  const prompt = `
You are MzansiPass AI — a South African commuter assistant.

User trip:
Start: (${start.lat}, ${start.lng})
End: (${end.lat}, ${end.lng})
Distance: ${estimatedDistance.toFixed(2)} km

Decide:
- Best transport mode
- Estimated fare range (ZAR)
- Short reasoning

Rules:
- Taxi: flexible, common
- Gautrain: fastest but expensive
- Metrorail: cheapest, unreliable
- BRT: structured

Return STRICT JSON:
{
  "mode": "Taxi" | "Gautrain" | "Metrorail" | "Rea Vaya",
  "estimatedFare": number,
  "reason": "max 10 words"
}
`;

  try {
    const res = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        })
      )
    );

    const parsed = safeParse(res.text || "");

    if (!parsed) throw new Error("Invalid JSON");

    return parsed;
  } catch {
    // 🔥 fallback logic (VERY IMPORTANT)
    return {
      mode: estimatedDistance > 20 ? "Gautrain" : "Taxi",
      estimatedFare: estimatedDistance * 1.5,
      reason: "Fallback estimate"
    };
  }
};

// ===============================
// TRIP ANALYSIS (UPGRADED)
// ===============================
export const getDetailedTripAnalysis = async (
  trip: TripData
) => {
  const duration =
    ((trip.endTime || Date.now()) - trip.startTime) / 60000;

  // 🔥 Skip AI if trip too small (cost control)
  if (trip.distance < 1) {
    return {
      feedback: "Short trip. Minimal optimisation needed.",
      isBest: true,
      isFastest: true,
      isCheapest: true,
      isIntegrated: false,
      integratedNetworks: [trip.network]
    };
  }

  const prompt = `
Analyze this South African commute:

Network: ${trip.network}
Cost: R${trip.fare}
Distance: ${trip.distance} km
Duration: ${duration} min

Return STRICT JSON:
{
  "feedback": "max 12 words",
  "isBest": boolean,
  "isFastest": boolean,
  "isCheapest": boolean
}
`;

  try {
    const res = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        })
      )
    );

    const parsed = safeParse(res.text || "");

    if (!parsed) throw new Error();

    return parsed;
  } catch {
    return {
      feedback: "Smart fallback analysis applied.",
      isBest: true,
      isFastest: false,
      isCheapest: false
    };
  }
};

// ===============================
// NETWORK PULSE
// ===============================
export const getNetworkPulseSummary = async (
  network: string,
  reports: IssueReport[]
): Promise<string> => {
  if (!reports.length) return "No recent commuter reports.";

  const recent = reports.filter(
    r => Date.now() - r.timestamp < 3600000
  );

  if (!recent.length) return "Operating normally.";

  try {
    const res = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarise issues for ${network} in 10 words max`
      })
    );

    return res.text?.trim() || "Live updates available.";
  } catch {
    return "Live commuter updates available.";
  }
};

// ===============================
// MODE REFINEMENT (SMART GATING)
// ===============================
export const refineTransportDetection = async (
  speed: number,
  distance: number
): Promise<string | null> => {

  // 🔥 Strong local logic first
  if (speed < 6) return "Walking";
  if (speed > 70) return "Train";
  if (speed > 20) return "Taxi";

  // 🚫 Avoid AI spam
  if (distance < 1) return null;

  try {
    const res = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Classify transport for speed ${speed}`
      }),
      3000
    );

    return res.text?.trim() || null;
  } catch {
    return null;
  }
};