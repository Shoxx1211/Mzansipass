// src/components/GeminiNavigator.tsx
// Pulse Transit - Premium AI Navigation Assistant
// Features: Chat history, suggested queries, quick actions, typing indicators, message animations

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import type { Location } from '../types';

// ======================================================
// TYPES
// ======================================================
interface GeminiNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (query: string) => void;
  response: string | null;
  isLoading: boolean;
  error: string | null;
  onAsk: (query: string) => void;
  currentLocation?: Location | null;
  destination?: string;
  onSetDestination?: (dest: string) => void;
  chatHistory?: ChatMessage[];
  onClearHistory?: () => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isTyping?: boolean;
}

interface SuggestedQuery {
  icon: string;
  text: string;
  category: 'route' | 'fare' | 'schedule' | 'general';
}

// ======================================================
// CONSTANTS
// ======================================================
const POPULAR_DESTINATIONS = [
  { name: "Sandton", icon: "🏙️", type: "CBD" },
  { name: "Pretoria", icon: "🏛️", type: "Capital" },
  { name: "Braamfontein", icon: "🏢", type: "Student Hub" },
  { name: "OR Tambo Airport", icon: "✈️", type: "Airport" },
  { name: "Midrand", icon: "🏗️", type: "Business" },
  { name: "Park Station", icon: "🚉", type: "Station" }
];

const SUGGESTED_QUERIES: SuggestedQuery[] = [
  { icon: "🗺️", text: "How to get to Sandton?", category: "route" },
  { icon: "💰", text: "What are taxi fares from Soweto?", category: "fare" },
  { icon: "🚆", text: "Gautrain operating hours", category: "schedule" },
  { icon: "🚌", text: "Rea Vaya bus routes to Parktown", category: "route" },
  { icon: "⏰", text: "Peak vs off-peak fare difference", category: "fare" },
  { icon: "🔄", text: "Best transfer from taxi to Gautrain", category: "route" }
];

const QUICK_ACTIONS = [
  { icon: "🚖", label: "Taxi Info", query: "Tell me about taxi transport in Joburg" },
  { icon: "🚆", label: "Gautrain", query: "Gautrain schedules and fares" },
  { icon: "🚌", label: "Bus Routes", query: "Rea Vaya and A Re Yeng bus services" },
  { icon: "💰", label: "Fare Help", query: "How are transport fares calculated?" }
];

