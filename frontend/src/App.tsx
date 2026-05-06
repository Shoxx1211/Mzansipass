// src/App.tsx

import { useState, useEffect, useRef } from "react";

import { Layout } from "./components/Layout";
import { AuthView } from "./components/Auth";
import { VirtualCard } from "./components/VirtualCard";

import {
  TripState,
  type TripData,
  type TabType,
  type Location,
  type TransitNetwork
} from "./types";

import { TRANSIT_NETWORKS } from "./constants";

import { FareEngine } from "./services/fareService";
import { DestinationEngine } from "./services/destinationEngine";

import {
  watchLocation,
  clearLocationWatch,
  calculateDistance
} from "./services/location";

import { BackgroundTracker } from "./services/backgroundTracker";

// ================= STORAGE =================
const Storage = {
  save: (user: string, key: string, data: unknown) => {
    localStorage.setItem(`pulse_${key}_${user}`, JSON.stringify(data));
  },
  load: (user: string, key: string) => {
    const raw = localStorage.getItem(`pulse_${key}_${user}`);
    return raw ? JSON.parse(raw) : null;
  }
};

// ================= SESSION =================
const Session = {
  save: (key: string, data: unknown) => {
    localStorage.setItem(`pulse_session_${key}`, JSON.stringify(data));
  },
  load: (key: string) => {
    const raw = localStorage.getItem(`pulse_session_${key}`);
    return raw ? JSON.parse(raw) : null;
  },
  clear: (key: string) => {
    localStorage.removeItem(`pulse_session_${key}`);
  }
};

