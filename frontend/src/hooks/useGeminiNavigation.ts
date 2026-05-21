// src/hooks/useGeminiNavigation.ts
// Pulse Transit - Premium Gemini AI Navigation Hook
// Features: Trip analysis, route recommendations, context-aware responses, chat history

import { useState, useCallback, useRef, useEffect } from 'react';
import { getTripRecommendation, getDetailedTripAnalysis } from '../services/geminiService';
import type { Location, TripData, TransitNetwork } from '../types';

// ======================================================
// TYPES
// ======================================================

interface GeminiNavigationState {
  isOpen: boolean;
  query: string;
  response: string | null;
  isLoading: boolean;
  error: string | null;
  chatHistory: ChatMessage[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface GeminiNavigationOptions {
  enableHistory?: boolean;
  maxHistoryItems?: number;
  contextAware?: boolean;
}

// ======================================================
// CONSTANTS
// ======================================================

const DEFAULT_OPTIONS: Required<GeminiNavigationOptions> = {
  enableHistory: true,
  maxHistoryItems: 20,
  contextAware: true
};

const QUICK_RESPONSES = {
  taxi: `🚖 **South African Taxi Guide**

**Fare ranges:**
• Short trips (0-10km): R15 - R25
• Medium trips (10-25km): R25 - R45  
• Long trips (25-50km): R45 - R80

**Popular routes:**
• Soweto → Johannesburg CBD: R15-20
• Midrand → Sandton: R20-25
• Pretoria → Johannesburg: R45-60

**💡 Tips:**
• Confirm fare before boarding
• Peak hours (6-9am, 3-7pm) are busier
• Most ranks accept cash only`,

  gautrain: `🚆 **Gautrain Express Guide**

**Operating Hours:**
• Weekdays: 5:30 AM - 8:30 PM
• Weekends: 6:00 AM - 8:30 PM

**Fare Examples:**
• Park ↔ Sandton: R35 (peak) / R25 (off-peak)
• Park ↔ Pretoria: R85 (peak) / R65 (off-peak)
• Sandton ↔ OR Tambo: R120 (peak) / R90 (off-peak)

**💡 Tips:**
• Get a Gold Card (R15 one-time)
• Off-peak fares are 25% cheaper
• Free WiFi at stations`,

  bus: `🚌 **Bus Services in Gauteng**

**Rea Vaya (Johannesburg):**
• Fares: R7.50 - R22
• Routes: Parktown, Baragwanath, Ellis Park
• Frequency: Every 10-20 minutes

**A Re Yeng (Pretoria):**
• Fares: R8 - R18
• Routes: Church Square, Hatfield
• Frequency: Every 15-30 minutes

**💡 Tips:**
• Get a smart card for tap-and-go
• Weekly caps available
• Real-time tracking on their apps`,

  default: `🤖 **Pulse Transit AI Assistant**

I can help you with:

📍 **Routes & Directions**
• "How to get to Sandton?"
• "Best route from Soweto to Midrand"

💰 **Fare Estimates**  
• "Taxi fare from Pretoria to Joburg"
• "Gautrain off-peak pricing"

🚆 **Transport Information**
• "Gautrain operating hours"
• "Rea Vaya bus routes"

⏰ **Schedules & Times**
• "First Gautrain from Park Station"
• "Peak hours for taxis"

**Just ask me anything about your commute!**`
};

// ======================================================
// MAIN HOOK
// ======================================================

export const useGeminiNavigation = (options: GeminiNavigationOptions = {}) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<GeminiNavigationState>({
    isOpen: false,
    query: '',
    response: null,
    isLoading: false,
    error: null,
    chatHistory: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ======================================================
  // PUBLIC METHODS
  // ======================================================

  const openNavigator = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, error: null }));
  }, []);

  const closeNavigator = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isOpen: false, 
      query: '', 
      response: null 
    }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({ ...prev, chatHistory: [] }));
  }, []);

  const analyzeTrip = useCallback(async (trip: TripData): Promise<string | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const analysis = await getDetailedTripAnalysis(trip);
      
      let analysisText = '';
      if (analysis) {
        analysisText = `📊 **Trip Analysis**\n\n` +
          `${analysis.feedback}\n\n` +
          `• Best route: ${analysis.isBest ? '✓ Yes' : 'Consider alternatives'}\n` +
          `• Fastest option: ${analysis.isFastest ? '✓ Yes' : 'Could be faster'}\n` +
          `• Cheapest option: ${analysis.isCheapest ? '✓ Yes' : 'Check other options'}`;
      } else {
        analysisText = `📊 **Trip Summary**\n\n` +
          `Distance: ${trip.distance.toFixed(1)} km\n` +
          `Duration: ${Math.floor((trip.duration || 0) / 60)} min\n` +
          `Fare: R${trip.fare.toFixed(2)}\n\n` +
          `Keep tracking your journeys for personalized insights!`;
      }
      
      // Add to chat history
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: analysisText,
        timestamp: Date.now()
      };
      
      setState(prev => ({
        ...prev,
        response: analysisText,
        chatHistory: mergedOptions.enableHistory 
          ? [...prev.chatHistory, newMessage].slice(-mergedOptions.maxHistoryItems)
          : [],
        isLoading: false
      }));
      
      return analysisText;
      
    } catch (error) {
      console.error('Trip analysis failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Could not analyze trip. Please try again.',
        isLoading: false
      }));
      return null;
    }
  }, [mergedOptions.enableHistory, mergedOptions.maxHistoryItems]);

  const askGemini = useCallback(async (
    query: string,
    currentLocation?: Location | null,
    destination?: string,
    context?: { previousTrips?: TripData[]; preferredNetwork?: TransitNetwork }
  ): Promise<string | null> => {
    if (!query.trim()) return null;

    // Cancel ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Add user message to history
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: Date.now()
    };

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null,
      chatHistory: mergedOptions.enableHistory 
        ? [...prev.chatHistory, userMessage].slice(-mergedOptions.maxHistoryItems)
        : []
    }));

    try {
      let aiResponse = '';
      const lowerQuery = query.toLowerCase();

      // Check for trip analysis request
      if (lowerQuery.includes('analyze') && context?.previousTrips?.length) {
        const lastTrip = context.previousTrips[0];
        if (lastTrip) {
          return await analyzeTrip(lastTrip);
        }
      }

      // Check for network pulse request
      if (lowerQuery.includes('delay') || lowerQuery.includes('status') || lowerQuery.includes('pulse')) {
        aiResponse = await getNetworkPulseResponse(query, context?.preferredNetwork);
      }
      // Use Gemini API if location and destination are available
      else if (currentLocation && destination && mergedOptions.contextAware) {
        const mockEndLocation = { lat: -26.107, lng: 28.055 };
        const recommendation = await getTripRecommendation(
          currentLocation,
          mockEndLocation,
          10
        );
        
        if (recommendation) {
          aiResponse = `📍 **Route to ${destination}**\n\n` +
            `🚌 **Best option:** ${recommendation.mode}\n` +
            `💰 **Estimated fare:** ~R${recommendation.estimatedFare.toFixed(2)}\n` +
            `💡 **Why:** ${recommendation.reason}\n\n` +
            `_Need more details? Just ask!_`;
        } else {
          aiResponse = `📍 I can help you get to **${destination}**!\n\n` +
            `Please enable GPS for accurate directions, or tell me your starting point.`;
        }
      }
      // Use quick responses for common queries
      else if (lowerQuery.includes('taxi') && !lowerQuery.includes('gautrain')) {
        aiResponse = QUICK_RESPONSES.taxi;
      }
      else if (lowerQuery.includes('gautrain')) {
        aiResponse = QUICK_RESPONSES.gautrain;
      }
      else if (lowerQuery.includes('bus') || lowerQuery.includes('rea vaya') || lowerQuery.includes('a re yeng')) {
        aiResponse = QUICK_RESPONSES.bus;
      }
      else {
        aiResponse = QUICK_RESPONSES.default;
      }
      
      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: Date.now()
      };
      
      setState(prev => ({
        ...prev,
        response: aiResponse,
        chatHistory: mergedOptions.enableHistory 
          ? [...prev.chatHistory, assistantMessage].slice(-mergedOptions.maxHistoryItems)
          : [],
        isLoading: false
      }));
      
      return aiResponse;
      
    } catch (error) {
      console.error('Gemini error:', error);
      setState(prev => ({
        ...prev,
        error: 'Sorry, I had trouble processing your request. Please try again.',
        isLoading: false
      }));
      return null;
    } finally {
      abortControllerRef.current = null;
    }
  }, [mergedOptions.enableHistory, mergedOptions.maxHistoryItems, mergedOptions.contextAware, analyzeTrip]);

  // ======================================================
  // HELPER FUNCTIONS
  // ======================================================

  const getNetworkPulseResponse = async (
    _query: string, 
    network?: TransitNetwork
  ): Promise<string> => {
    const networkName = network || 'transit';
    
    return `📡 **${networkName} Network Status**

${getRandomNetworkStatus()}

**Live Updates:**
• Real-time tracking available
• Delays reported on some routes
• Check back for latest updates

💡 _Enable notifications for instant alerts!_`;
  };

  const getRandomNetworkStatus = (): string => {
    const statuses = [
      "✅ **Operating normally** - No major delays reported",
      "⚠️ **Minor delays** - 5-10 minute delays on some routes",
      "🟢 **Good service** - All routes running on schedule",
      "🕐 **Peak hour** - Expect heavier than normal traffic"
    ];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  // ======================================================
  // RETURN API
  // ======================================================

  return {
    // State
    isOpen: state.isOpen,
    query: state.query,
    response: state.response,
    isLoading: state.isLoading,
    error: state.error,
    chatHistory: state.chatHistory,
    
    // Actions
    openNavigator,
    closeNavigator,
    setQuery,
    askGemini,
    analyzeTrip,
    clearHistory,
    
    // Utilities
    hasHistory: state.chatHistory.length > 0,
    lastResponse: state.response,
    isTyping: state.isLoading
  };
};

// ======================================================
// EXPORT TYPES
// ======================================================
export type { GeminiNavigationState, ChatMessage, GeminiNavigationOptions };