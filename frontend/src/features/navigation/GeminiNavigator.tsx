// src/features/navigation/GeminiNavigator.tsx
// Pulse Transit - AI Navigation Assistant
// Clean UTF-8 version

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";

import type { Location } from "../../types";

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

  onSetDestination?: (destination: string) => void;

  chatHistory?: ChatMessage[];
  onClearHistory?: () => void;
}

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: number;
  isTyping?: boolean;
}

interface SuggestedQuery {
  icon: string;
  text: string;
  category: "route" | "fare" | "schedule" | "general";
}

// ======================================================
// POPULAR DESTINATIONS
// ======================================================

const POPULAR_DESTINATIONS = [
  {
    name: "Sandton",
    icon: "📍",
    type: "CBD",
  },
  {
    name: "Pretoria",
    icon: "🏙️",
    type: "Capital",
  },
  {
    name: "Braamfontein",
    icon: "🎓",
    type: "Student Hub",
  },
  {
    name: "OR Tambo Airport",
    icon: "✈️",
    type: "Airport",
  },
  {
    name: "Midrand",
    icon: "🏢",
    type: "Business",
  },
  {
    name: "Park Station",
    icon: "🚉",
    type: "Station",
  },
];

// ======================================================
// SUGGESTED QUESTIONS
// ======================================================

const SUGGESTED_QUERIES: SuggestedQuery[] = [
  {
    icon: "🗺️",
    text: "How to get to Sandton?",
    category: "route",
  },
  {
    icon: "💰",
    text: "What are taxi fares from Soweto?",
    category: "fare",
  },
  {
    icon: "🚆",
    text: "Gautrain operating hours",
    category: "schedule",
  },
  {
    icon: "🚌",
    text: "Rea Vaya bus routes to Parktown",
    category: "route",
  },
  {
    icon: "⏱️",
    text: "Peak vs off-peak fare difference",
    category: "fare",
  },
  {
    icon: "🔄",
    text: "Best transfer from taxi to Gautrain",
    category: "route",
  },
];

// ======================================================
// QUICK ACTIONS
// ======================================================

const QUICK_ACTIONS = [
  {
    icon: "🚕",
    label: "Taxi Info",
    query: "Tell me about taxi transport in Joburg",
  },
  {
    icon: "🚆",
    label: "Gautrain",
    query: "Gautrain schedules and fares",
  },
  {
    icon: "🚌",
    label: "Bus Routes",
    query: "Rea Vaya and A Re Yeng bus services",
  },
  {
    icon: "💰",
    label: "Fare Help",
    query: "How are transport fares calculated?",
  },
];

// ======================================================
// TYPING INDICATOR
// ======================================================

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <div
      className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
      style={{ animationDelay: "0ms" }}
    />

    <div
      className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
      style={{ animationDelay: "150ms" }}
    />

    <div
      className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
      style={{ animationDelay: "300ms" }}
    />
  </div>
);

// ======================================================
// MESSAGE BUBBLE
// ======================================================

const MessageBubble: React.FC<{
  message: ChatMessage;
}> = memo(({ message }) => {
  const isUser = message.type === "user";

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      } animate-fadeIn`}
    >
      <div
        className={`max-w-[85%] ${
          isUser ? "order-2" : "order-1"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <span className="text-sm">🤖</span>

            <span className="text-[10px] text-white/40">
              Pulse AI
            </span>
          </div>
        )}

        <div
          className={`
            px-4 py-3
            rounded-2xl
            break-words
            ${
              isUser
                ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white"
                : "glass border border-white/10 text-white/90"
            }
          `}
        >
          <pre
            className="
              text-sm
              whitespace-pre-wrap
              font-sans
              leading-relaxed
            "
          >
            {message.content}
          </pre>
        </div>

        <p
          className={`
            text-[10px]
            text-white/30
            mt-1
            ${isUser ? "text-right" : "text-left"}
          `}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

// ======================================================
// SUGGESTED QUERY CHIP
// ======================================================

