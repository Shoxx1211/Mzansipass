import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { planTripWithAI, identifyLandmark } from '../../services/geminiService';
import { RouteOption, Provider } from '../../types';
import { DEMO_LANDMARKS, PROVIDER_COLORS } from '../../constants';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import RouteMap from '../ui/RouteMap';

// Sub-components for each tab to keep the code organized

// =================================================================
// 1. Planner Tab Component
// =================================================================
const ProviderIcon: React.FC<{ provider: Provider }> = ({ provider }) => {
    const iconName = provider === 'Gautrain' || provider === 'PRASA' ? 'train' : 'bus';
    const colorClass = PROVIDER_COLORS[provider] || 'bg-gray-500 text-white';

    return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
            <Icon name={iconName} className="w-6 h-6" />
        </div>
    );
};

const RouteOptionCard: React.FC<{ route: RouteOption }> = ({ route }) => {
    return (
        <div className="bg-rea-gray-dark rounded-lg p-4 space-y-4 animate-fade-in-up">
            <header className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-bold">{route.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-rea-gray-light">
                        <span>{route.travelTime}</span>
                        <span className="font-bold text-lg text-white">R {route.totalFare.toFixed(2)}</span>
                    </div>
                </div>
                {route.tag && (
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                        route.tag === 'Recommended' ? 'bg-green-500 text-white' :
                        route.tag === 'Cheapest' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'
                    }`}>
                        {route.tag}
                    </span>
                )}
            </header>
            <div className="space-y-3">
                {route.steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-4">
                        <ProviderIcon provider={step.provider} />
                        <div>
                            <p className="font-semibold">{step.provider}: {step.from} to {step.to}</p>
                            <p className="text-sm text-rea-gray-light">{step.instruction}</p>
                        </div>
                    </div>
                ))}
            </div>
            <RouteMap route={route} />
        </div>
    );
};

const PlannerTab: React.FC = () => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);

    const handlePlanTrip = useCallback(async () => {
        if (!query.trim()) {
            setError('Please enter your destination.');
            return;
        }
        setIsLoading(true);
        setError('');
        setRouteOptions([]);
        try {
            const results = await planTripWithAI(query);
            setRouteOptions(results);
        } catch (err) {
            setError('Failed to plan trip. Please try again later.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [query]);

    return (
        <div className="p-4 space-y-6">
            <div className="space-y-4">
                <Input
                    label="Where are you going?"
                    id="destination"
                    placeholder="e.g., from Sandton to Soweto Theatre"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isLoading}
                />
                <Button onClick={handlePlanTrip} disabled={isLoading || !query.trim()}>
                    {isLoading ? 'Planning...' : 'Find Routes'}
                </Button>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                    <div className="w-12 h-12 border-4 border-rea-gray-dark border-t-rea-red rounded-full animate-spin"></div>
                    <p className="font-semibold text-rea-gray-light">Finding routes with Gemini...</p>
                </div>
            )}
            
            {!isLoading && routeOptions.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold">Your Route Options</h2>
                    {routeOptions.map((route, index) => (
                        <RouteOptionCard key={index} route={route} />
                    ))}
                </div>
            )}
        </div>
    );
};

// =================================================================
// 2. Visual Search Tab Component
// =================================================================
const VisualSearchTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ landmark: typeof DEMO_LANDMARKS[0], description: string } | null>(null);
    const [error, setError] = useState('');

    const handleScan = useCallback(async (landmark: typeof DEMO_LANDMARKS[0]) => {
        setIsLoading(true);
        setResult(null);
        setError('');
        try {
            const description = await identifyLandmark(landmark.base64);
            setResult({ landmark, description });
        } catch (e) {
            setError('Could not identify the landmark. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return (
        <div className="p-4 space-y-6">
            <p className="text-center text-rea-gray-light">
                Select a landmark to identify using Gemini's vision capabilities.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {DEMO_LANDMARKS.map((landmark) => (
                    <button key={landmark.name} onClick={() => handleScan(landmark)} disabled={isLoading} className="group relative aspect-square rounded-lg overflow-hidden transition-transform transform hover:scale-105 active:scale-95 disabled:opacity-50">
                        <img src={`data:image/jpeg;base64,${landmark.base64}`} alt={landmark.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-2 text-center text-white">
                            <Icon name="camera" className="w-8 h-8 opacity-70 group-hover:opacity-100 transition-opacity" />
                            <p className="font-bold mt-1">{landmark.name}</p>
                        </div>
                    </button>
                ))}
            </div>
            
            {isLoading && (
                <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                    <div className="w-12 h-12 border-4 border-rea-gray-dark border-t-rea-red rounded-full animate-spin"></div>
                    <p className="font-semibold text-rea-gray-light">Analyzing image with Gemini...</p>
                </div>
            )}
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            {result && (
                <div className="bg-rea-gray-dark rounded-lg overflow-hidden animate-fade-in-up">
                    <img src={`data:image/jpeg;base64,${result.landmark.base64}`} alt={result.landmark.name} className="w-full h-48 object-cover" />
                    <div className="p-4">
                        <h3 className="text-xl font-bold">{result.landmark.name}</h3>
                        <p className="text-rea-gray-light mt-2">{result.description}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// =================================================================
// 3. Assistant Tab Component
// =================================================================
interface Message {
  role: 'user' | 'model';
  text: string;
}

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br />');
    return <p dangerouslySetInnerHTML={{ __html: html }} />;
};

const AssistantTab: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (!process.env.API_KEY) {
            console.error("API_KEY is not set.");
            setMessages([{ role: 'model', text: "Howzit! I can't seem to connect right now because my API key is missing. Please make sure it's set up correctly." }]);
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: "You are Mzansi Explorer, a friendly and knowledgeable AI assistant for the MzansiPass app. Your expertise is in South African public transport. Be conversational, helpful, and use a little bit of South African slang where appropriate (e.g., 'howzit', 'lekker'). Always provide clear and actionable information. Format your responses with markdown.",
            },
        });
        setMessages([{ role: 'model', text: 'Howzit! How can I help you explore Mzansi today? Ask me about routes, fares, or anything else.'}])
    }, []);

    const handleSendMessage = useCallback(async (messageText: string) => {
        if (isLoading || !messageText.trim() || !chatRef.current) return;
        
        const userMessage: Message = { role: 'user', text: messageText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chatRef.current.sendMessageStream({ message: messageText });
            let modelResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);
            
            for await (const chunk of result) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'model', text: "Apologies, I'm having trouble connecting. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-rea-red flex items-center justify-center flex-shrink-0"><Icon name="sparkles" className="w-5 h-5" /></div>}
                        <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.role === 'user' ? 'bg-rea-gray-dark rounded-br-none' : 'bg-gray-800 rounded-bl-none'}`}>
                            <SimpleMarkdown text={msg.text} />
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-end gap-2 justify-start">
                        <div className="w-8 h-8 rounded-full bg-rea-red flex items-center justify-center flex-shrink-0"><Icon name="sparkles" className="w-5 h-5" /></div>
                        <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-gray-800 rounded-bl-none flex items-center space-x-1.5">
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-700 bg-rea-black flex-shrink-0">
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about a trip..."
                        className="w-full bg-rea-gray-dark border border-gray-600 rounded-lg py-3 px-4 text-rea-white placeholder-rea-gray-light focus:outline-none focus:ring-2 focus:ring-rea-red"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="bg-rea-red text-white p-3 rounded-lg disabled:bg-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </form>
            </div>
        </div>
    );
}


