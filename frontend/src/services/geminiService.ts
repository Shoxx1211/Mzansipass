// src/services/geminiService.ts
// Pulse Transit - Premium Gemini AI Service
// Features: Caching, batch processing, fallback chains, cost optimization

import { GoogleGenAI } from "@google/genai";
import type { TripData, TransitNetwork, IssueReport, Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface TripRecommendation {
  mode: TransitNetwork | "Walking" | "Taxi" | "Gautrain" | "Metrorail" | "Rea Vaya";
  estimatedFare: number;
  reason: string;
  confidence: number;
  alternativeModes?: string[];
}

export interface TripAnalysis {
  feedback: string;
  isBest: boolean;
  isFastest: boolean;
  isCheapest: boolean;
  isSafest?: boolean;
  carbonFootprint?: number;
  recommendations?: string[];
}

export interface RouteExplanation {
  steps: string[];
  duration: string;
  fare: number;
  tips: string[];
}

export interface GeminiCacheEntry {
  prompt: string;
  response: any;
  timestamp: number;
  expiresAt: number;
}

// ======================================================
// INITIALIZE GEMINI AI
// ======================================================

const API_KEY = import.meta.env["VITE_GEMINI_API_KEY"];
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

if (!API_KEY && import.meta.env.DEV) {
  console.warn('⚠️ VITE_GEMINI_API_KEY is not set. AI features will be disabled.');
}

// ======================================================
// CONSTANTS
// ======================================================

const CONFIG = {
  TIMEOUT_MS: 5000,
  RETRIES: 2,
  ENABLE_AI: !!API_KEY,
  CACHE_DURATION: 5 * 60 * 1000,
  MAX_CACHE_SIZE: 100,
  BATCH_SIZE: 5,
  COST_PER_REQUEST: 0.0001
};

const CACHE_KEY = "pulse_gemini_cache";

// Use string literals as keys (with spaces) for the network prompts
const NETWORK_PROMPTS: Record<string, string> = {
  Taxi: "Minibus taxi - flexible, cash-based, negotiable fares",
  Gautrain: "Premium express rail - fastest, most reliable, higher cost",
  Metrorail: "PRASA commuter rail service",
  Putco: "Regional commuter bus operator serving selected Gauteng, Mpumalanga and Limpopo corridors",
  "Rea Vaya": "Johannesburg BRT - structured, card-based payment",
  "A Re Yeng": "Pretoria BRT - modern, reliable",
  "Tshwane Bus Service": "Municipal bus - affordable, limited routes"
};

// ======================================================
// CACHE MANAGEMENT
// ======================================================

class GeminiCache {
  private cache: Map<string, GeminiCacheEntry> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.cache = new Map(parsed);
        this.cleanExpired();
      }
    } catch (error) {
      console.error("Failed to load Gemini cache:", error);
    }
  }

  private save() {
    try {
      const toStore = Array.from(this.cache.entries());
      localStorage.setItem(CACHE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error("Failed to save Gemini cache:", error);
    }
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  set(key: string, response: any, duration: number = CONFIG.CACHE_DURATION) {
    if (this.cache.size >= CONFIG.MAX_CACHE_SIZE) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    
    this.cache.set(key, {
      prompt: key,
      response,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration
    });
    this.save();
  }

  clear() {
    this.cache.clear();
    this.save();
  }
}

const geminiCache = new GeminiCache();

// ======================================================
// UTILITIES
// ======================================================

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
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
};

const safeParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const generateCacheKey = (...args: any[]): string => {
  return JSON.stringify(args);
};

// ======================================================
// SMART FALLBACKS
// ======================================================

const getSmartFallback = (
  estimatedDistance: number
): TripRecommendation => {
  const farePerKm = estimatedDistance > 20 ? 2.5 : 3.5;
  const estimatedFare = Math.round(estimatedDistance * farePerKm);
  
  let mode: TripRecommendation['mode'] = "Taxi";
  let reason = "";
  
  if (estimatedDistance > 30) {
    mode = "Gautrain";
    reason = "Long distance - Gautrain is fastest";
  } else if (estimatedDistance < 5) {
    mode = "Walking";
    reason = "Short distance - walking is free and healthy";
  } else if (estimatedDistance > 15 && estimatedDistance <= 30) {
    mode = "Taxi";
    reason = "Balanced option for medium distance";
  } else {
    mode = "Rea Vaya";
    reason = "Affordable option for this route";
  }
  
  return {
    mode,
    estimatedFare,
    reason,
    confidence: 0.6,
    alternativeModes: ["Taxi", "Gautrain"].filter(m => m !== mode)
  };
};

