import React, { useState, useCallback } from 'react';
import { planTripWithAI } from '../../services/geminiService';
import { RouteOption, Provider } from '../../types';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import RouteMap from '../ui/RouteMap';
import { PROVIDER_COLORS } from '../../constants';

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
        <div className="bg-rea-gray-dark rounded-lg p-4 space-y-4">
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

const PlannerPage: React.FC = () => {
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
        <div className="p-4 space-y-6 pb-24">
            <header className="text-center">
                <h1 className="text-3xl font-bold">Trip Planner</h1>
                <p className="text-rea-gray-light">Let AI find the best route for you.</p>
            </header>

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
                    <p className="font-semibold text-rea-gray-light">Finding the best routes with Gemini...</p>
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
            
             {!isLoading && !routeOptions.length && !error && (
                <div className="text-center py-10">
                    <Icon name="planner" className="w-16 h-16 text-rea-gray-light mx-auto mb-4" />
                    <p className="text-rea-gray-light">Enter a destination to start planning your trip.</p>
                </div>
            )}
        </div>
    );
};

export default PlannerPage;