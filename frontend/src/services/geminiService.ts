import { GoogleGenAI, Type } from "@google/genai";

import type { TripData, TransitNetwork, IssueReport, ReportType } from "../types";


const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_API_KEY
});

/**
 * Performs deep analysis of a completed trip against SA transport data.
 */
export const getDetailedTripAnalysis = async (trip: TripData): Promise<{
  feedback: string;
  isCheapest: boolean;
  isFastest: boolean;
  isBest: boolean;
  alternatives?: {
    faster?: any;
    cheaper?: any;
  };
  isIntegrated: boolean;
  integratedNetworks: TransitNetwork[];
  gautrainSubMode?: 'Train' | 'Bus' | 'Train + Feeder Bus';
}> => {
  try {
    const prompt = `
      As a South African Transit Advisor, analyze this journey:
      - Primary Network: ${trip.network}
      - Actual Cost: R${trip.fare.toFixed(2)}
      - Distance: ${trip.distance.toFixed(2)} km
      - Actual Duration: ${Math.floor(((trip.endTime || Date.now()) - trip.startTime) / 60000)} mins
      
      Compare this against all other networks (Gautrain, Rea Vaya, A Re Yeng, TBS, Metrorail) for the same route.
      
      Intelligence Requirements:
      1. Determine if a Faster or Cheaper alternative existed.
      2. If an alternative is cheaper, provide the savings amount in "diffFare" (e.g., if user spent R28 and alt is R23, diffFare is 5).
      3. If an alternative is faster, provide the minutes saved in "diffMinutes" (e.g., if user took 45 mins and alt is 33, diffMinutes is 12).
      4. For the 'cheaper' suggestion, if it was simpler (e.g., staying on one bus instead of switching), use "Stay on [Network]" as the suggestion.
      
      Tone: Helpful, non-judgmental insight.
      
      Return JSON:
      {
        "feedback": "string (max 12 words)",
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
            integratedNetworks: { type: Type.ARRAY, items: { type: Type.STRING } },
            gautrainSubMode: { type: Type.STRING, nullable: true },
            alternatives: {
              type: Type.OBJECT,
              properties: {
                faster: { 
                  type: Type.OBJECT,
                  nullable: true,
                  properties: { network: { type: Type.STRING }, diffMinutes: { type: Type.NUMBER } }
                },
                cheaper: { 
                  type: Type.OBJECT,
                  nullable: true,
                  properties: { network: { type: Type.STRING }, diffFare: { type: Type.NUMBER } }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      feedback: result.feedback || "Trip complete. Analysis suggests this was a solid choice.",
      isCheapest: !!result.isCheapest,
      isFastest: !!result.isFastest,
      isBest: !!result.isBest,
      isIntegrated: !!result.isIntegrated,
      integratedNetworks: (result.integratedNetworks as TransitNetwork[] || [trip.network as TransitNetwork]) as TransitNetwork[],
      gautrainSubMode: result.gautrainSubMode || undefined,
      alternatives: result.alternatives
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      feedback: "Trip recorded successfully.",
      isCheapest: false,
      isFastest: true,
      isBest: true,
      isIntegrated: false,
      integratedNetworks: [trip.network as TransitNetwork],
    };
  }
};

export const getNetworkPulseSummary = async (network: string, reports: IssueReport[]): Promise<string> => {
  if (reports.length === 0) return "No recent community reports for this network.";
  try {
    const recentReports = reports.filter(r => (Date.now() - r.timestamp) < 3600000);
    if (recentReports.length === 0) return "Operating normally according to community reports.";
    const prompt = `Summarize these reports for ${network}: ${JSON.stringify(recentReports)}. Max 12 words.`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text?.trim() || "Local status updated.";
  } catch (error) {
    return "Status updated.";
  }
};
