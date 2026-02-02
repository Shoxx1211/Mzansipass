
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import NotificationToast from '../ui/NotificationToast';

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
        <div className={`bg-rea-gray-dark p-4 rounded-lg border-l-4 ${isOfficial ? 'border-rea-red bg-rea-red/5' : 'border-blue-500'}`}>
            <div className="flex items-start space-x-3">
                <Icon name={config.icon} className={`w-6 h-6 flex-shrink-0 mt-1 ${config.color}`} />
                <div className="flex-grow">
                    <div className="flex justify-between items-baseline">
                        <h3 className="font-bold text-white text-sm">{alert.title}</h3>
                        <p className="text-[10px] text-rea-gray-light flex-shrink-0 ml-2 uppercase font-bold">{timeAgo(alert.timestamp)}</p>
                    </div>
                    {alert.provider && <span className="text-[10px] font-black text-admin-accent uppercase tracking-widest">{alert.provider}</span>}
                    <p className="text-xs text-rea-gray-light mt-1 leading-relaxed">{alert.description}</p>
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
            const relevantAlert = transitAlerts.find(a =>
                a.provider === trip.provider &&
                a.category === 'delay' &&
                a.title.toLowerCase().includes('major')
            );

            if (relevantAlert && !assistance && !isLoading) {
                setIsLoading(true);
                getLiveJourneyUpdate(trip, relevantAlert)
                    .then(setAssistance)
                    .catch(console.error)
                    .finally(() => setIsLoading(false));
            }
        }, 10000);

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
    const { user, startTrip, endTrip, transitAlerts, refreshTransitAlerts } = useData();
    
    const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
    const [nfcMode, setNfcMode] = useState<'in' | 'out'>('in');
    const [isProcessingLocation, setIsProcessingLocation] = useState(false);
    const [detectedProvider, setDetectedProvider] = useState<Provider | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
    
    const [activeToast, setActiveToast] = useState<TransitAlert | null>(null);
    const lastAlertCount = useRef(transitAlerts.length);

    // Notification Listener
    useEffect(() => {
        if (transitAlerts.length > lastAlertCount.current) {
            const latest = transitAlerts[0];
            // Only "push" official alerts to avoid spamming user reports as toasts
            if (latest.type === 'official') {
                setActiveToast(latest);
            }
        }
        lastAlertCount.current = transitAlerts.length;
    }, [transitAlerts]);

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
                const destination = "Soweto Theatre";
                const newTrip = startTrip(detectedProvider, locationName);
                newTrip.to = destination;
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

    const handleRefreshFeed = useCallback(() => {
        setIsRefreshingFeed(true);
        setTimeout(() => {
            refreshTransitAlerts();
            setIsRefreshingFeed(false);
        }, 800);
    }, [refreshTransitAlerts]);

    return (
        <div className="p-4 space-y-6 relative pb-24">
            {activeToast && (
                <NotificationToast 
                    alert={activeToast} 
                    onClose={() => setActiveToast(null)} 
                />
            )}

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
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Live Transit Feed</h2>
                    <button onClick={handleRefreshFeed} disabled={isRefreshingFeed} className="p-2 text-rea-gray-light hover:text-white rounded-full disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${isRefreshingFeed ? 'animate-spin' : ''}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001a7.5 7.5 0 0 1-1.08 3.904l-4.062-4.062a.75.75 0 0 0-1.06 0l-1.06 1.06a.75.75 0 0 0 0 1.06l4.062 4.062a7.5 7.5 0 0 1-3.904 1.08h.001v4.992a7.5 7.5 0 0 1-11.89-6.304 7.5 7.5 0 0 1 6.304-11.89 7.5 7.5 0 0 1 11.89 6.304Z" />
                        </svg>
                    </button>
                </div>
                <div className="space-y-3">
                    {transitAlerts.map(alert => <div key={alert.id} className="animate-fade-in-up"><AlertCard alert={alert} /></div>)}
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
