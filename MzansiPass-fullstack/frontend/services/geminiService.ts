import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { RouteOption, ReportCategory, Trip, TransitAlert } from '../types';
import { MOCK_TRIP_PLAN } from '../constants';

export interface LiveJourneyUpdate {
  userMessage: string;
  alternativeRoute?: RouteOption;
  notificationMessage?: string;
}

export const planTripWithAI = async (query: string): Promise<RouteOption[]> => {
  // In a real app, you would have error handling and might not want to default to mock data this way.
  // For this demo, if the API key is not set or the call fails, we return mock data.
  if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Returning mock data.");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_TRIP_PLAN), 1500));
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `You are a trip planner for major South African cities. You have access to the full, up-to-the-minute schedules for all listed services. Your ONLY available transport options are Rea Vaya, Metrobus, Gautrain, MyCiTi, Areyeng, Tshwane Bus Service, and PRASA. Do NOT include any minibus taxis, e-hailing services (like Uber or Bolt), or private vehicles in your suggestions. Based on the user's request, provide 1 to 3 route options using ONLY the allowed public transport. For each route, provide a title, a tag ('Recommended', 'Cheapest', or 'Fastest'), an estimated total fare in ZAR, an estimated travel time, and a list of steps. User request: "${query}"`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tag: { type: Type.STRING },
              totalFare: { type: Type.NUMBER },
              travelTime: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    provider: { type: Type.STRING },
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                  },
                  required: ["provider", "from", "to", "instruction"]
                },
              },
            },
            required: ["title", "tag", "totalFare", "travelTime", "steps"]
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result as RouteOption[];

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Fallback to mock data on API error
    return MOCK_TRIP_PLAN;
  }
};

export const categorizeReportWithAI = async (description: string): Promise<ReportCategory> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not set. Falling back to default category.");
    // Fallback logic if API key is missing
    if (description.toLowerCase().includes('late') || description.toLowerCase().includes('delay')) return 'delay';
    if (description.toLowerCase().includes('crowd') || description.toLowerCase().includes('full')) return 'crowded';
    return 'other';
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Classify the following user report into one of these categories: "crowded", "delay", "hazard", "info", or "other". Respond with only the category name in lowercase. Report: "${description}"`;

  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });
    
    const category = response.text.trim().toLowerCase();
    
    // Validate the response from the model
    const validCategories: ReportCategory[] = ['crowded', 'delay', 'hazard', 'info', 'other'];
    if (validCategories.includes(category as ReportCategory)) {
        return category as ReportCategory;
    } else {
        console.warn(`AI returned an invalid category: "${category}". Defaulting to 'other'.`);
        return 'other'; // Fallback if the model returns something unexpected
    }
  } catch (error) {
    console.error("Error calling Gemini for categorization:", error);
    // Fallback on API error
    return 'other';
  }
};

export const identifyLandmark = async (base64Image: string): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Returning mock data.");
    return new Promise(resolve => setTimeout(() => resolve("This is a famous landmark in South Africa, known for its beautiful architecture and historical significance."), 1500));
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Image,
    },
  };

  const textPart = {
    text: "You are a tour guide. Identify the landmark in this image. Provide a short, interesting paragraph about its significance and location in South Africa. If it is not a recognizable landmark, respond with 'I'm sorry, I don't recognize this landmark.'",
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini for landmark identification:", error);
    return "There was an issue identifying this landmark. Please try again.";
  }
};

export const getLiveJourneyUpdate = async (trip: Trip, alert: TransitAlert): Promise<LiveJourneyUpdate> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const findAlternativeRoute: FunctionDeclaration = {
        name: 'findAlternativeRoute',
        parameters: {
            type: Type.OBJECT,
            description: "Finds an alternative transit route when the user's current trip is disrupted.",
            properties: {
                currentLocation: { type: Type.STRING, description: "The user's current location, e.g., 'Sandton'." },
                destination: { type: Type.STRING, description: "The user's final destination, e.g., 'Soweto Theatre'." },
            },
            required: ['currentLocation', 'destination'],
        }
    };

    const notifyContact: FunctionDeclaration = {
        name: 'notifyContact',
        parameters: {
            type: Type.OBJECT,
            description: "Sends a notification to a contact about a travel delay.",
            properties: {
                contactName: { type: Type.STRING, description: "The name of the contact to notify, e.g., 'Mom'." },
                message: { type: Type.STRING, description: "The message to send, e.g., 'Running about 15 minutes late due to a bus delay.'" },
            },
            required: ['contactName', 'message'],
        }
    };
    
    const prompt = `You are a proactive travel assistant. The user is currently on a trip from ${trip.from} to ${trip.to} using ${trip.provider}. An alert has just been issued: "${alert.title}: ${alert.description}".
    Analyze the situation. If it's a significant disruption (like a major delay), find an alternative route. Also, offer to notify a contact about the delay. Formulate a friendly, concise message for the user explaining the situation and the proposed solution.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ functionDeclarations: [findAlternativeRoute, notifyContact] }],
            },
        });
        
        const userMessage = response.text;
        let journeyUpdate: LiveJourneyUpdate = { userMessage };

        if (response.functionCalls && response.functionCalls.length > 0) {
            for (const funcCall of response.functionCalls) {
                if (funcCall.name === 'findAlternativeRoute') {
                    const { currentLocation, destination } = funcCall.args;
                    console.log(`AI wants to find a route from ${currentLocation} to ${destination}`);
                    const newRoutes = await planTripWithAI(`From ${currentLocation} to ${destination}`);
                    if (newRoutes.length > 0) {
                        journeyUpdate.alternativeRoute = newRoutes[0]; // Take the first recommendation
                    }
                } else if (funcCall.name === 'notifyContact') {
                    const { message } = funcCall.args;
                    journeyUpdate.notificationMessage = message;
                }
            }
        }
        
        return journeyUpdate;

    } catch (error) {
        console.error("Error getting live journey update:", error);
        throw new Error("Could not get live journey update from AI.");
    }
};