// ======================================================
// SUB-COMPONENTS
// ======================================================
const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const MessageBubble: React.FC<{ message: ChatMessage }> = memo(({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <span className="text-sm">🤖</span>
            <span className="text-[10px] text-white/40">Pulse AI</span>
          </div>
        )}
        <div
          className={`
            px-4 py-3 rounded-2xl break-words
            ${isUser 
              ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white' 
              : 'glass border border-white/10 text-white/90'
            }
          `}
        >
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {message.content}
          </pre>
        </div>
        <p className={`text-[10px] text-white/30 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

const SuggestedQueryChip: React.FC<{
  query: SuggestedQuery;
  onClick: () => void;
}> = ({ query, onClick }) => (
  <button
    onClick={onClick}
    className="
      flex items-center gap-2 px-3 py-2 rounded-xl
      bg-white/5 hover:bg-white/10
      border border-white/10 hover:border-cyan-400/30
      transition-all duration-200
      text-sm text-white/80
      active:scale-95
    "
  >
    <span>{query.icon}</span>
    <span className="truncate max-w-[150px]">{query.text}</span>
  </button>
);

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="
      flex flex-col items-center gap-1 p-2 rounded-xl
      bg-white/5 hover:bg-white/10
      transition-all duration-200
      active:scale-95
      flex-1
    "
  >
    <span className="text-xl">{icon}</span>
    <span className="text-[10px] text-white/60">{label}</span>
  </button>
);

// ======================================================
// MAIN COMPONENT
// ======================================================
export const GeminiNavigator: React.FC<GeminiNavigatorProps> = ({
  isOpen,
  onClose,
  query,
  setQuery,
  response,
  isLoading,
  error,
  onAsk,
  onSetDestination,
  chatHistory: externalChatHistory,
  onClearHistory
}) => {
  const [internalChatHistory, setInternalChatHistory] = useState<ChatMessage[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const chatHistory = externalChatHistory || internalChatHistory;

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add response to chat history
  useEffect(() => {
    if (response && !isLoading) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      setInternalChatHistory(prev => [...prev, newMessage]);
      setShowSuggestions(false);
    }
  }, [response, isLoading]);

  // Handle user asking
  const handleAsk = useCallback(() => {
    if (!query.trim() || isLoading) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: Date.now()
    };
    setInternalChatHistory(prev => [...prev, userMessage]);
    
    // Call the onAsk prop
    onAsk(query);
    
    // Clear input but keep query for reference
    setQuery('');
    setShowSuggestions(false);
  }, [query, isLoading, onAsk, setQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleSuggestedQuery = (text: string) => {
    setQuery(text);
    onAsk(text);
  };

  const handleQuickAction = (queryText: string) => {
    setQuery(queryText);
    onAsk(queryText);
  };

  const handleClearHistory = () => {
    setInternalChatHistory([]);
    setShowSuggestions(true);
    if (onClearHistory) onClearHistory();
  };

  const handleDestinationClick = (destination: string) => {
    const queryText = `How to get to ${destination}?`;
    setQuery(queryText);
    onAsk(queryText);
    if (onSetDestination) {
      onSetDestination(destination);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 border-b border-white/10 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h2 className="font-bold text-white">Gemini Transit Assistant</h2>
              <p className="text-[10px] text-white/40">AI-powered • Real-time • South African transit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chatHistory.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/40 hover:text-white/80 transition-all"
              >
                🗑️
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-sm">✕</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-md mx-auto space-y-4">
          {/* Welcome Message */}
          {chatHistory.length === 0 && !isLoading && (
            <div className="text-center space-y-3 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 flex items-center justify-center">
                <span className="text-3xl">🤖</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Hello, Commuter!</h3>
                <p className="text-sm text-white/50 mt-1">
                  I'm your AI transit assistant. Ask me about routes, fares, or transport options in South Africa.
                </p>
              </div>
            </div>
          )}

          {/* Chat History */}
          {chatHistory.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl border border-white/10">
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !isLoading && (
            <div className="glass rounded-2xl p-4 border border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-2">
                <span className="text-red-400">⚠️</span>
                <p className="text-red-400 text-sm flex-1">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-red-400/70 hover:text-red-400"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Suggested Queries */}
          {showSuggestions && chatHistory.length === 0 && !isLoading && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <p className="text-xs text-white/40 mb-2">Suggested questions</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUERIES.map((sq) => (
                    <SuggestedQueryChip
                      key={sq.text}
                      query={sq}
                      onClick={() => handleSuggestedQuery(sq.text)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 mb-2">Popular destinations</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.name}
                      onClick={() => handleDestinationClick(dest.name)}
                      className="
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full
                        bg-white/5 hover:bg-white/10
                        border border-white/10
                        transition-all duration-200
                        text-xs text-white/80
                        active:scale-95
                      "
                    >
                      <span>{dest.icon}</span>
                      <span>{dest.name}</span>
                      <span className="text-[10px] text-white/30">{dest.type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 mb-2">Quick actions</p>
                <div className="flex gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <QuickActionButton
                      key={action.label}
                      icon={action.icon}
                      label={action.label}
                      onClick={() => handleQuickAction(action.query)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Sticky at bottom */}
      <div className="sticky bottom-0 bg-gradient-to-t from-black via-black to-transparent pt-4">
        <div className="border-t border-white/10 bg-black/95">
          <div className="max-w-md mx-auto p-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef as any}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your commute..."
                  rows={1}
                  className="
                    w-full px-4 py-3 rounded-xl
                    bg-white/10 border border-white/20
                    focus:border-cyan-400 focus:outline-none
                    text-white text-sm
                    resize-none
                    placeholder-white/30
                    transition-all
                  "
                  style={{ minHeight: '48px', maxHeight: '100px' }}
                />
              </div>
              <button
                onClick={handleAsk}
                disabled={isLoading || !query.trim()}
                className="
                  w-12 h-12 rounded-xl
                  bg-gradient-to-r from-cyan-500 to-emerald-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center
                  transition-all active:scale-95
                "
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="text-white text-lg">➤</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-white/30 text-center mt-2">
              Pulse AI uses Google Gemini • Responses are AI-generated
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};