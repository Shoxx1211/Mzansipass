import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";

import { Layout } from "./components/Layout";
import { AuthView } from "./components/Auth";
import { VirtualCard } from "./components/VirtualCard";

import { TripState, TransitNetwork } from "./types";
import type { TripData, Severity, Location, TabType } from "./types";

import { TRANSIT_NETWORKS, ROUTE_REGISTRY } from "./constants";
import { FareEngine } from "./services/fareService";

// ===============================
// STORAGE (SAFE + VERSIONED)
// ===============================
const STORAGE_VERSION = "v1";

const Persistence = {
  key: (userEmail: string, key: string) =>
    `mzansi_${STORAGE_VERSION}_${key}_${userEmail}`,

  save: (userEmail: string, key: string, data: unknown) => {
    try {
      localStorage.setItem(
        Persistence.key(userEmail, key),
        JSON.stringify(data)
      );
    } catch {
      console.warn("⚠️ Storage save failed");
    }
  },

  load: (userEmail: string, key: string) => {
    try {
      const raw = localStorage.getItem(
        Persistence.key(userEmail, key)
      );
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
};

// ===============================
// HELPERS
// ===============================
const getSeverityColor = (s: Severity) => {
  if (s === "Operational") return "bg-emerald-500/10 text-emerald-400";
  if (s === "Moderate") return "bg-amber-500/10 text-amber-400";
  return "bg-red-500/10 text-red-400";
};

// 🔥 production-safe haversine
const calculateDistance = (a: Location, b: Location) => {
  const R = 6371;

  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);

  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 *
      Math.cos(lat1) *
      Math.cos(lat2);

  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

// ===============================
// MAIN APP
// ===============================
const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [network, setNetwork] = useState<TransitNetwork>("Taxi");

  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({
    distance: 0
  });

  const [history, setHistory] = useState<TripData[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [pulseReports, setPulseReports] = useState<any[]>([]);

  const [locationEnabled, setLocationEnabled] = useState(true);
  const [lastLocation, setLastLocation] = useState<Location | null>(null);

  const [awaitingTransportConfirm, setAwaitingTransportConfirm] =
    useState(false);

  const [duration, setDuration] = useState(0);

  const lastPromptRef = useRef(0);

  // ===============================
  // LOAD USER DATA
  // ===============================
  useEffect(() => {
    if (!user) return;

    const saved = Persistence.load(user.email, "history");
    if (saved) setHistory(saved);
  }, [user]);

  // ===============================
  // TRIP TIMER (REAL)
  // ===============================
  useEffect(() => {
    if (tripState !== TripState.ACTIVE) return;

    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [tripState]);

  // ===============================
  // GPS TRACKING (SMART + SAFE)
  // ===============================
  useEffect(() => {
    if (!locationEnabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp
        };

        if (lastLocation) {
          const dist = calculateDistance(lastLocation, loc);

          // 🚫 ignore GPS spikes
          if (dist > 2) return;

          const now = Date.now();

          // 🚨 SMART DETECTION (debounced)
          if (
            dist > 0.08 &&
            tripState === TripState.IDLE &&
            !awaitingTransportConfirm &&
            now - lastPromptRef.current > 15000
          ) {
            setAwaitingTransportConfirm(true);
            lastPromptRef.current = now;
          }

          // 📏 ACTIVE TRIP TRACKING
          if (tripState === TripState.ACTIVE) {
            setCurrentTrip((p) => ({
              ...p,
              distance: (p.distance || 0) + dist
            }));
          }
        }

        setLastLocation(loc);
      },
      (err) => console.warn("GPS error:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    lastLocation,
    tripState,
    locationEnabled,
    awaitingTransportConfirm
  ]);

  // ===============================
  // START TRIP
  // ===============================
  const handleStart = useCallback(() => {
    if (!lastLocation) return;

    setTripState(TripState.ACTIVE);
    setDuration(0);

    setCurrentTrip({
      id: Date.now().toString(),
      network,
      startTime: Date.now(),
      distance: 0,
      startLocation: lastLocation
    });

    setAwaitingTransportConfirm(false);
  }, [network, lastLocation]);

  // ===============================
  // END TRIP
  // ===============================
  const handleEnd = useCallback(async () => {
    if (!currentTrip.distance) return;

    const fare = await FareEngine.computeFinalFare({
      network,
      distance: currentTrip.distance
    });

    const finalTrip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      fare: fare.fare,
      endLocation: lastLocation || undefined
    };

    setTripState(TripState.IDLE);
    setDuration(0);

    setHistory((prev) => {
      const updated = [finalTrip, ...prev];
      Persistence.save(user.email, "history", updated);
      return updated;
    });
  }, [currentTrip, network, lastLocation, user]);

  // ===============================
  // STATS
  // ===============================
  const stats = useMemo(() => {
    if (!history.length) return null;

    const totalSpend = history.reduce((a, b) => a + b.fare, 0);
    const totalDistance = history.reduce(
      (a, b) => a + (b.distance || 0),
      0
    );

    return {
      totalTrips: history.length,
      totalSpend,
      avgCostPerKm: totalSpend / (totalDistance || 1)
    };
  }, [history]);

  // ===============================
  // AUTH
  // ===============================
  if (!user) return <AuthView onLogin={setUser} />;

  return (
    <Layout activeTab={activeTab} onNavClick={setActiveTab}>
      <div className="space-y-6 px-4 pb-24 max-w-md mx-auto">

        {/* HOME */}
        {activeTab === "home" && (
          <>
            <VirtualCard
              state={tripState}
              network={network}
              distance={currentTrip.distance || 0}
              duration={duration}
              lastTrip={history[0]}
            />

            {/* SMART PROMPT */}
            {awaitingTransportConfirm &&
              tripState === TripState.IDLE && (
                <div className="glass p-5 rounded-3xl border border-blue-500/30 space-y-4">
                  <p className="text-sm font-bold">
                    Movement detected 🚦
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {TRANSIT_NETWORKS.map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setNetwork(n);
                          handleStart();
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                      >
                        {n}
                      </button>
                    ))}

                    <button
                      onClick={() =>
                        setAwaitingTransportConfirm(false)
                      }
                      className="px-3 py-2 rounded-xl bg-white/10 text-white/60 text-xs"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              )}

            {/* CTA */}
            <button
              onClick={
                tripState === TripState.ACTIVE
                  ? handleEnd
                  : handleStart
              }
              className="btn-primary w-full h-16"
            >
              {tripState === TripState.ACTIVE
                ? "END TRIP"
                : "START TRIP"}
            </button>
          </>
        )}

        {/* PULSE */}
        {activeTab === "pulse" && (
          <div className="text-white/40 text-sm">
            Pulse module active
          </div>
        )}

        {/* STATS */}
        {activeTab === "stats" && stats && (
          <div className="space-y-4">
            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">
                Total Trips
              </p>
              <h2 className="text-3xl font-black">
                {stats.totalTrips}
              </h2>
            </div>

            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">
                Total Spend
              </p>
              <h2 className="text-3xl font-black">
                R{stats.totalSpend.toFixed(2)}
              </h2>
            </div>

            <div className="glass p-6 rounded-3xl">
              <p className="text-xs text-white/40">
                Cost per km
              </p>
              <h2 className="text-3xl font-black">
                R{stats.avgCostPerKm.toFixed(2)}
              </h2>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            <div className="glass p-5 rounded-2xl flex justify-between items-center">
              <span className="text-sm">
                Location Tracking
              </span>

              <button
                onClick={() =>
                  setLocationEnabled((p) => !p)
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  locationEnabled
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {locationEnabled ? "ON" : "OFF"}
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
      </div>
    </Layout>
  );
};

export default App;