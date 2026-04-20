import { useState, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { AuthView } from './components/Auth';
import { VirtualCard } from './components/VirtualCard';

import {
  TripState,
  TransitNetwork,
  type TripData,
  type TabType
} from './types';

import { TRANSIT_NETWORKS, ROUTE_REGISTRY } from './constants';
import { FareEngine } from './services/fareService';

// ---------------- STORAGE ----------------
const Persistence = {
  save: (userEmail: string, key: string, data: unknown) => {
    try {
      localStorage.setItem(
        `mzansi_${key}_${userEmail}`,
        JSON.stringify(data)
      );
    } catch {}
  },

  load: (userEmail: string, key: string) => {
    try {
      const raw = localStorage.getItem(`mzansi_${key}_${userEmail}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
};

// ---------------- DISTANCE ----------------
const calculateDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;

  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);

  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

// ---------------- PULSE ----------------
const PulseView = ({
  searchQuery,
  setSearchQuery,
  pulseReports,
  setPulseReports
}: any) => {
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [reportType, setReportType] = useState('Delayed');

  const routes = useMemo(() => {
    return ROUTE_REGISTRY.filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const submitReport = () => {
    if (!selectedRoute) return;

    const newReport = {
      id: Date.now(),
      routeId: selectedRoute.id,
      type: reportType
    };

    setPulseReports((prev: any) => [newReport, ...prev]);
    setSelectedRoute(null);
  };

  const getLiveStatus = (routeId: string) => {
    const reports = pulseReports.filter((r: any) => r.routeId === routeId);
    return reports.length ? reports[0].type : 'Operational';
  };

  return (
    <div className="space-y-6 pb-24 px-4">
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search route..."
        className="w-full h-14 glass rounded-2xl px-6 text-xs"
      />

      <div className="space-y-3">
        {routes.map((r) => {
          const status = getLiveStatus(r.id);

          return (
            <div
              key={r.id}
              onClick={() => setSelectedRoute(r)}
              className="glass p-5 rounded-2xl flex justify-between cursor-pointer"
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10">
                  {r.code}
                </div>
                <div>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-xs text-white/60">{status}</p>
                </div>
              </div>
              <span className="text-xs text-white/40">Report</span>
            </div>
          );
        })}
      </div>

      {selectedRoute && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedRoute(null)}
          />
          <div className="glass p-6 rounded-3xl z-10 space-y-4 w-full max-w-sm">
            <h3 className="font-black">{selectedRoute.name}</h3>

            <div className="grid grid-cols-2 gap-3">
              {['Smooth', 'Delayed', 'Overcrowded', 'Breakdown'].map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setReportType(type)}
                    className="p-2 rounded-xl bg-white/5"
                  >
                    {type}
                  </button>
                )
              )}
            </div>

            <button
              onClick={submitReport}
              className="btn-primary w-full h-12"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------- APP ----------------
const App = () => {
  const [user, setUser] = useState<any>(null);

  // ✅ FIXED: strict tab typing
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [network, setNetwork] = useState<TransitNetwork | null>(null);

  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({
    distance: 0
  });

  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<TripData[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [pulseReports, setPulseReports] = useState<any[]>([]);

  const [locationEnabled, setLocationEnabled] = useState(true);
  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [awaitingTransportConfirm, setAwaitingTransportConfirm] =
    useState(false);

  const [lastPromptTime, setLastPromptTime] = useState(0);

  // ---------------- LOAD ----------------
  useEffect(() => {
    if (user) {
      const saved = Persistence.load(user.email, 'history');
      if (saved) setHistory(saved);
    }
  }, [user]);

  // ---------------- TIMER ----------------
  useEffect(() => {
    let interval: any;

    if (tripState === TripState.ACTIVE) {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [tripState]);

  // ---------------- GPS ----------------
  useEffect(() => {
    if (!locationEnabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        if (lastLocation) {
          const dist = calculateDistance(lastLocation, loc);
          const now = Date.now();

          if (
            dist > 0.05 &&
            tripState === TripState.IDLE &&
            !awaitingTransportConfirm &&
            now - lastPromptTime > 10000
          ) {
            setAwaitingTransportConfirm(true);
            setLastPromptTime(now);
            navigator.vibrate?.([200, 100, 200]);
          }

          if (tripState === TripState.ACTIVE) {
            setCurrentTrip((prev) => ({
              ...prev,
              distance: (prev.distance || 0) + dist
            }));
          }
        }

        setLastLocation(loc);
      },
      (err) => console.warn('GPS error:', err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [lastLocation, tripState, locationEnabled, awaitingTransportConfirm, lastPromptTime]);

  // ---------------- START ----------------
  const handleStart = (selectedNetwork: TransitNetwork) => {
    setNetwork(selectedNetwork);
    setTripState(TripState.ACTIVE);
    setDuration(0);

    setCurrentTrip({
      id: Date.now().toString(),
      network: selectedNetwork,
      startTime: Date.now(),
      distance: 0,
      startLocation: lastLocation || undefined
    });

    setAwaitingTransportConfirm(false);
  };

  // ---------------- END ----------------
  const handleEnd = async () => {
    if (!network) return;

    const fare = await FareEngine.computeFinalFare({
      network,
      distance: currentTrip.distance || 0,
      matchedRoute: currentTrip.matchedRoute
    });

    const finalTrip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      fare,
      endLocation: lastLocation || undefined
    };

    setTripState(TripState.IDLE);
    setDuration(0);

    setHistory((prev) => {
      const updated = [finalTrip, ...prev];
      Persistence.save(user.email, 'history', updated);
      return updated;
    });

    setNetwork(null);
  };

  // ---------------- AUTH ----------------
  if (!user) return <AuthView onLogin={setUser} />;

  return (
    <Layout activeTab={activeTab} onNavClick={setActiveTab}>
      <div className="space-y-6 px-4 pb-24 max-w-md mx-auto">

        {/* HOME */}
        {activeTab === 'home' && (
          <>
            <VirtualCard
              state={tripState}
              network={network}
              distance={currentTrip.distance || 0}
              duration={duration}
              lastTrip={history[0]}
            />

            {awaitingTransportConfirm && tripState === TripState.IDLE && (
              <div className="glass p-5 rounded-3xl border border-blue-500/30 space-y-4">
                <p className="text-sm font-bold">Movement detected 🚦</p>

                <div className="grid grid-cols-2 gap-2">
                  {TRANSIT_NETWORKS.map((n) => (
                    <button
                      key={n}
                      onClick={() => handleStart(n)}
                      className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    onClick={() => setAwaitingTransportConfirm(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 text-white/60 text-xs"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={
                tripState === TripState.ACTIVE
                  ? handleEnd
                  : () => setAwaitingTransportConfirm(true)
              }
              className="btn-primary w-full h-16"
            >
              {tripState === TripState.ACTIVE
                ? 'END TRIP'
                : 'START TRIP'}
            </button>
          </>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="glass p-5 rounded-2xl flex justify-between items-center">
              <span className="text-sm font-medium">Location Tracking</span>

              <button
                onClick={() => setLocationEnabled((p) => !p)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  locationEnabled
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {locationEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div
              onClick={() => setUser(null)}
              className="glass p-5 rounded-2xl text-red-400 text-center cursor-pointer"
            >
              Sign Out
            </div>
          </div>
        )}

        {/* STATS */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">Total Trips</p>
              <h2 className="text-3xl font-black">{history.length}</h2>
            </div>

            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">Total Spend</p>
              <h2 className="text-3xl font-black">
                R{history.reduce((a, b) => a + b.fare, 0).toFixed(2)}
              </h2>
            </div>

            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">Total Distance</p>
              <h2 className="text-3xl font-black">
                {history
                  .reduce((a, b) => a + (b.distance || 0), 0)
                  .toFixed(2)} km
              </h2>
            </div>
          </div>
        )}

        {/* PULSE */}
        {activeTab === 'pulse' && (
          <PulseView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            pulseReports={pulseReports}
            setPulseReports={setPulseReports}
          />
        )}
      </div>
    </Layout>
  );
};

export default App;