// ======================================================
// MAIN AI FUNCTIONS
// ======================================================

/**
 * Get trip recommendation with caching and fallback
 */
export const getTripRecommendation = async (
  start: Location,
  end: Location,
  estimatedDistance: number
): Promise<TripRecommendation | null> => {
  if (!CONFIG.ENABLE_AI || !ai) {
    return getSmartFallback(estimatedDistance);
  }

  const cacheKey = generateCacheKey("recommendation", start.lat, start.lng, end.lat, end.lng, estimatedDistance);
  const cached = geminiCache.get(cacheKey);
  if (cached) {
    console.log("📦 Using cached recommendation");
    return cached;
  }

  const prompt = `
You are Pulse Transit AI — a South African commuter assistant.

User trip:
Start: (${start.lat}, ${start.lng})
End: (${end.lat}, ${end.lng})
Distance: ${estimatedDistance.toFixed(2)} km

Network information:
${Object.entries(NETWORK_PROMPTS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Decide:
- Best transport mode
- Estimated fare (ZAR)
- Short reasoning (max 8 words)
- Confidence score (0-1)

Return STRICT JSON:
{
  "mode": "Taxi" | "Gautrain" | "Metrorail" | "Putco" | "Rea Vaya" | "Walking",
  "estimatedFare": number,
  "reason": "string",
  "confidence": number,
  "alternativeModes": ["mode1", "mode2"]
}
`;

  try {
    const result = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        })
      )
    );

    const text = result.text;
    const parsed = safeParse(text || "");
    if (!parsed) throw new Error("Invalid JSON");

    const recommendation: TripRecommendation = {
      mode: parsed.mode,
      estimatedFare: parsed.estimatedFare,
      reason: parsed.reason,
      confidence: parsed.confidence || 0.7,
      alternativeModes: parsed.alternativeModes
    };

    geminiCache.set(cacheKey, recommendation);
    return recommendation;

  } catch (error) {
    console.error("Gemini recommendation failed, using fallback:", error);
    return getSmartFallback(estimatedDistance);
  }
};

/**
 * Get detailed trip analysis with insights
 */
export const getDetailedTripAnalysis = async (
  trip: TripData
): Promise<TripAnalysis> => {
  const duration = ((trip.endTime || Date.now()) - trip.startTime) / 60000;

  if (trip.distance < 1) {
    return {
      feedback: "Short trip. Walk if possible to save money!",
      isBest: true,
      isFastest: true,
      isCheapest: true,
      isSafest: true,
      carbonFootprint: trip.distance * 0.12,
      recommendations: ["Consider walking for short distances"]
    };
  }

  const cacheKey = generateCacheKey("analysis", trip.id, trip.network, trip.distance);
  const cached = geminiCache.get(cacheKey);
  if (cached) return cached;

  const prompt = `
Analyze this South African commute:

Network: ${trip.network}
Cost: R${trip.fare}
Distance: ${trip.distance} km
Duration: ${duration} min

Return STRICT JSON:
{
  "feedback": "string",
  "isBest": boolean,
  "isFastest": boolean,
  "isCheapest": boolean,
  "isSafest": boolean,
  "carbonFootprint": number,
  "recommendations": ["string"]
}
`;

  try {
    if (!ai) throw new Error("AI not initialized");
    
    const result = await withRetry(() =>
      withTimeout(
        ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        })
      )
    );

    const text = result.text;
    const parsed = safeParse(text || "");
    if (!parsed) throw new Error();

    const analysis: TripAnalysis = {
      feedback: parsed.feedback || "Trip completed successfully",
      isBest: parsed.isBest ?? true,
      isFastest: parsed.isFastest ?? false,
      isCheapest: parsed.isCheapest ?? false,
      isSafest: parsed.isSafest ?? true,
      carbonFootprint: parsed.carbonFootprint || trip.distance * 0.15,
      recommendations: parsed.recommendations || ["Continue tracking your trips for better insights"]
    };

    geminiCache.set(cacheKey, analysis);
    return analysis;

  } catch (error) {
    console.error("Trip analysis failed:", error);
    return {
      feedback: "Journey recorded successfully",
      isBest: true,
      isFastest: false,
      isCheapest: false,
      isSafest: true,
      carbonFootprint: trip.distance * 0.15,
      recommendations: ["Track more trips for personalized insights"]
    };
  }
};

