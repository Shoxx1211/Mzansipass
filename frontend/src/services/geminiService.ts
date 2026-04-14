import { GoogleGenAI, Type } from "@google/genai";
import type { TripData, TransitNetwork, IssueReport } from "../types";

// ---------------- INIT ----------------
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY
});

// ---------------- TIMEOUT WRAPPER ----------------
const withTimeout = async <T>(promise: Promise<T>, ms = 5000): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI Timeout")), ms)
  );

  return Promise.race([promise, timeout]);
};

// ---------------- SAFE PARSER ----------------
const safeParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

// ---------------- TRIP ANALYSIS ----------------
export const getDetailedTripAnalysis = async (
  trip: TripData
): Promise<{
  feedback: string;
  isCheapest: boolean;
  isFastest: boolean;
  isBest: boolean;
  isIntegrated: boolean;
  integratedNetworks: TransitNetwork[];
  gautrainSubMode?: "Train" | "Bus" | "Train + Feeder Bus";
  alternatives?: {
    faster?: { network: string; diffMinutes: number } | null;
    cheaper?: { network: string; diffFare: number } | null;
  };
}> => {
  try {
    const duration = Math.floor(
      ((trip.endTime || Date.now()) - trip.startTime) / 60000
    );

    const prompt = `
You are MzansiPass AI — a real-world South African transport intelligence engine.

Analyze this trip realistically using SA conditions (traffic, taxis, delays, transfers):

Trip:
- Network: ${trip.network}
- Cost: R${trip.fare.toFixed(2)}
- Distance: ${trip.distance.toFixed(2)} km
- Duration: ${duration} minutes

Compare against:
Gautrain, Rea Vaya, A Re Yeng, Tshwane Bus Service, Metrorail, Taxi

Rules:
- Taxi often fastest in peak traffic
- Gautrain = fastest long distance, premium cost
- Metrorail = cheapest but unreliable
- BRT (Rea Vaya / A Re Yeng) = structured but slower
- Integrated = multi-mode journeys

Be realistic. No generic answers.

Return STRICT JSON ONLY:

{
  "feedback": "short insight (max 12 words)",
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

    const response = await withTimeout(
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
    );

    const result = safeParse(response.text || "{}");

    return {
      feedback:
        result.feedback ||
        "Smart commute. AI refining your travel efficiency.",
      isCheapest: !!result.isCheapest,
      isFastest: !!result.isFastest,
      isBest: !!result.isBest,
      isIntegrated: !!result.isIntegrated,
      integratedNetworks:
        (result.integratedNetworks as TransitNetwork[]) || [
          trip.network as TransitNetwork
        ],
      gautrainSubMode: result.gautrainSubMode || undefined,
      alternatives: result.alternatives || {}
    };
  } catch (error) {
    console.warn("⚠️ AI Trip Analysis Failed:", error);

    return {
      feedback: "Trip recorded. AI insights temporarily unavailable.",
      isCheapest: false,
      isFastest: false,
      isBest: true,
      isIntegrated: false,
      integratedNetworks: [trip.network as TransitNetwork]
    };
  }
};

// ---------------- PULSE SUMMARY ----------------
export const getNetworkPulseSummary = async (
  network: string,
  reports: IssueReport[]
): Promise<string> => {
  try {
    if (!reports.length) return "No recent commuter reports.";

    const recentReports = reports.filter(
      r => Date.now() - r.timestamp < 60 * 60 * 1000
    );

    if (!recentReports.length)
      return "Operating normally according to commuters.";

    const prompt = `
You are MzansiPass Pulse AI.

Summarize commuter reports for ${network} in South Africa.

Data:
${JSON.stringify(recentReports)}

Rules:
- Max 10 words
- Clear, human-friendly
- Reflect real commuter experience

Return only text.
`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      })
    );

    return response.text?.trim() || "Live commuter data updated.";
  } catch (error) {
    console.warn("⚠️ Pulse AI Failed:", error);
    return "Live commuter data updated.";
  }
};

// ---------------- FUTURE: TRANSPORT AI (HOOK READY) ----------------
export const refineTransportDetection = async (
  speed: number,
  distance: number
): Promise<string | null> => {
  try {
    const prompt = `
Classify transport mode in South Africa.

Speed: ${speed} km/h
Distance: ${distance} km

Options:
Taxi, Bus, Train, Walking

Return ONLY one word.
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