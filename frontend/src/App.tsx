import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from './components/Layout';
import { AuthView } from './components/Auth';
import { VirtualCard } from './components/VirtualCard';
import { TripState, TransitNetwork } from './types';

import type {
  TripData,
  Severity
} from './types';

import { TRANSIT_NETWORKS, ROUTE_REGISTRY } from './constants';
import { getCurrentLocation } from './services/location';
import { getDetailedTripAnalysis, getNetworkPulseSummary } from './services/geminiService';
import { FareEngine } from './services/fareService';

// --- DATA SERVICE LAYER ---
const Persistence = {
  save: (userEmail: string, key: string, data: any) =>
    localStorage.setItem(`mzansi_${key}_${userEmail}`, JSON.stringify(data)),
  load: (userEmail: string, key: string) => {
    const raw = localStorage.getItem(`mzansi_${key}_${userEmail}`);
    return raw ? JSON.parse(raw) : null;
  }
};

// --- VIEWS ---
const PulseView = React.memo(({ searchQuery, setSearchQuery }: any) => {
  const [filterNet, setFilterNet] = useState<TransitNetwork | 'All'>('All');

  const routes = useMemo(() => ROUTE_REGISTRY.filter(r => {
    const matchNet = filterNet === 'All' || r.network === filterNet;
    const matchSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchNet && matchSearch;
  }), [filterNet, searchQuery]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300 px-4">
      
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {['All', ...TRANSIT_NETWORKS].map(n => (
          <button
            key={n}
            onClick={() => setFilterNet(n as any)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              filterNet === n
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search route..."
        className="w-full h-14 glass rounded-2xl px-6 text-xs outline-none border-white/10"
      />

      <div className="space-y-3">
        {routes.map(r => (
          <div key={r.id} className="glass rounded-[1.8rem] p-5 border-white/5 flex flex-col gap-3 card-hover">
            <div className="flex justify-between">
              <div className="flex gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${getSeverityColor(r.severity)}`}>
                  {r.code}
                </div>
                <div>
                  <p className="font-bold text-sm">{r.name}</p>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                    {r.type} • {r.status}
                  </p>
                </div>
              </div>
              {r.estResolution && (
                <span className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-white/40 font-bold uppercase">
                  ETA: {r.estResolution}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const getSeverityColor = (s: Severity) => {
  if (s === 'Operational') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'Moderate') return 'bg-amber-500/10 text-amber-400';
  return 'bg-red-500/10 text-red-400';
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('home');

  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [network, setNetwork] = useState<TransitNetwork>('Gautrain');

  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({ distance: 0 });
  const [seconds, setSeconds] = useState(0);
  const [history, setHistory] = useState<TripData[]>([]);

  const [pulseSummary, setPulseSummary] = useState("Status check pending...");
  const [searchQuery, setSearchQuery] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (user) {
      const savedHistory = Persistence.load(user.email, 'history');
      if (savedHistory) setHistory(savedHistory);
    }
  }, [user]);

  useEffect(() => {
    const fetchPulse = async () => {
      const summary = await getNetworkPulseSummary(network, []);
      setPulseSummary(summary);
    };
    fetchPulse();
  }, [network]);

  useEffect(() => {
    let timer: any;
    if (tripState === TripState.ACTIVE) {
      timer = setInterval(() => {
        setSeconds(s => s + 1);
        setCurrentTrip(p => ({ ...p, distance: (p.distance || 0) + 0.015 }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [tripState]);

  const handleStart = useCallback(async () => {
    setTripState(TripState.ACTIVE);
    setSeconds(0);
    const loc = await getCurrentLocation().catch(() => ({ lat: 0, lng: 0 }));
    setCurrentTrip({
      id: Date.now().toString(),
      network,
      startTime: Date.now(),
      distance: 0,
      startLocation: loc
    });
  }, [network]);

  const handleEnd = useCallback(async () => {
    const endLoc = await getCurrentLocation().catch(() => ({ lat: 0, lng: 0 }));
    const fare = await FareEngine.computeFinalFare(network, currentTrip.distance || 0);

    const finalTrip = {
      ...currentTrip,
      endTime: Date.now(),
      endLocation: endLoc,
      fare,
      isAnalyzing: true
    } as TripData;

    setTripState(TripState.COMPLETED);
    setShowSummary(true);
    setCurrentTrip(finalTrip);

    setTimeout(async () => {
      const analysis = await getDetailedTripAnalysis(finalTrip);
      const fullyProcessed = { ...finalTrip, ...analysis, isAnalyzing: false };

      setCurrentTrip(fullyProcessed);

      setHistory(prev => {
        const h = [fullyProcessed, ...prev];
        Persistence.save(user.email, 'history', h);
        return h;
      });
    }, 400);
  }, [currentTrip, network, user]);

  if (!user) return <AuthView onLogin={setUser} />;

  return (
    <Layout activeTab={activeTab} onNavClick={setActiveTab}>
      <div className="w-full max-w-md mx-auto space-y-6 px-4 pb-24">

        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-500">

            {tripState === TripState.IDLE && (
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                {TRANSIT_NETWORKS.map(n => (
                  <button
                    key={n}
                    onClick={() => setNetwork(n)}
                    className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      network === n
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            <VirtualCard
              state={tripState}
              network={network}
              distance={currentTrip.distance || 0}
              duration={seconds}
              lastTrip={history[0]}
            />

            <div
              className="glass rounded-3xl p-5 flex items-center gap-4 cursor-pointer card-hover"
              onClick={() => setActiveTab('pulse')}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">📡</div>
              <p className="text-xs italic text-white/80">"{pulseSummary}"</p>
            </div>

            <div className="mt-8">
              {tripState === TripState.IDLE ? (
                <button onClick={handleStart} className="w-full h-16 btn-primary uppercase tracking-widest">
                  START TRIP
                </button>
              ) : tripState === TripState.ACTIVE ? (
                <button onClick={handleEnd} className="w-full h-16 bg-gradient-to-r from-red-600 to-red-800 rounded-2xl font-black tracking-widest hover:scale-105 active:scale-95 transition-all uppercase">
                  END TRIP
                </button>
              ) : (
                <button onClick={() => setTripState(TripState.IDLE)} className="w-full h-16 glass rounded-2xl font-black tracking-widest uppercase">
                  READY
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pulse' && (
          <PulseView searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        )}

      </div>

      {showSummary && currentTrip && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowSummary(false)} />
          <div className="relative glass rounded-[3rem] p-8 w-full max-w-sm space-y-6 border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black tracking-tighter text-center">Trip Digest</h3>

            <div className="space-y-4">
              <div className="bg-white/5 p-5 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-white/40 uppercase">Cost</span>
                <span className="text-2xl font-black">R{currentTrip.fare?.toFixed(2)}</span>
              </div>

              {currentTrip.isAnalyzing ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 text-xs text-white/80 italic leading-relaxed">
                  "{currentTrip.aiFeedback}"
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSummary(false)}
              className="w-full h-14 btn-primary uppercase tracking-widest"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;