const SuggestedQueryChip: React.FC<{
  query: SuggestedQuery;
  onClick: () => void;
}> = ({ query, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="
      flex
      items-center
      gap-2
      px-3
      py-2
      rounded-xl
      bg-white/5
      hover:bg-white/10
      border
      border-white/10
      hover:border-cyan-400/30
      transition-all
      duration-200
      text-sm
      text-white/80
      active:scale-95
      max-w-full
    "
  >
    <span>{query.icon}</span>

    <span className="truncate max-w-[180px]">
      {query.text}
    </span>
  </button>
);

// ======================================================
// QUICK ACTION BUTTON
// ======================================================

const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="
      flex
      flex-col
      items-center
      justify-center
      gap-1
      p-3
      rounded-xl
      bg-white/5
      hover:bg-white/10
      border
      border-white/5
      transition-all
      duration-200
      active:scale-95
      flex-1
      min-w-0
    "
  >
    <span className="text-xl">{icon}</span>

    <span className="text-[10px] text-white/60 text-center">
      {label}
    </span>
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
  onClearHistory,
}) => {
  const [internalChatHistory, setInternalChatHistory] =
    useState<ChatMessage[]>([]);

  const [showSuggestions, setShowSuggestions] =
    useState(true);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLTextAreaElement>(null);

  const chatContainerRef =
    useRef<HTMLDivElement>(null);

  const chatHistory =
    externalChatHistory || internalChatHistory;

  // ====================================================
  // SCROLL TO BOTTOM
  // ====================================================

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [
    chatHistory,
    isLoading,
    scrollToBottom,
  ]);

  // ====================================================
  // FOCUS INPUT
  // ====================================================

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  // ====================================================
  // ADD ASSISTANT RESPONSE
  // ====================================================

  useEffect(() => {
    if (!response || isLoading) return;

    const newMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      type: "assistant",
      content: response,
      timestamp: Date.now(),
    };

    setInternalChatHistory((previous) => [
      ...previous,
      newMessage,
    ]);

    setShowSuggestions(false);
  }, [response, isLoading]);

  // ====================================================
  // ASK QUESTION
  // ====================================================

  const handleAsk = useCallback(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmedQuery,
      timestamp: Date.now(),
    };

    setInternalChatHistory((previous) => [
      ...previous,
      userMessage,
    ]);

    onAsk(trimmedQuery);

    setQuery("");

    setShowSuggestions(false);
  }, [
    query,
    isLoading,
    onAsk,
    setQuery,
  ]);

  // ====================================================
  // KEYBOARD HANDLER
  // ====================================================

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleAsk();
    }
  };

  // ====================================================
  // SUGGESTED QUESTION
  // ====================================================

  const handleSuggestedQuery = (
    text: string
  ) => {
    setQuery(text);
    setShowSuggestions(false);
    onAsk(text);
  };

  // ====================================================
  // QUICK ACTION
  // ====================================================

  const handleQuickAction = (
    queryText: string
  ) => {
    setQuery(queryText);
    setShowSuggestions(false);
    onAsk(queryText);
  };

  // ====================================================
  // CLEAR HISTORY
  // ====================================================

  const handleClearHistory = () => {
    setInternalChatHistory([]);
    setShowSuggestions(true);

    if (onClearHistory) {
      onClearHistory();
    }
  };

  // ====================================================
  // DESTINATION
  // ====================================================

  const handleDestinationClick = (
    destination: string
  ) => {
    const queryText =
      `How do I get to ${destination}?`;

    setQuery(queryText);

    setShowSuggestions(false);

    onAsk(queryText);

    if (onSetDestination) {
      onSetDestination(destination);
    }
  };

  // ====================================================
  // CLOSED
  // ====================================================

  if (!isOpen) {
    return null;
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        bg-[#03060f]
        flex
        flex-col
      "
    >
      {/* ================================================
          HEADER
      ================================================= */}

      <header
        className="
          shrink-0
          bg-black/95
          backdrop-blur-xl
          border-b
          border-white/10
          px-4
          py-3
          safe-top
        "
      >
        <div
          className="
            w-full
            max-w-4xl
            mx-auto
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="
                w-10
                h-10
                shrink-0
                rounded-xl
                bg-gradient-to-br
                from-cyan-500/20
                to-emerald-500/20
                border
                border-white/10
                flex
                items-center
                justify-center
              "
            >
              <span className="text-xl">
                🤖
              </span>
            </div>

            <div className="min-w-0">
              <h2 className="font-bold text-white truncate">
                Pulse AI
              </h2>

              <p className="text-[10px] text-white/40 truncate">
                AI-powered South African transit assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {chatHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                aria-label="Clear chat history"
                className="
                  w-9
                  h-9
                  rounded-full
                  bg-white/10
                  flex
                  items-center
                  justify-center
                  text-sm
                  hover:bg-white/15
                  transition-all
                  active:scale-95
                "
              >
                🗑️
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className="
                w-9
                h-9
                rounded-full
                bg-white/10
                flex
                items-center
                justify-center
                text-white/70
                hover:text-white
                hover:bg-white/15
                transition-all
                active:scale-95
              "
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      {/* ================================================
          CHAT AREA
      ================================================= */}

      <div
        ref={chatContainerRef}
        className="
          flex-1
          min-h-0
          overflow-y-auto
          px-4
          py-6
        "
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="
            w-full
            max-w-4xl
            mx-auto
          "
        >
          <div className="space-y-5">
            {/* ==========================================
                WELCOME MESSAGE
            =========================================== */}

            {chatHistory.length === 0 &&
              !isLoading && (
                <div
                  className="
                    text-center
                    max-w-xl
                    mx-auto
                    py-8
                    animate-fadeIn
                  "
                >
                  <div
                    className="
                      w-20
                      h-20
                      mx-auto
                      rounded-3xl
                      bg-gradient-to-br
                      from-cyan-500/20
                      to-emerald-500/20
                      border
                      border-white/10
                      flex
                      items-center
                      justify-center
                      mb-5
                    "
                  >
                    <span className="text-4xl">
                      🤖
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-white">
                    Hello, Commuter!
                  </h3>

                  <p className="text-sm text-white/50 mt-2 leading-relaxed">
                    I'm your AI transit assistant.
                    Ask me about routes, fares,
                    schedules, or transport options
                    across South Africa.
                  </p>
                </div>
              )}

            {/* ==========================================
                CHAT HISTORY
            =========================================== */}

            {chatHistory.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
              />
            ))}

            {/* ==========================================
                TYPING INDICATOR
            =========================================== */}

            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="
                    bg-white/5
                    border
                    border-white/10
                    rounded-2xl
                  "
                >
                  <TypingIndicator />
                </div>
              </div>
            )}

            {/* ==========================================
                ERROR
            =========================================== */}

            {error && !isLoading && (
              <div
                className="
                  max-w-2xl
                  mx-auto
                  rounded-2xl
                  p-4
                  border
                  border-red-500/20
                  bg-red-500/5
                "
              >
                <div className="flex items-start gap-3">
                  <span className="text-red-400">
                    ⚠️
                  </span>

                  <p className="text-red-400 text-sm flex-1">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      window.location.reload()
                    }
                    className="
                      text-xs
                      text-red-400/70
                      hover:text-red-400
                    "
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* ==========================================
                SUGGESTIONS
            =========================================== */}

            {showSuggestions &&
              chatHistory.length === 0 &&
              !isLoading && (
                <div
                  className="
                    max-w-4xl
                    mx-auto
                    space-y-6
                    animate-fadeIn
                  "
                >
                  {/* Suggested Questions */}

                  <section>
                    <p className="text-xs text-white/40 mb-3">
                      Suggested questions
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_QUERIES.map(
                        (suggestedQuery) => (
                          <SuggestedQueryChip
                            key={
                              suggestedQuery.text
                            }
                            query={
                              suggestedQuery
                            }
                            onClick={() =>
                              handleSuggestedQuery(
                                suggestedQuery.text
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  </section>

                  {/* Popular Destinations */}

                  <section>
                    <p className="text-xs text-white/40 mb-3">
                      Popular destinations
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {POPULAR_DESTINATIONS.map(
                        (destination) => (
                          <button
                            key={
                              destination.name
                            }
                            type="button"
                            onClick={() =>
                              handleDestinationClick(
                                destination.name
                              )
                            }
                            className="
                              flex
                              items-center
                              gap-2
                              px-3
                              py-2
                              rounded-full
                              bg-white/5
                              hover:bg-white/10
                              border
                              border-white/10
                              transition-all
                              duration-200
                              text-xs
                              text-white/80
                              active:scale-95
                            "
                          >
                            <span>
                              {
                                destination.icon
                              }
                            </span>

                            <span>
                              {
                                destination.name
                              }
                            </span>

                            <span className="text-[10px] text-white/30">
                              {
                                destination.type
                              }
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </section>

                  {/* Quick Actions */}

                  <section>
                    <p className="text-xs text-white/40 mb-3">
                      Quick actions
                    </p>

                    <div
                      className="
                        grid
                        grid-cols-2
                        sm:grid-cols-4
                        gap-2
                      "
                    >
                      {QUICK_ACTIONS.map(
                        (action) => (
                          <QuickActionButton
                            key={action.label}
                            icon={action.icon}
                            label={action.label}
                            onClick={() =>
                              handleQuickAction(
                                action.query
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  </section>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* ================================================
          INPUT AREA
      ================================================= */}

      <footer
        className="
          shrink-0
          border-t
          border-white/10
          bg-black/95
          backdrop-blur-xl
          safe-bottom
        "
      >
        <div
          className="
            w-full
            max-w-4xl
            mx-auto
            px-4
            py-3
          "
        >
          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-0">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="Ask about your commute..."
                rows={1}
                className="
                  w-full
                  px-4
                  py-3
                  rounded-xl
                  bg-white/10
                  border
                  border-white/15
                  focus:border-cyan-400
                  focus:outline-none
                  text-white
                  text-sm
                  resize-none
                  placeholder-white/30
                  transition-all
                "
                style={{
                  minHeight: "48px",
                  maxHeight: "120px",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleAsk}
              disabled={
                isLoading ||
                !query.trim()
              }
              aria-label="Send message"
              className="
                w-12
                h-12
                shrink-0
                rounded-xl
                bg-gradient-to-r
                from-cyan-500
                to-emerald-500
                disabled:opacity-40
                disabled:cursor-not-allowed
                flex
                items-center
                justify-center
                transition-all
                active:scale-95
              "
            >
              {isLoading ? (
                <div
                  className="
                    w-5
                    h-5
                    border-2
                    border-white/30
                    border-t-white
                    rounded-full
                    animate-spin
                  "
                />
              ) : (
                <span className="text-white text-lg">
                  ➤
                </span>
              )}
            </button>
          </div>

          <p className="text-[10px] text-white/25 text-center mt-2">
            Pulse AI uses Google Gemini • Responses are AI-generated
          </p>
        </div>
      </footer>
    </div>
  );
};

// ======================================================
// DISPLAY NAME
// ======================================================

GeminiNavigator.displayName =
  "GeminiNavigator";

export default GeminiNavigator;