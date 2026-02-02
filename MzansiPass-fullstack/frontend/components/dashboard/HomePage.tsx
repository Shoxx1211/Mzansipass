import React, { useState, useCallback, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import VirtualCard from '../ui/VirtualCard';
import { Provider, Trip, TransitAlert, ReportCategory, RouteOption } from '../../types';
import { getCurrentLocationName } from '../../services/locationService';
import NfcScanModal from '../modals/NfcScanModal';
import ReportIssueModal from '../modals/ReportIssueModal';
import { STATIONS } from '../../constants';
import { getLiveJourneyUpdate, LiveJourneyUpdate } from '../../services/geminiService';
import RouteMap from '../ui/RouteMap';
import Button from '../ui/Button';

const availableProviders = (Object.keys(STATIONS) as Provider[]).filter(p => p !== 'PRASA');

const timeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y ago`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo ago`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}d ago`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m ago`;
    return `${Math.floor(seconds)}s ago`;
};

const ALERT_CATEGORY_CONFIG: Record<ReportCategory, { icon: string; color: string; }> = {
    crowded: { icon: 'users', color: 'text-blue-400' },
    delay: { icon: 'clock', color: 'text-yellow-400' },
    hazard: { icon: 'alert-triangle', color: 'text-orange-500' },
    info: { icon: 'info', color: 'text-cyan-400' },
    other: { icon: 'info', color: 'text-gray-400' }
};

const AlertCard: React.FC<{ alert: TransitAlert }> = ({ alert }) => {
    const isOfficial = alert.type === 'official';
    const config = isOfficial 
        ? { icon: 'alert-circle', color: 'text-rea-red' } 
        : ALERT_CATEGORY_CONFIG[alert.category];

    return (
        <div className={`bg-rea-gray-dark p-4 rounded-lg border-l-4 ${isOfficial ? 'border-rea-red' : 'border-blue-500'}`}>
            <div className="flex items-start space-x-3">
                <Icon name={config.icon} className={`w-6 h-6 flex-shrink-0 mt-1 ${config.color}`} />
                <div className="flex-grow">
                    <div className="flex justify-between items-baseline">
                        <h3 className="font-bold text-white">{alert.title}</h3>
                        <p className="text-xs text-rea-gray-light flex-shrink-0 ml-2">{timeAgo(alert.timestamp)}</p>
                    </div>
                    {alert.provider && <span className="text-xs font-semibold text-gray-400">{alert.provider}</span>}
                    <p className="text-sm text-rea-gray-light mt-1">{alert.description}</p>
                </div>
            </div>
        </div>
    );
};