/**
 * Get natural language route explanation
 */
export const getRouteExplanation = async (
  start: Location,
  end: Location,
  mode: string,
  fare: number,
  duration: number
): Promise<RouteExplanation | null> => {
  const cacheKey = generateCacheKey("explain", start.lat, start.lng, end.lat, end.lng, mode);
  const cached = geminiCache.get(cacheKey);
  if (cached) return cached;

  const prompt = `
Explain this route in a friendly, helpful way:

From: (${start.lat}, ${start.lng})
To: (${end.lat}, ${end.lng})
Mode: ${mode}
Fare: R${fare}
Duration: ${duration} min

Return JSON:
{
  "steps": ["step1", "step2", "step3"],
  "duration": "X min",
  "fare": number,
  "tips": ["tip1", "tip2"]
}
`;

  try {
    if (!ai) throw new Error("AI not initialized");
    
    const result = await withTimeout(
      ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      }),
      8000
    );

    const text = result.text;
    const parsed = safeParse(text || "");
    if (!parsed) return null;

    geminiCache.set(cacheKey, parsed);
    return parsed;

  } catch (error) {
    console.error("Route explanation failed:", error);
    return {
      steps: [`Take ${mode} from your location`],
      duration: `${duration} min`,
      fare,
      tips: ["Check real-time updates before departing"]
    };
  }
};

/**
 * Batch process multiple trip recommendations
 */
export const batchGetRecommendations = async (
  requests: Array<{ start: Location; end: Location; estimatedDistance: number }>
): Promise<(TripRecommendation | null)[]> => {
  const results: (TripRecommendation | null)[] = [];
  
  for (let i = 0; i < requests.length; i += CONFIG.BATCH_SIZE) {
    const batch = requests.slice(i, i + CONFIG.BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(req => getTripRecommendation(req.start, req.end, req.estimatedDistance))
    );
    results.push(...batchResults);
  }
  
  return results;
};

/**
 * Network pulse summary (simplified, no AI for cost saving)
 */
export const getNetworkPulseSummary = async (
  network: string,
  reports: IssueReport[]
): Promise<string> => {
  if (!reports.length) return `✅ ${network} operating normally`;
  
  const recent = reports.filter(r => Date.now() - r.timestamp < 3600000);
  if (!recent.length) return `✅ ${network} - No recent issues`;
  
  const issues = recent.slice(0, 3).map(r => r.type).join(", ");
  return `⚠️ ${network}: ${issues} reported in last hour`;
};

/**
 * Refine transport detection (local logic preferred)
 */
export const refineTransportDetection = async (
  speed: number
): Promise<string | null> => {
  if (speed < 5) return "Walking";
  if (speed < 6) return "Walking";
  if (speed > 70) return "Train";
  if (speed > 60) return "Gautrain";
  if (speed > 30) return "Taxi";
  if (speed > 20) return "Bus";
  if (speed > 10) return "Minibus Taxi";
  return "Unknown";
};

/**
 * Get AI usage statistics
 */
export const getAIStats = () => {
  return {
    enabled: CONFIG.ENABLE_AI,
    cacheSize: CONFIG.MAX_CACHE_SIZE,
    costPerRequest: CONFIG.COST_PER_REQUEST,
    timeoutMs: CONFIG.TIMEOUT_MS
  };
};

/**
 * Clear Gemini cache
 */
export const clearGeminiCache = () => {
  geminiCache.clear();
  console.log("🗑️ Gemini cache cleared");
};