const App = () => {

  // ================= AUTH =================
  const [user, setUser] = useState<any>(null);

  // ================= UI =================
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // ================= TRIP =================
  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [destination, setDestination] = useState("");
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [plannedDistance, setPlannedDistance] = useState(0);
  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({});
  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<TripData[]>([]);

  // ================= GPS =================
  const [lastLocation, setLastLocation] = useState<Location | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripStartRef = useRef<number | null>(null);

  // ================= 🔥 FARE CACHE =================
  const fareCacheRef = useRef<Map<string, number>>(new Map());

  const buildCacheKey = (
    network: TransitNetwork,
    destination: string,
    origin: Location
  ) => {
    return `${network}_${destination}_${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}`;
  };

  // ================= VERIFY =================
  const [verifyTrip, setVerifyTrip] = useState<TripData | null>(null);
  const [actualFare, setActualFare] = useState("");

  const [isPlanning, setIsPlanning] = useState(false);

  // ================= LOAD USER =================
  useEffect(() => {
    const savedUser = Session.load("user");
    if (savedUser) setUser(savedUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    Session.save("user", user);

    const savedHistory = Storage.load(user.email, "history");
    if (savedHistory) setHistory(savedHistory);

  }, [user]);

  // ================= GPS =================
  useEffect(() => {

    const watchId = watchLocation(
      (loc, meta) => {
        setLocationReady(true);
        setError(null);
        setLastLocation(loc);

        if (tripState === TripState.ACTIVE) {

          setCurrentTrip((prev) => {

            if (!prev.lastTrackedLocation) {
              return {
                ...prev,
                lastTrackedLocation: loc,
                distance: 0,
                avgSpeed: meta.speed || 0
              };
            }

            const prevLoc = prev.lastTrackedLocation;

            const dist = calculateDistance(prevLoc, loc);

            if (!Number.isFinite(dist) || dist < 0 || dist > 2) {
              return { ...prev, lastTrackedLocation: loc };
            }

            const total = (prev.distance || 0) + dist;

            return {
              ...prev,
              distance: total,
              avgSpeed: meta.speed || prev.avgSpeed || 0,
              lastTrackedLocation: loc
            };
          });
        }
      },
      (err) => {
        setError(err);
        setLocationReady(false);
      }
    );

    return () => clearLocationWatch(watchId);

  }, [tripState]);

  // ================= PLAN TRIP =================
  const planTrip = async (selectedNetwork: TransitNetwork) => {

    if (isPlanning) return;
    if (!lastLocation) return setError("Waiting for GPS...");
    if (!destination.trim()) return setError("Enter destination");

    setError(null);
    setIsPlanning(true);

    try {

      const cleanDestination = destination.trim().toLowerCase();

      const route = await DestinationEngine.plan({
        origin: lastLocation,
        destination: cleanDestination
      });

      const distance = Number(route.distance.toFixed(2));

      const cacheKey = buildCacheKey(
        selectedNetwork,
        cleanDestination,
        lastLocation
      );

      let fare: number;

      // 🔥 CACHE HIT
      if (fareCacheRef.current.has(cacheKey)) {
        fare = fareCacheRef.current.get(cacheKey)!;
        console.log("⚡ Using cached fare");
      } else {
        const result = await FareEngine.computeFinalFare({
          network: selectedNetwork,
          distance
        });

        fare = result.fare;

        fareCacheRef.current.set(cacheKey, fare);
        console.log("💾 Fare cached");
      }

      setNetwork(selectedNetwork);
      setPlannedDistance(distance);
      setEstimatedFare(fare);

    } catch (err) {
      console.error(err);
      setError("Planning failed");
    } finally {
      setIsPlanning(false);
    }
  };

  // ================= START =================
  const startTrip = async () => {

    if (!network || !lastLocation) return;

    tripStartRef.current = Date.now();
    setTripState(TripState.ACTIVE);
    setDuration(0);

    await BackgroundTracker.start();

    setCurrentTrip({
      id: Date.now().toString(),
      network,
      startTime: Date.now(),
      distance: 0,
      avgSpeed: 0,
      startLocation: lastLocation,
      lastTrackedLocation: lastLocation
    });
  };

  // ================= END =================
  const endTrip = async () => {

    if (!network || !currentTrip.startTime) return;

    await BackgroundTracker.stop();

    const distance = currentTrip.distance || 0;

    const result = await FareEngine.computeFinalFare({
      network,
      distance
    });

    const trip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      duration,
      distance,
      fare: result.fare,
      avgSpeed: currentTrip.avgSpeed || 0
    };

    setVerifyTrip(trip);

    // 🔥 RESET EVERYTHING CLEAN
    setTripState(TripState.IDLE);
    setDuration(0);
    setNetwork(null);
    setEstimatedFare(null);
    setPlannedDistance(0);
    setDestination("");

    fareCacheRef.current.clear(); // 🔥 IMPORTANT FIX

    tripStartRef.current = null;
    Session.clear("active_trip");
  };

  // ================= CONFIRM =================
  const confirmTrip = () => {

    if (!verifyTrip) return;

    const finalFare = actualFare.trim()
      ? parseFloat(actualFare)
      : verifyTrip.fare;

    const finalTrip = { ...verifyTrip, fare: finalFare };

    setHistory((prev) => {
      const updated = [finalTrip, ...prev];
      Storage.save(user.email, "history", updated);
      return updated;
    });

    setVerifyTrip(null);
    setActualFare("");
    setCurrentTrip({});
  };

  // ================= AUTH =================
  if (!user) return <AuthView onLogin={setUser} />;

  // ================= UI =================
  return (
    <Layout activeTab={activeTab} onNavClick={setActiveTab}>
      <div className="space-y-6 px-4 pb-28">

        {activeTab === "home" && (
          <>

            <VirtualCard
              state={tripState}
              network={network}
              distance={
                tripState === TripState.ACTIVE
                  ? currentTrip.distance || 0
                  : plannedDistance
              }
              duration={duration}
              destination={destination}
              estimatedFare={estimatedFare || undefined}
              lastTrip={history[0]}
            />

            <div className="glass p-5 rounded-3xl space-y-4">

              <div className="text-xs">
                {locationReady ? "🟢 Live GPS" : "🔴 Searching GPS"}
              </div>

              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination"
                className="w-full h-12 px-4 bg-white/5 rounded-2xl"
              />

              {error && <div className="text-red-400 text-xs">{error}</div>}

              <div className="grid grid-cols-2 gap-2">
                {TRANSIT_NETWORKS.map((n) => (
                  <button
                    key={n}
                    onClick={() => planTrip(n)}
                    className={`text-xs py-3 rounded-2xl ${
                      network === n ? "bg-emerald-500" : "bg-blue-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {estimatedFare !== null && (
                <div className="text-center">
                  <p className="text-xs text-white/40">Estimated Fare</p>
                  <p className="text-3xl font-black">
                    R{estimatedFare.toFixed(2)}
                  </p>
                </div>
              )}

            </div>

            {estimatedFare !== null && tripState === TripState.IDLE && (
              <button onClick={startTrip} className="btn-primary w-full h-14">
                Start Trip
              </button>
            )}

            {tripState === TripState.ACTIVE && (
              <button onClick={endTrip} className="btn-primary w-full h-14">
                End Trip
              </button>
            )}

            {verifyTrip && (

  <div className="glass p-5 rounded-3xl space-y-3">

    <p className="font-bold">
      Confirm your fare
    </p>

    <p className="text-2xl font-black">
      R{verifyTrip.fare.toFixed(2)}
    </p>

    <input
      placeholder="Actual fare (optional)"
      value={actualFare}
      onChange={(e) =>
        setActualFare(e.target.value)
      }
      className="w-full p-3 bg-white/5 rounded-2xl"
    />

    <button
      onClick={confirmTrip}
      className="btn-primary w-full h-12"
    >
      Confirm Trip
    </button>

  </div>

)}

          </>
        )}

      </div>
    </Layout>
  );
};

export default App;