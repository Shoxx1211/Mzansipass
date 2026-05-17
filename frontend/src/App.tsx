// src/App.tsx - FULLY FIXED with working inputs and better UI

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { Layout } from "./components/Layout";
import { AuthView } from "./components/Auth";

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

import {
  BackgroundTracker
} from "./services/backgroundTracker";

import { NETWORK_ZONES } from "./constants";
import { detectCity } from "./services/locationZone";

// ======================================================
// STORAGE SERVICE
// ======================================================
const Storage = {
  save: (user: string, key: string, data: unknown): void => {
    try {
      localStorage.setItem(`pulse_${key}_${user}`, JSON.stringify(data));
    } catch (error) {
      console.error(`Storage save failed for ${key}:`, error);
    }
  },

  load: <T,>(user: string, key: string): T | null => {
    try {
      const raw = localStorage.getItem(`pulse_${key}_${user}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error(`Storage load failed for ${key}:`, error);
      return null;
    }
  },

  clear: (user: string, key: string): void => {
    try {
      localStorage.removeItem(`pulse_${key}_${user}`);
    } catch (error) {
      console.error(`Storage clear failed for ${key}:`, error);
    }
  }
};

// ======================================================
// SESSION SERVICE
// ======================================================
const Session = {
  save: (key: string, data: unknown): void => {
    try {
      localStorage.setItem(`pulse_session_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error(`Session save failed for ${key}:`, error);
    }
  },

  load: <T,>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(`pulse_session_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error(`Session load failed for ${key}:`, error);
      return null;
    }
  },

  clear: (key: string): void => {
    try {
      localStorage.removeItem(`pulse_session_${key}`);
    } catch (error) {
      console.error(`Session clear failed for ${key}:`, error);
    }
  },

  clearAll: (): void => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('pulse_session_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Session clearAll failed:', error);
    }
  }
};

// ======================================================
// APP
// ======================================================
const App = () => {
  // ======================================================
  // STATE MANAGEMENT
  // ======================================================
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);
  const [network, setNetwork] = useState<TransitNetwork | null>(null);
  const [destination, setDestination] = useState("");
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [networkEstimates, setNetworkEstimates] = useState<Record<TransitNetwork, number>>({} as Record<TransitNetwork, number>);
  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({});
  const [duration, setDuration] = useState(0);
  const [history, setHistory] = useState<TripData[]>([]);
  const [lastLocation, setLastLocation] = useState<Location | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyTrip, setVerifyTrip] = useState<TripData | null>(null);
  const [actualFare, setActualFare] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isLoadingEstimates, setIsLoadingEstimates] = useState(false);
  const [planningStep, setPlanningStep] = useState<"destination" | "transport" | "fare">("destination");
  const [inputKey, setInputKey] = useState(Date.now()); // Force input refresh

  // ======================================================
  // REFS
  // ======================================================
  const fareCacheRef = useRef<Map<string, number>>(new Map());
  const gpsWatchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ======================================================
  // MEMOIZED VALUES
  // ======================================================
  const availableNetworks = useMemo<readonly TransitNetwork[]>(() => {
    if (!lastLocation) return TRANSIT_NETWORKS;

    const city = detectCity(lastLocation);
    return TRANSIT_NETWORKS.filter((network) => {
      const zones = NETWORK_ZONES[network];
      return zones.includes(city as never) || zones.includes("Everywhere" as never);
    });
  }, [lastLocation]);

  // ======================================================
  // HELPER FUNCTIONS
  // ======================================================
  const buildCacheKey = useCallback((network: TransitNetwork, destination: string, origin: Location): string => {
    return `${network}_${destination}_${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}`;
  }, []);

  const resetTripPlanner = useCallback(() => {
    setDestination("");
    setEstimatedFare(null);
    setNetwork(null);
    setPlanningStep("destination");
    setError(null);
    setIsPlanning(false);
    setInputKey(Date.now()); // Force input refresh
  }, []);

  const resetAllTripState = useCallback(() => {
    setVerifyTrip(null);
    setActualFare("");
    setCurrentTrip({});
    setDuration(0);
    setTripState(TripState.IDLE);
    resetTripPlanner();
    Session.clear("active_trip");
  }, [resetTripPlanner]);

  // Focus input when destination step becomes active
  useEffect(() => {
    if (planningStep === "destination" && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [planningStep]);

  // ======================================================
  // DESTINATION PLANNING - FIXED
  // ======================================================
  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("Destination changed to:", value);
    setDestination(value);
    if (error === "Please enter a destination" || error === "Destination must be at least 3 characters") {
      setError(null);
    }
  };

  const continueToTransportOptions = () => {
    console.log("Continue button clicked, destination:", destination);
    
    if (!destination || !destination.trim()) {
      console.log("No destination entered");
      setError("Please enter a destination");
      return;
    }

    if (destination.trim().length < 3) {
      console.log("Destination too short");
      setError("Destination must be at least 3 characters");
      return;
    }

    console.log("Moving to transport step");
    setError(null);
    setPlanningStep("transport");
  };

  // ======================================================
  // HANDLE ACTUAL FARE INPUT - FIXED
  // ======================================================
  const handleActualFareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("Actual fare changed to:", value);
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setActualFare(value);
      if (error === "Please enter a valid fare amount (0-1000)") {
        setError(null);
      }
    }
  };

  // ======================================================
  // TAB CHANGE HANDLER
  // ======================================================
  const handleTabChange = (tab: TabType) => {
    console.log("Tab changed to:", tab);
    setActiveTab(tab);
  };

  // ======================================================
  // LIVE NETWORK ESTIMATES
  // ======================================================
  useEffect(() => {
    let isSubscribed = true;

    const generateEstimates = async () => {
      if (!destination.trim() || !lastLocation || !isSubscribed) {
        return;
      }

      setIsLoadingEstimates(true);

      try {
        const result = await DestinationEngine.plan({
          origin: lastLocation,
          destination: destination.trim().toLowerCase()
        });

        const distance = result.distance;
        const estimates: Record<TransitNetwork, number> = {} as Record<TransitNetwork, number>;

        await Promise.all(
          availableNetworks.map(async (network) => {
            const fareResult = await FareEngine.computeFinalFare({ network, distance });
            estimates[network] = fareResult.fare;
          })
        );

        if (isSubscribed) {
          setNetworkEstimates(estimates);
        }
      } catch (err) {
        console.error("Estimate generation failed:", err);
        if (isSubscribed) {
          setError("Failed to load fare estimates. Please try again.");
        }
      } finally {
        if (isSubscribed) {
          setIsLoadingEstimates(false);
        }
      }
    };

    const debounceTimer = setTimeout(generateEstimates, 500);
    return () => {
      isSubscribed = false;
      clearTimeout(debounceTimer);
    };
  }, [destination, lastLocation, availableNetworks]);

  // ======================================================
  // PLAN TRIP
  // ======================================================
  const planTrip = async (selectedNetwork: TransitNetwork) => {
    console.log("Plan trip called with network:", selectedNetwork);
    
    if (isPlanning) {
      console.log("Already planning, skipping");
      return;
    }
    
    if (!lastLocation) {
      setError("Waiting for GPS...");
      return;
    }
    
    if (!destination.trim()) {
      setError("Please enter a destination");
      return;
    }

    setError(null);
    setIsPlanning(true);

    try {
      const cleanDestination = destination.trim().toLowerCase();

      const result = await DestinationEngine.plan({
        origin: lastLocation,
        destination: cleanDestination
      });

      const distance = Number(result.distance.toFixed(2));
      const cacheKey = buildCacheKey(selectedNetwork, cleanDestination, lastLocation);

      let fare: number;

      if (fareCacheRef.current.has(cacheKey)) {
        fare = fareCacheRef.current.get(cacheKey)!;
        console.log("⚡ Using cached fare");
      } else {
        const fareResult = await FareEngine.computeFinalFare({ network: selectedNetwork, distance });
        fare = fareResult.fare;
        fareCacheRef.current.set(cacheKey, fare);
        console.log("💾 Fare cached");
      }

      setNetwork(selectedNetwork);
      setEstimatedFare(fare);
      setPlanningStep("fare");

      console.log("✅ FARE CALCULATED", { network: selectedNetwork, distance, fare });
    } catch (err) {
      console.error("Plan trip failed:", err);
      setError("Failed to calculate route. Please check your destination and try again.");
    } finally {
      setIsPlanning(false);
    }
  };

  // ======================================================
  // START TRIP
  // ======================================================
  const startTrip = async () => {
    console.log("Start trip called");
    
    if (!network) {
      setError("No transport network selected");
      return;
    }
    
    if (!lastLocation) {
      setError("GPS not ready");
      return;
    }
    
    if (!destination) {
      setError("No destination set");
      return;
    }

    setTripState(TripState.ACTIVE);
    await BackgroundTracker.start();

    setCurrentTrip({
      id: Date.now().toString(),
      network,
      destination,
      startTime: Date.now(),
      distance: 0,
      avgSpeed: 0,
      startLocation: lastLocation,
      lastTrackedLocation: lastLocation
    });

    setError(null);
  };

  // ======================================================
  // END TRIP
  // ======================================================
  const endTrip = async () => {
    console.log("End trip called");
    
    if (!network || !currentTrip.startTime) {
      console.error("Cannot end trip: Missing required data");
      return;
    }

    await BackgroundTracker.stop();

    const distance = currentTrip.distance || 0;
    const fareResult = await FareEngine.computeFinalFare({ network, distance });

    const trip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      duration,
      distance,
      fare: fareResult.fare,
      avgSpeed: currentTrip.avgSpeed || 0,
      destination: currentTrip.destination || destination
    };

    setVerifyTrip(trip);
    setDuration(0);
    Session.clear("active_trip");
  };

  // ======================================================
  // CONFIRM TRIP
  // ======================================================
  const confirmTrip = () => {
    console.log("Confirm trip called");
    
    if (!verifyTrip) return;

    let finalFare = verifyTrip.fare;
    
    if (actualFare.trim()) {
      const parsedFare = parseFloat(actualFare);
      if (!isNaN(parsedFare) && parsedFare > 0 && parsedFare <= 1000) {
        finalFare = parsedFare;
      }
    }

    const finalTrip: TripData = { ...verifyTrip, fare: finalFare };

    setHistory((prev) => {
      const updated = [finalTrip, ...prev];
      Storage.save(user.email, "history", updated);
      return updated;
    });

    resetAllTripState();
    console.log("✅ Trip saved successfully!");
  };

  // ======================================================
  // GPS WATCH
  // ======================================================
  useEffect(() => {
    if (!isMountedRef.current) return;

    const watchId = watchLocation(
      (loc, meta) => {
        if (!isMountedRef.current) return;
        
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

            const previous = prev.lastTrackedLocation;
            const distance = calculateDistance(previous, loc);

            if (!Number.isFinite(distance) || distance < 0 || distance > 2) {
              return { ...prev, lastTrackedLocation: loc };
            }

            const totalDistance = (prev.distance || 0) + distance;
            let speed = meta.speed || 0;

            if (speed <= 0 && previous.timestamp && loc.timestamp) {
              const hours = (loc.timestamp - previous.timestamp) / 3600000;
              if (hours > 0) speed = distance / hours;
            }

            if (!Number.isFinite(speed) || speed < 0 || speed > 180) {
              speed = prev.avgSpeed || 0;
            }

            return {
              ...prev,
              distance: totalDistance,
              avgSpeed: speed,
              lastTrackedLocation: loc
            };
          });
        }
      },
      (err) => {
        if (isMountedRef.current) {
          setError(err);
          setLocationReady(false);
        }
      }
    );

    gpsWatchIdRef.current = watchId;

    return () => {
      if (gpsWatchIdRef.current !== null) {
        clearLocationWatch(gpsWatchIdRef.current);
      }
    };
  }, [tripState]);

  // ======================================================
  // SAVE ACTIVE SESSION
  // ======================================================
  useEffect(() => {
    if (tripState === TripState.ACTIVE && currentTrip.id) {
      Session.save("active_trip", { currentTrip, tripState, network, duration, destination });
    }
  }, [currentTrip, tripState, network, duration, destination]);

  // ======================================================
  // RESTORE ACTIVE SESSION
  // ======================================================
  useEffect(() => {
    const restored = BackgroundTracker.restoreTrip();
    const savedSession = Session.load<{ currentTrip: Partial<TripData>; network: TransitNetwork; destination: string }>("active_trip");

    if (restored) {
      setTripState(TripState.ACTIVE);
      setDuration(Math.floor((Date.now() - restored.startedAt) / 1000));
      
      if (savedSession) {
        setCurrentTrip({
          ...savedSession.currentTrip,
          distance: restored.totalDistance / 1000,
          avgSpeed: restored.averageSpeed
        });
        setNetwork(savedSession.network);
        setDestination(savedSession.destination || "");
      }
    }

    const unsubscribe = BackgroundTracker.subscribeToTrip((trip) => {
      setDuration(Math.floor((Date.now() - trip.startedAt) / 1000));
      setCurrentTrip((prev) => ({
        ...prev,
        distance: trip.totalDistance / 1000,
        avgSpeed: trip.averageSpeed
      }));
    });

    return () => {
      unsubscribe?.();
      isMountedRef.current = false;
    };
  }, []);

  // ======================================================
  // LOAD USER & HISTORY
  // ======================================================
  useEffect(() => {
    const savedUser = Session.load("user");
    if (savedUser) setUser(savedUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    Session.save("user", user);
    const savedHistory = Storage.load<TripData[]>(user.email, "history");
    if (savedHistory) setHistory(savedHistory);
  }, [user]);

  // ======================================================
  // AUTH SCREEN
  // ======================================================
  if (!user) {
    return <AuthView onLogin={setUser} />;
  }

  // ======================================================
  // RENDER - FULLY FIXED
  // ======================================================
  return (
    <Layout activeTab={activeTab} onNavClick={handleTabChange}>
      <div 
        className="space-y-6 px-4 pb-32 overflow-y-auto min-h-screen"
        style={{ 
          WebkitOverflowScrolling: "touch", 
          scrollBehavior: "smooth",
          paddingBottom: "120px" // Extra padding for sticky button
        }}
      >
        {/* HOME TAB */}
        {activeTab === "home" && (
          <>
            {/* HERO SECTION */}
            {tripState !== TripState.ACTIVE && !verifyTrip && (
              <div className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-sm">Welcome back</p>
                    <h1 className="text-3xl font-black tracking-tight text-white">Where are you going?</h1>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span>{locationReady ? "🟢" : "🔴"}</span>
                    <span>{locationReady ? "GPS Active" : "Searching GPS"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVE TRIP UI */}
            {tripState === TripState.ACTIVE && (
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-500/15 via-black/40 to-cyan-500/10 backdrop-blur-2xl p-6 shadow-2xl shadow-emerald-500/10">
                <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
                
                <div className="relative flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80">Journey Active</p>
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tight text-white">{network}</h2>
                      <p className="mt-1 text-sm text-white/45">Destination</p>
                      <p className="text-lg font-semibold text-white/90">{destination}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300">Live Tracking</p>
                  </div>
                </div>

                <div className="relative mt-8">
                  <p className="text-xs uppercase tracking-widest text-white/35">Duration</p>
                  <h1 className="mt-2 text-6xl font-black leading-none tracking-tight text-white">
                    {duration >= 3600
                      ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                      : duration >= 60
                      ? `${Math.floor(duration / 60)}m ${duration % 60}s`
                      : `${duration}s`}
                  </h1>
                </div>

                <div className="relative mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-widest text-white/35">Distance</p>
                    <div className="mt-3 flex items-end gap-1">
                      <h3 className="text-3xl font-black text-white">{(currentTrip.distance || 0).toFixed(2)}</h3>
                      <span className="pb-1 text-sm text-white/45">km</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/5 bg-white/5 p-4 backdrop-blur-xl">
                    <p className="text-[11px] uppercase tracking-widest text-white/35">Avg Speed</p>
                    <div className="mt-3 flex items-end gap-1">
                      <h3 className="text-3xl font-black text-white">{(currentTrip.avgSpeed || 0).toFixed(1)}</h3>
                      <span className="pb-1 text-sm text-white/45">km/h</span>
                    </div>
                  </div>
                </div>

                <button onClick={endTrip} className="relative mt-8 h-16 w-full rounded-3xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-lg font-black tracking-wide text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-500/20">
                  End Journey
                </button>
              </div>
            )}

            {/* PLANNING UI */}
            {tripState !== TripState.ACTIVE && !verifyTrip && (
              <>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* STEP 1: DESTINATION - FIXED INPUT */}
                {planningStep === "destination" && (
                  <div className="space-y-5">
                    <div className="glass rounded-3xl p-5 space-y-5">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-widest text-white/40">Destination</p>
                        <input
                          key={inputKey}
                          ref={inputRef}
                          type="text"
                          value={destination}
                          onChange={handleDestinationChange}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              continueToTransportOptions();
                            }
                          }}
                          placeholder="e.g., Braamfontein, Sandton, Pretoria..."
                          className="w-full h-16 px-5 text-lg bg-white/10 rounded-3xl outline-none border-2 border-white/20 focus:border-cyan-400 focus:bg-white/20 transition-all text-white placeholder-white/50"
                          autoFocus
                          autoComplete="off"
                          autoCapitalize="words"
                        />
                        <button
                          onClick={continueToTransportOptions}
                          className="w-full h-14 rounded-3xl bg-gradient-to-r from-cyan-500 to-emerald-500 font-bold text-white text-lg transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-cyan-500/25"
                        >
                          Continue →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: TRANSPORT */}
                {planningStep === "transport" && (
                  <div className="space-y-5">
                    <button 
                      onClick={() => {
                        setPlanningStep("destination");
                        setError(null);
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }} 
                      className="text-sm text-cyan-400 transition-all hover:opacity-80"
                    >
                      ← Back
                    </button>
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-widest text-white/40">Available Transport</p>
                      <div className="space-y-3">
                        {availableNetworks.map((n) => {
                          const estimate = networkEstimates[n];
                          return (
                            <button
                              key={n}
                              onClick={() => planTrip(n)}
                              disabled={isPlanning || isLoadingEstimates}
                              className={`
                                w-full rounded-3xl p-5 text-left transition-all border-2
                                ${isPlanning || isLoadingEstimates ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98] hover:border-cyan-400/50"}
                                bg-white/5 border-white/10 hover:bg-white/10
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-lg font-bold text-white">{n}</p>
                                  <p className="text-xs text-white/40 mt-1">Smart fare estimate</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-black text-white">
                                    {isLoadingEstimates ? "⏳" : estimate ? `~R${estimate.toFixed(2)}` : "--"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: FARE CONFIRMATION - WITH STICKY BUTTON */}
                {planningStep === "fare" && estimatedFare !== null && (
                  <div className="space-y-5 pb-32">
                    <button onClick={() => setPlanningStep("transport")} className="text-sm text-cyan-400 transition-all hover:opacity-80">
                      ← Back
                    </button>
                    <div className="glass rounded-[2rem] p-7 text-center border border-emerald-500/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 backdrop-blur-2xl space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Estimated Fare</p>
                      <h2 className="text-6xl font-black tracking-tight leading-none text-white">R{estimatedFare.toFixed(2)}</h2>
                      <p className="text-xs text-white/30 mt-2">Includes all applicable taxes and fees</p>
                    </div>
                    
                    {/* STICKY BUTTON - Always visible at bottom */}
                    <div className="fixed bottom-20 left-4 right-4 z-50">
                      <button 
                        onClick={startTrip} 
                        className="w-full h-16 text-lg font-bold rounded-3xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-500/30 animate-pulse"
                      >
                        🚀 Start Journey Now
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VERIFY TRIP UI */}
            {verifyTrip && (
              <div className="space-y-5 pb-32">
                <div className="glass p-5 rounded-3xl space-y-4">
                  <div>
                    <p className="text-sm text-white/50">Trip Complete</p>
                    <p className="text-4xl font-black text-white mt-1">R{verifyTrip.fare.toFixed(2)}</p>
                    {verifyTrip.destination && (
                      <p className="text-xs text-white/40 mt-2">To: {verifyTrip.destination}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-white/40">Actual Fare Paid (Optional)</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={actualFare}
                      onChange={handleActualFareChange}
                      placeholder="Enter actual fare"
                      className="w-full h-14 px-4 bg-white/10 rounded-2xl outline-none border-2 border-white/20 focus:border-emerald-400 transition-all text-white placeholder-white/50"
                    />
                    <p className="text-[10px] text-white/30">Leave empty to use estimated fare</p>
                  </div>
                  <button onClick={confirmTrip} className="w-full h-14 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white transition-all hover:scale-[1.02] active:scale-[0.98]">
                    Confirm Trip
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* STATS TAB */}
        {activeTab === "stats" && (
          <div className="space-y-4 pb-8">
            {history.length === 0 ? (
              <div className="glass p-8 rounded-3xl text-center">
                <p className="text-white/50 text-lg">No trips yet</p>
                <p className="text-sm text-white/30 mt-2">Complete your first trip to see stats!</p>
              </div>
            ) : (
              <>
                <div className="glass p-4 rounded-3xl bg-gradient-to-r from-cyan-500/10 to-emerald-500/10">
                  <p className="text-xs uppercase tracking-widest text-white/40">Total Spend</p>
                  <p className="text-3xl font-black text-white">R{history.reduce((sum, t) => sum + (t.fare || 0), 0).toFixed(2)}</p>
                  <p className="text-xs text-white/30 mt-1">{history.length} trips completed</p>
                </div>
                
                {history.map((t) => (
                  <div key={t.id} className="glass p-4 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <p className="font-bold text-lg text-white">{t.network}</p>
                    {t.destination && <p className="text-xs text-white/40 mt-0.5">📍 {t.destination}</p>}
                    <p className="text-xs text-white/50 mt-1">
                      {new Date(t.startTime).toLocaleString()}
                    </p>
                    <div className="mt-3 text-xs space-y-1.5">
                      <p className="flex items-center gap-2 text-white/70">📏 {(t.distance || 0).toFixed(2)} km</p>
                      <p className="flex items-center gap-2 text-white/70">💰 R{(t.fare || 0).toFixed(2)}</p>
                      <p className="flex items-center gap-2 text-white/70">⏱ {t.duration || 0}s</p>
                      <p className="flex items-center gap-2 text-white/70">⚡ {(t.avgSpeed || 0).toFixed(1)} km/h</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;