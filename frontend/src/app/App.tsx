// src/app/App.tsx
// Pulse Transit - Premium Production Build
// Version: 3.0.0 | Enterprise Release
// Integrates: Enhanced services, AI assistant, habit learning, offline support

import { useState, useEffect, useMemo, useCallback } from "react";

import AuthScreen from "../features/auth/AuthScreen";
import { Layout } from "./Layout";

import { GeminiNavigator } from "../features/navigation/GeminiNavigator";
import { DestinationSearch } from "../features/planner/DestinationSearch";
import { TransportRecommendation } from "../features/planner/TransportRecommendations";
import { TripTracker } from "../features/trip/TripTracker";
import { VirtualCard } from "../features/wallet/VirtualCard";

import {
  TripState,
  type TripData,
  type TabType,
  type TransitNetwork,
  type TransportRecommendation as RecommendationType,
} from "../types";

import { TRANSIT_NETWORKS, NETWORK_ZONES } from "../constants";

import { FareEngine } from "../services/fareService";
import { DestinationEngine } from "../services/destinationEngine";
import { RecommendationEngine } from "../services/recommendationEngine";
import { HabitEngine } from "../services/habitEngine";

import { useGeminiNavigation } from "../hooks/useGeminiNavigation";
import { useLocation } from "../hooks/useLocation";

import { BackgroundTracker } from "../services/backgroundTracker";
import { detectCity } from "../services/locationZone";

import Storage from "../utils/storage";
import Session from "../utils/session";

// ======================================================
// APP
// ======================================================