// =================================================================
// Main Explorer Page Component
// =================================================================
type ExplorerTabId = 'planner' | 'visual' | 'assistant';

const ExplorerPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ExplorerTabId>('planner');

    const tabs: { id: ExplorerTabId; label: string; icon: string }[] = [
        { id: 'planner', label: 'Planner', icon: 'planner' },
        { id: 'visual', label: 'Visual Search', icon: 'camera' },
        { id: 'assistant', label: 'Assistant', icon: 'sparkles' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'planner': return <PlannerTab />;
            case 'visual': return <VisualSearchTab />;
            case 'assistant': return <AssistantTab />;
            default: return null;
        }
    };
    
    // The Assistant tab needs full height for chat, others don't
    const pageContainerClass = activeTab === 'assistant' 
        ? "flex flex-col flex-1 overflow-hidden" 
        : "flex-1 overflow-y-auto";

    return (
        <div className="flex flex-col h-full">
            <header className="p-4 text-center border-b border-gray-700 flex-shrink-0">
                <h1 className="text-2xl font-bold">Explorer Hub</h1>
                <p className="text-sm text-rea-gray-light">Your AI Toolkit for Mzansi Travel</p>
            </header>
            
            <div className="flex-shrink-0 bg-rea-black/50 border-b border-gray-800">
                <div className="flex justify-around p-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 px-1 flex items-center justify-center gap-2 text-sm font-semibold rounded-md transition-colors ${
                                activeTab === tab.id ? 'bg-rea-red text-white' : 'text-rea-gray-light hover:bg-rea-gray-dark'
                            }`}
                        >
                            <Icon name={tab.icon} className="w-5 h-5" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className={pageContainerClass}>
                {renderContent()}
            </div>
        </div>
    );
};

export default ExplorerPage;