const LiveJourneyCard: React.FC<{ trip: Trip }> = ({ trip }) => {
    const { transitAlerts, notifyContact } = useData();
    const [assistance, setAssistance] = useState<LiveJourneyUpdate | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notificationSent, setNotificationSent] = useState(false);

    useEffect(() => {
        const checkInterval = setInterval(() => {
            // Find the most recent, relevant alert that is a major delay
            const relevantAlert = transitAlerts.find(a =>
                a.provider === trip.provider &&
                a.category === 'delay' &&
                a.title.toLowerCase().includes('major')
            );

            if (relevantAlert && !assistance && !isLoading) {
                console.log("Relevant alert found, triggering AI assistance...");
                setIsLoading(true);
                getLiveJourneyUpdate(trip, relevantAlert)
                    .then(setAssistance)
                    .catch(console.error)
                    .finally(() => setIsLoading(false));
            }
        }, 10000); // Check for alerts every 10 seconds

        return () => clearInterval(checkInterval);
    }, [trip, transitAlerts, assistance, isLoading]);

    const handleNotify = () => {
        if(assistance?.notificationMessage) {
            notifyContact(assistance.notificationMessage);
            setNotificationSent(true);
        }
    };

    return (
        <div className="bg-rea-gray-dark p-4 rounded-lg space-y-3 min-h-[10rem] flex flex-col justify-center items-center text-center">
             <h2 className="text-xl font-bold">Live Journey</h2>
            {assistance ? (
                <div className="w-full space-y-3 animate-fade-in-up">
                    <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-300 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Icon name="alert-triangle" className="w-6 h-6 flex-shrink-0" />
                            <p className="text-sm text-left">{assistance.userMessage}</p>
                        </div>
                    </div>
                    {assistance.alternativeRoute && (
                        <div className="bg-gray-800 p-3 rounded-lg text-left">
                            <h4 className="font-bold text-lg mb-2">Suggested New Route:</h4>
                            <RouteMap route={assistance.alternativeRoute} />
                            <Button className="mt-3 text-base" onClick={() => alert("Route accepted! In a real app, this would update your trip.")}>
                                <Icon name="reroute" className="w-5 h-5" /> Accept New Route
                            </Button>
                        </div>
                    )}
                    {assistance.notificationMessage && (
                        <div className="bg-gray-800 p-3 rounded-lg">
                             <Button variant="secondary" className="text-base" onClick={handleNotify} disabled={notificationSent}>
                                <Icon name="bell" className="w-5 h-5" />
                                {notificationSent ? 'Notification Sent!' : 'Notify Contact'}
                            </Button>
                        </div>
                    )}
                </div>
            ) : isLoading ? (
                <p className="font-semibold text-yellow-400 animate-pulse">
                    Disruption detected! Consulting AI assistant...
                </p>
            ) : (
                <div className="w-full space-y-3">
                    <p className="font-semibold text-green-400 animate-pulse">
                        Trip in Progress with {trip.provider}
                    </p>
                    <div className="flex items-center justify-between text-rea-gray-light w-full max-w-xs mx-auto">
                        <div className="flex-1 text-left">
                            <p className="text-xs">From</p>
                            <p className="font-bold text-white truncate">{trip.from}</p>
                        </div>
                        <div className="flex-1 flex justify-center">
                            <Icon name={trip.provider === 'Gautrain' ? 'train' : 'bus'} className="w-8 h-8 text-rea-red animate-travel-horizontal" />
                        </div>
                        <div className="flex-1 text-right">
                            <p className="text-xs">To</p>
                            <p className="font-bold text-white">...</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const HomePage: React.FC = () => {
    const { user, startTrip, endTrip, transitAlerts } = useData();
    
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
    const [nfcMode, setNfcMode] = useState<'in' | 'out'>('in');
    const [isProcessingLocation, setIsProcessingLocation] = useState(false);
    const [detectedProvider, setDetectedProvider] = useState<Provider | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const handleCardTap = () => {
        if (isProcessingLocation) return;
        
        const mode = currentTrip ? 'out' : 'in';
        setNfcMode(mode);

        if (mode === 'in') {
            const randomProvider = availableProviders[Math.floor(Math.random() * availableProviders.length)];
            setDetectedProvider(randomProvider);
        }

        setIsNfcModalOpen(true);
    };

    const handleScanSuccess = useCallback(async () => {
        setIsProcessingLocation(true);
        if (nfcMode === 'out' && currentTrip) {
            setStatusMessage('Finding your destination...');
            try {
                const locationName = await getCurrentLocationName();
                endTrip(currentTrip, locationName);
                setStatusMessage(`Trip with ${currentTrip.provider} complete! Fare deducted.`);
                setCurrentTrip(null);
                setTimeout(() => setStatusMessage(''), 5000);
            } catch (error) {
                console.error("Failed to get end location:", error);
                setStatusMessage('Could not get location. Please try again.');
            }
        } else if (nfcMode === 'in' && detectedProvider) {
            setStatusMessage('Getting your location...');
            try {
                const locationName = await getCurrentLocationName();
                // For the demo, let's set a realistic destination for the live journey feature
                const destination = "Soweto Theatre";
                const newTrip = startTrip(detectedProvider, locationName);
                newTrip.to = destination; // Manually set destination
                setCurrentTrip(newTrip);
                setStatusMessage(`Trip started with ${newTrip.provider} from ${locationName}.`);
            } catch (error) {
                console.error("Failed to get start location:", error);
                setStatusMessage('Could not get location. Please try again.');
            }
        }
        setIsProcessingLocation(false);
        setDetectedProvider(null);
    }, [nfcMode, currentTrip, startTrip, endTrip, detectedProvider]);

    return (
        <div className="p-4 space-y-6 relative pb-24">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Welcome, {user.fullName.split(' ')[0]}!</h1>
                    <p className="text-rea-gray-light">Ready for your next journey?</p>
                </div>
                <div className="bg-rea-gray-dark p-2 rounded-lg flex items-center space-x-2">
                    <Icon name="star" className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold">{user.loyaltyPoints}</span>
                </div>
            </header>
            
            <VirtualCard
                isFlipped={!!currentTrip}
                onTap={isProcessingLocation ? () => {} : handleCardTap}
                interactiveHover={!isProcessingLocation && !currentTrip}
                showTapPrompt={!currentTrip && !isProcessingLocation}
            />

            {currentTrip ? (
                <LiveJourneyCard trip={currentTrip} />
            ) : (
                <div className="bg-rea-gray-dark p-4 rounded-lg space-y-3 min-h-[10rem] flex flex-col justify-center items-center text-center">
                    <h2 className="text-xl font-bold">Trip Status</h2>
                    <p className="text-rea-gray-light px-4">
                        {isProcessingLocation ? statusMessage : statusMessage || "No active trip. Tap your card to start a journey."}
                    </p>
                </div>
            )}

            <section className="space-y-4">
                <h2 className="text-xl font-bold">Live Transit Feed</h2>
                <div className="space-y-3">
                    {transitAlerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
                </div>
            </section>
            
            {isNfcModalOpen && (
                <NfcScanModal 
                    onClose={() => setIsNfcModalOpen(false)}
                    onScanSuccess={handleScanSuccess}
                    mode={nfcMode}
                    provider={nfcMode === 'in' ? detectedProvider : currentTrip?.provider}
                />
            )}

            <button
                onClick={() => setIsReportModalOpen(true)}
                className="fixed bottom-24 right-4 bg-rea-red text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform z-40"
                aria-label="Report an issue"
            >
                <Icon name="plus" className="w-8 h-8" />
            </button>
            
            {isReportModalOpen && (
                <ReportIssueModal onClose={() => setIsReportModalOpen(false)} />
            )}
        </div>
    );
};

export default HomePage;