// src/hooks/useGeminiNavigation.ts
import { useState, useCallback } from 'react';
import type { Location } from '../types';

interface GeminiNavigationState {
  isOpen: boolean;
  query: string;
  response: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useGeminiNavigation = () => {
  const [state, setState] = useState<GeminiNavigationState>({
    isOpen: false,
    query: '',
    response: null,
    isLoading: false,
    error: null
  });

  const openNavigator = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, error: null }));
  }, []);

  const closeNavigator = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, query: '', response: null }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));
  }, []);

  const askGemini = useCallback(async (
    query: string,
    currentLocation?: Location | null,
    destination?: string
  ) => {
    if (!query.trim()) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let aiResponse = '';
      const lowerQuery = query.toLowerCase();
      
      if (lowerQuery.includes('taxi')) {
        aiResponse = `🚖 South African Taxi Guide:\n\n• Minibus taxis are the most common transport\n• Fares typically range from R15 - R50\n• Always confirm the fare before boarding\n• Peak hours (6-9am, 3-7pm) are busiest\n\n💡 Need a specific route? Try "Taxi to Sandton"`;
      } 
      else if (lowerQuery.includes('gautrain')) {
        aiResponse = `🚆 Gautrain Express:\n\n• Routes: Pretoria ↔ Johannesburg ↔ OR Tambo\n• Operating hours: 5:30 AM - 8:30 PM\n• Fares: R30 - R200 (depending on distance)\n• Get a Gold Card for easy tap-in/out\n\n💡 Off-peak fares are cheaper!`;
      }
      else if (lowerQuery.includes('bus') || lowerQuery.includes('re a vaya')) {
        aiResponse = `🚌 Rea Vaya Bus Service (Joburg):\n\n• Routes: Parktown, Baragwanath, Ellis Park\n• Fares start from R7.50\n• Weekly caps available for frequent riders\n• Real-time tracking on the app\n\n💡 Check the Rea Vaya website for schedules!`;
      }
      else if (lowerQuery.includes('how to get to') || lowerQuery.includes('directions')) {
        const placeMatch = query.match(/to\s+(.+?)(?:\?|$)/i);
        const place = placeMatch ? placeMatch[1] : 'your destination';
        aiResponse = `📍 Getting to ${place}:\n\n• Best option: Take a taxi from your current location\n• Estimated fare: R25 - R45\n• Journey time: ~20-35 minutes\n• Alternative: Use Gautrain if available\n\n💡 Open Google Maps for real-time directions!`;
      }
      else {
        aiResponse = `🤖 South African Transit Assistant\n\nI can help you with:\n\n📍 Getting to destinations\n🚖 Taxi routes and fares\n🚆 Gautrain schedules and pricing\n🚌 Bus services\n💰 Fare estimates\n\nTry asking:\n• "How to get to Sandton?"\n• "What are taxi fares?"\n• "Gautrain operating hours"`;
      }
      
      setState(prev => ({
        ...prev,
        response: aiResponse,
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
    }
  }, []);

  return {
    ...state,
    openNavigator,
    closeNavigator,
    setQuery,
    askGemini
  };
};