const App = () => {
  // ======================================================
  // AUTH STATE
  // ======================================================

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // ======================================================
  // TRIP PLANNING STATE
  // ======================================================

  const [tripState, setTripState] = useState<TripState>(TripState.IDLE);

  const [network, setNetwork] = useState<TransitNetwork | null>(null);

  const [destination, setDestination] = useState("");

  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);

  const [, setNetworkEstimates] = useState<
    Record<TransitNetwork, number>
  >({} as Record<TransitNetwork, number>);

  const [recommendations, setRecommendations] = useState<
    RecommendationType[]
  >([]);

  const [selectedRecommendation, setSelectedRecommendation] =
    useState<RecommendationType | null>(null);

  const [, setIsLoadingEstimates] = useState(false);

  const [planningStep, setPlanningStep] = useState<
    "destination" | "transport" | "fare"
  >("destination");

  const [, setInputKey] = useState(Date.now());

  // ======================================================
  // ACTIVE TRIP STATE
  // ======================================================

  const [currentTrip, setCurrentTrip] = useState<Partial<TripData>>({});

  const [duration, setDuration] = useState(0);

  const [history, setHistory] = useState<TripData[]>([]);

  const [verifyTrip, setVerifyTrip] = useState<TripData | null>(null);

  const [actualFare, setActualFare] = useState("");

  // ======================================================
  // UI STATE
  // ======================================================

  const [error, setError] = useState<string | null>(null);

  const [, setIsPlanning] = useState(false);

  // ======================================================
  // CUSTOM HOOKS
  // ======================================================

  const gemini = useGeminiNavigation();

  const location = useLocation({
    debug: false,
    batteryOptimized: false,
  });

  // ======================================================
  // MEMOIZED VALUES
  // ======================================================

  const availableNetworks = useMemo<readonly TransitNetwork[]>(() => {
    if (!location.location) {
      return TRANSIT_NETWORKS;
    }

    const city = detectCity(location.location);

    return TRANSIT_NETWORKS.filter((networkName) => {
      const zones = NETWORK_ZONES[networkName];

      return (
        zones.includes(city as never) ||
        zones.includes("Everywhere" as never)
      );
    });
  }, [location.location]);

  // ======================================================
  // HELPER FUNCTIONS
  // ======================================================

  const resetTripPlanner = useCallback(() => {
    setDestination("");
    setEstimatedFare(null);
    setNetwork(null);
    setSelectedRecommendation(null);
    setRecommendations([]);
    setPlanningStep("destination");
    setError(null);
    setIsPlanning(false);
    setInputKey(Date.now());
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

  // ======================================================
  // DESTINATION HANDLERS
  // ======================================================

  const handleDestinationChange = useCallback(
    (value: string) => {
      setDestination(value);

      if (
        error === "Please enter a destination" ||
        error === "Destination must be at least 3 characters"
      ) {
        setError(null);
      }
    },
    [error]
  );

  const handleDestinationSelect = useCallback((dest: string) => {
    setDestination(dest);
    setPlanningStep("transport");
  }, []);

  const handleSearch = useCallback(() => {
    if (!destination || !destination.trim()) {
      setError("Please enter a destination");
      return;
    }

    if (destination.trim().length < 3) {
      setError("Destination must be at least 3 characters");
      return;
    }

    setError(null);
    setPlanningStep("transport");
  }, [destination]);

  // ======================================================
  // RECOMMENDATIONS
  // ======================================================

  useEffect(() => {
    if (!location.location || planningStep !== "transport") {
      return;
    }

    const getRecommendations = () => {
      const recs = RecommendationEngine.getRecommendations(
        location.location!,
        {
          destination,
          userPreferences: {
            preferFastest: false,
            preferCheapest: false,
          },
        }
      );

      setRecommendations(recs);
    };

    getRecommendations();
  }, [location.location, planningStep, destination]);

  const handleSelectRecommendation = useCallback(
    (rec: RecommendationType) => {
      setSelectedRecommendation(rec);

      setNetwork(rec.mode as TransitNetwork);

      setEstimatedFare(rec.estimatedFare);

      setPlanningStep("fare");
    },
    []
  );

  // ======================================================
  // NETWORK ESTIMATES
  // ======================================================

  useEffect(() => {
    let isSubscribed = true;

    const generateEstimates = async () => {
      if (
        !destination.trim() ||
        !location.location ||
        !isSubscribed
      ) {
        return;
      }

      setIsLoadingEstimates(true);

      try {
        const result = await DestinationEngine.plan({
          origin: location.location,
          destination: destination.trim().toLowerCase(),
        });

        const distance = result.distance;

        const estimates: Record<TransitNetwork, number> =
          {} as Record<TransitNetwork, number>;

        await Promise.all(
          availableNetworks.map(async (networkName) => {
            const fareResult = await FareEngine.computeFinalFare({
              network: networkName,
              distance,
            });

            estimates[networkName] = fareResult.fare;
          })
        );

        if (isSubscribed) {
          setNetworkEstimates(estimates);
        }
      } catch (err) {
        console.error("Estimate generation failed:", err);

        if (isSubscribed) {
          setError(
            "Failed to load fare estimates. Please try again."
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoadingEstimates(false);
        }
      }
    };

    const debounceTimer = setTimeout(
      generateEstimates,
      500
    );

    return () => {
      isSubscribed = false;
      clearTimeout(debounceTimer);
    };
  }, [destination, location.location, availableNetworks]);

  // ======================================================
  // START TRIP
  // ======================================================

  const startTrip = useCallback(async () => {
    if (!network || !location.location || !destination) {
      setError("Missing required trip information");
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
      startLocation: location.location,
      lastTrackedLocation: location.location,
    });

    setError(null);
  }, [network, location.location, destination]);

  // ======================================================
  // END TRIP
  // ======================================================

  const endTrip = useCallback(async () => {
    if (!currentTrip.startTime || !network) {
      return;
    }

    const fare = estimatedFare || 0;

    const completedTrip: TripData = {
      ...(currentTrip as TripData),
      endTime: Date.now(),
      duration,
      fare,
      destination,
      network,
    };

    setVerifyTrip(completedTrip);

    setTripState(TripState.COMPLETED);

    await BackgroundTracker.stop();
  }, [
    currentTrip,
    network,
    estimatedFare,
    duration,
    destination,
  ]);

  // ======================================================
  // CONFIRM TRIP
  // ======================================================

  const confirmTrip = useCallback(() => {
    if (!verifyTrip) {
      return;
    }

    let finalFare = verifyTrip.fare;

    if (actualFare.trim()) {
      const parsedFare = parseFloat(actualFare);

      if (
        !isNaN(parsedFare) &&
        parsedFare > 0 &&
        parsedFare <= 1000
      ) {
        finalFare = parsedFare;
      }
    }

    const finalTrip: TripData = {
      ...verifyTrip,
      fare: finalFare,
    };

    setHistory((prev) => {
      const updated = [finalTrip, ...prev];

      if (user?.email) {
        Storage.save(user.email, "history", updated);
      }

      return updated;
    });

    resetAllTripState();
  }, [
    verifyTrip,
    actualFare,
    user,
    resetAllTripState,
  ]);

  // ======================================================
  // DURATION TIMER
  // ======================================================

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (
      tripState === TripState.ACTIVE &&
      currentTrip.startTime
    ) {
      interval = setInterval(() => {
        if (currentTrip.startTime) {
          setDuration(
            Math.floor(
              (Date.now() - currentTrip.startTime) / 1000
            )
          );
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [tripState, currentTrip.startTime]);

  // ======================================================
  // HABIT LEARNING
  // ======================================================

  useEffect(() => {
    if (
      verifyTrip &&
      verifyTrip.network &&
      verifyTrip.startLocation &&
      verifyTrip.endLocation
    ) {
      HabitEngine.learn(
        verifyTrip.network,
        verifyTrip.startLocation,
        verifyTrip.endLocation,
        verifyTrip.fare,
        verifyTrip.duration
      );
    }
  }, [verifyTrip]);

  // ======================================================
  // LOAD USER & HISTORY
  // ======================================================

  useEffect(() => {
    const savedUser = Session.load("user");

    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    Session.save("user", user);

    const savedHistory = Storage.load<TripData[]>(
      user.email,
      "history"
    );

    if (savedHistory) {
      setHistory(savedHistory);
    }
  }, [user]);

  // ======================================================
  // GEMINI NAVIGATION TAB HANDLER
  // ======================================================

  useEffect(() => {
    if (activeTab === "navigate") {
      gemini.openNavigator();
    } else {
      gemini.closeNavigator();
    }
  }, [
    activeTab,
    gemini.openNavigator,
    gemini.closeNavigator,
  ]);

  // ======================================================
  // ACTIVE SESSION MANAGEMENT
  // ======================================================

  useEffect(() => {
    if (
      tripState === TripState.ACTIVE &&
      currentTrip.id
    ) {
      Session.save("active_trip", {
        currentTrip,
        tripState,
        network,
        duration,
        destination,
      });
    }
  }, [
    currentTrip,
    tripState,
    network,
    duration,
    destination,
  ]);

  // ======================================================
  // AUTH SCREEN
  // ======================================================

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <>
      <Layout
        activeTab={activeTab}
        onNavClick={setActiveTab}
      >
        <div className="w-full max-w-7xl mx-auto">
          <div
            className="
              space-y-6
              px-4
              md:px-8
              lg:px-12
              pb-40
              min-h-[100dvh]
              relative
              z-10
            "
            style={{
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
            }}
          >
            {/* ======================================================
                HOME TAB
            ====================================================== */}

            {activeTab === "home" && (
              <>
                {/* HERO SECTION */}

                {tripState !== TripState.ACTIVE &&
                  !verifyTrip && (
                    <div className="pt-4 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-white/40 text-sm">
                            Welcome back
                          </p>

                          <h1 className="text-3xl font-black tracking-tight text-white">
                            Where are you going?
                          </h1>
                        </div>

                        {/* GPS STATUS */}

                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <span>
                            {location.location ? "📍" : "⌖"}
                          </span>

                          <span>
                            {location.location
                              ? "GPS Active"
                              : "Searching GPS"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* ==================================================
                    ACTIVE TRIP UI
                ================================================== */}

                {tripState === TripState.ACTIVE && (
                  <TripTracker
                    network={network}
                    destination={destination}
                    distance={currentTrip.distance || 0}
                    duration={duration}
                    speed={currentTrip.avgSpeed || 0}
                    onEndTrip={endTrip}
                  />
                )}

                {/* ==================================================
                    PLANNING UI
                ================================================== */}

                {tripState !== TripState.ACTIVE &&
                  !verifyTrip && (
                    <>
                      {/* ERROR */}

                      {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                          <p className="text-red-400 text-sm">
                            {error}
                          </p>
                        </div>
                      )}

                      {/* ==================================================
                          STEP 1: DESTINATION
                      ================================================== */}

                      {planningStep === "destination" && (
                        <DestinationSearch
                          destination={destination}
                          setDestination={
                            handleDestinationChange
                          }
                          onSearch={handleSearch}
                          loading={false}
                          enableVoiceSearch={true}
                          showRecentSearches={true}
                          showFavorites={true}
                          userHome={user?.homeArea}
                          userWork={user?.workArea}
                        />
                      )}

                      {/* ==================================================
                          STEP 2: TRANSPORT
                      ================================================== */}

                      {planningStep === "transport" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* LEFT PANEL */}

                          <div className="hidden lg:block lg:col-span-1">
                            <div className="glass rounded-3xl p-6 sticky top-24">
                              <p className="text-white/40 text-sm">
                                Destination
                              </p>

                              <h2 className="text-2xl font-black text-white mt-2">
                                {destination}
                              </h2>

                              <div className="mt-6 space-y-3">
                                <div className="glass p-4 rounded-2xl">
                                  <p className="text-xs text-white/40 uppercase">
                                    Available Routes
                                  </p>

                                  <p className="text-3xl font-black text-cyan-400">
                                    {recommendations.length}
                                  </p>
                                </div>

                                <div className="glass p-4 rounded-2xl">
                                  <p className="text-xs text-white/40 uppercase">
                                    GPS Status
                                  </p>

                                  <p className="text-lg font-bold text-emerald-400">
                                    {location.location
                                      ? "Connected"
                                      : "Searching"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT PANEL */}

                          <div className="lg:col-span-2 max-w-4xl">
                            <button
                              onClick={() =>
                                setPlanningStep(
                                  "destination"
                                )
                              }
                              className="text-sm text-cyan-400 mb-4 inline-block"
                            >
                              ← Back
                            </button>

                            <TransportRecommendation
                              recommendations={
                                recommendations
                              }
                              selected={
                                selectedRecommendation
                              }
                              onSelect={
                                handleSelectRecommendation
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* ==================================================
                          STEP 3: FARE CONFIRMATION
                      ================================================== */}

                      {planningStep === "fare" &&
                        estimatedFare !== null && (
                          <div className="space-y-5 pb-32">
                            <button
                              onClick={() =>
                                setPlanningStep(
                                  "transport"
                                )
                              }
                              className="text-sm text-cyan-400"
                            >
                              ← Back
                            </button>

                            <VirtualCard
                              state={tripState}
                              network={network}
                              destination={destination}
                              distance={0}
                              duration={0}
                              estimatedFare={estimatedFare}
                              variant="compact"
                              showTilt={false}
                            />

                            <div className="sticky bottom-4 z-40 pt-6">
                              <button
                                onClick={startTrip}
                                className="
                                  w-full
                                  h-16
                                  text-lg
                                  font-bold
                                  rounded-3xl
                                  bg-gradient-to-r
                                  from-emerald-500
                                  to-cyan-500
                                  text-white
                                  transition-all
                                  hover:scale-[1.02]
                                  active:scale-[0.98]
                                  shadow-xl
                                  shadow-emerald-500/30
                                  animate-pulse
                                "
                              >
                                🚀 Start Journey Now
                              </button>
                            </div>
                          </div>
                        )}
                    </>
                  )}

                {/* ==================================================
                    VERIFY TRIP UI
                ================================================== */}

                {verifyTrip && (
                  <div className="space-y-5 pb-32">
                    <div className="glass p-5 rounded-3xl space-y-4">
                      <div>
                        <p className="text-sm text-white/50">
                          Trip Complete
                        </p>

                        <p className="text-4xl font-black text-white mt-1">
                          R{verifyTrip.fare.toFixed(2)}
                        </p>

                        {verifyTrip.destination && (
                          <p className="text-xs text-white/40 mt-2">
                            To: {verifyTrip.destination}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-widest text-white/40">
                          Actual Fare Paid (Optional)
                        </p>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={actualFare}
                          onChange={(e) => {
                            const value =
                              e.target.value;

                            if (
                              value === "" ||
                              /^\d*\.?\d*$/.test(value)
                            ) {
                              setActualFare(value);
                            }
                          }}
                          placeholder="Enter actual fare"
                          className="
                            w-full
                            h-14
                            px-4
                            bg-white/10
                            rounded-2xl
                            outline-none
                            border-2
                            border-white/20
                            focus:border-emerald-400
                            transition-all
                            text-white
                            placeholder-white/50
                          "
                        />

                        <p className="text-[10px] text-white/30">
                          Leave empty to use estimated fare
                        </p>
                      </div>

                      <button
                        onClick={confirmTrip}
                        className="
                          w-full
                          h-14
                          rounded-2xl
                          font-bold
                          bg-gradient-to-r
                          from-emerald-500
                          to-cyan-500
                          text-white
                          transition-all
                          hover:scale-[1.02]
                          active:scale-[0.98]
                        "
                      >
                        Confirm Trip
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ======================================================
                STATS TAB
            ====================================================== */}

            {activeTab === "stats" && (
              <div className="space-y-4 pb-8">
                {history.length === 0 ? (
                  <div className="glass p-8 rounded-3xl text-center">
                    <p className="text-white/50 text-lg">
                      No trips yet
                    </p>

                    <p className="text-sm text-white/30 mt-2">
                      Complete your first trip to see stats!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="glass p-4 rounded-3xl bg-gradient-to-r from-cyan-500/10 to-emerald-500/10">
                      <p className="text-xs uppercase tracking-widest text-white/40">
                        Total Spend
                      </p>

                      <p className="text-3xl font-black text-white">
                        R
                        {history
                          .reduce(
                            (sum, t) =>
                              sum + (t.fare || 0),
                            0
                          )
                          .toFixed(2)}
                      </p>

                      <p className="text-xs text-white/30 mt-1">
                        {history.length} trips completed
                      </p>
                    </div>

                    {history.map((t) => (
                      <div
                        key={t.id}
                        className="
                          glass
                          p-4
                          rounded-3xl
                          transition-all
                          hover:scale-[1.02]
                          active:scale-[0.98]
                        "
                      >
                        <p className="font-bold text-lg text-white">
                          {t.network}
                        </p>

                        {t.destination && (
                          <p className="text-xs text-white/40 mt-0.5">
                            📍 {t.destination}
                          </p>
                        )}

                        <p className="text-xs text-white/50 mt-1">
                          {new Date(
                            t.startTime
                          ).toLocaleString()}
                        </p>

                        <div className="mt-3 text-xs space-y-1.5">
                          <p className="flex items-center gap-2 text-white/70">
                            📏 {(t.distance || 0).toFixed(2)} km
                          </p>

                          <p className="flex items-center gap-2 text-white/70">
                            💰 R{(t.fare || 0).toFixed(2)}
                          </p>

                          <p className="flex items-center gap-2 text-white/70">
                            ⏱️ {t.duration || 0}s
                          </p>

                          <p className="flex items-center gap-2 text-white/70">
                            🚗 {(t.avgSpeed || 0).toFixed(1)} km/h
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout>

      {/* ======================================================
          GEMINI NAVIGATOR
      ====================================================== */}

      <GeminiNavigator
        isOpen={gemini.isOpen}
        onClose={gemini.closeNavigator}
        query={gemini.query}
        setQuery={gemini.setQuery}
        response={gemini.response}
        isLoading={gemini.isLoading}
        error={gemini.error}
        onAsk={gemini.askGemini}
        currentLocation={location.location}
        destination={destination}
        onSetDestination={handleDestinationSelect}
      />
    </>
  );
};

export default App;