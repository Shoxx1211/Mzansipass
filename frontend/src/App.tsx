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

import {
  BackgroundTracker
} from "./services/backgroundTracker";

// ======================================================
// STORAGE
// ======================================================
const Storage = {
  save: (
    user: string,
    key: string,
    data: unknown
  ) => {
    localStorage.setItem(
      `pulse_${key}_${user}`,
      JSON.stringify(data)
    );
  },

  load: (user: string, key: string) => {
    const raw = localStorage.getItem(
      `pulse_${key}_${user}`
    );

    return raw ? JSON.parse(raw) : null;
  }
};

// ======================================================
// SESSION
// ======================================================
const Session = {
  save: (key: string, data: unknown) => {
    localStorage.setItem(
      `pulse_session_${key}`,
      JSON.stringify(data)
    );
  },

  load: (key: string) => {
    const raw = localStorage.getItem(
      `pulse_session_${key}`
    );

    return raw ? JSON.parse(raw) : null;
  },

  clear: (key: string) => {
    localStorage.removeItem(
      `pulse_session_${key}`
    );
  }
};

// ======================================================
// APP
// ======================================================
const App = () => {

  // ======================================================
  // AUTH
  // ======================================================
  const [user, setUser] =
    useState<any>(null);

  // ======================================================
  // UI
  // ======================================================
  const [activeTab, setActiveTab] =
    useState<TabType>("home");

  // ======================================================
  // TRIP
  // ======================================================
  const [tripState, setTripState] =
    useState<TripState>(
      TripState.IDLE
    );

  const [network, setNetwork] =
    useState<TransitNetwork | null>(
      null
    );

  const [destination, setDestination] =
    useState("");

  const [estimatedFare, setEstimatedFare] =
    useState<number | null>(null);

  const [plannedDistance, setPlannedDistance] =
    useState(0);

  const [currentTrip, setCurrentTrip] =
    useState<Partial<TripData>>({});

  const [duration, setDuration] =
    useState(0);

  const [history, setHistory] =
    useState<TripData[]>([]);

  // ======================================================
  // GPS
  // ======================================================
  const [lastLocation, setLastLocation] =
    useState<Location | null>(null);

  const [locationReady, setLocationReady] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const tripStartRef =
    useRef<number | null>(null);

  // ======================================================
  // VERIFY
  // ======================================================
  const [verifyTrip, setVerifyTrip] =
    useState<TripData | null>(null);

  const [actualFare, setActualFare] =
    useState("");

  // ======================================================
  // STATUS
  // ======================================================
  const [isPlanning, setIsPlanning] =
    useState(false);

  // ======================================================
  // LOAD USER
  // ======================================================
  useEffect(() => {

    const savedUser =
      Session.load("user");

    if (savedUser) {
      setUser(savedUser);
    }

  }, []);

  // ======================================================
  // RESTORE SESSION
  // ======================================================
  useEffect(() => {

    if (!user) return;

    Session.save("user", user);

    const savedHistory =
      Storage.load(
        user.email,
        "history"
      );

    if (savedHistory) {
      setHistory(savedHistory);
    }

  }, [user]);

  // ======================================================
  // FOREGROUND GPS
  // ======================================================
  useEffect(() => {

    const watchId =
      watchLocation(

        (loc, meta) => {

          setLocationReady(true);

          setError(null);

          setLastLocation(loc);

          // ======================================================
          // LIVE ACTIVE TRIP TRACKING
          // ======================================================
          if (
            tripState ===
            TripState.ACTIVE
          ) {

            setCurrentTrip((prev) => {

              // ============================================
              // FIRST POINT
              // ============================================
              if (
                !prev.lastTrackedLocation
              ) {

                return {
                  ...prev,
                  lastTrackedLocation:
                    loc,
                  distance: 0,
                  avgSpeed:
                    meta.speed || 0
                };

              }

              const previous =
                prev.lastTrackedLocation;

              // ============================================
              // DISTANCE
              // ============================================
              const distance =
                calculateDistance(
                  previous,
                  loc
                );

              // ============================================
              // FILTER BAD GPS JUMPS
              // ============================================
              if (
                !Number.isFinite(
                  distance
                ) ||
                distance < 0 ||
                distance > 2
              ) {

                return {
                  ...prev,
                  lastTrackedLocation:
                    loc
                };

              }

              // ============================================
              // TOTAL DISTANCE
              // ============================================
              const totalDistance =
                (
                  prev.distance || 0
                ) + distance;

              // ============================================
              // SPEED
              // ============================================
              let speed =
                meta.speed || 0;

              if (
                speed <= 0 &&
                previous.timestamp &&
                loc.timestamp
              ) {

                const hours =
                  (
                    loc.timestamp -
                    previous.timestamp
                  ) / 3600000;

                if (hours > 0) {

                  speed =
                    distance / hours;

                }

              }

              // ============================================
              // FILTER BAD SPEEDS
              // ============================================
              if (
                !Number.isFinite(
                  speed
                ) ||
                speed < 0 ||
                speed > 180
              ) {

                speed =
                  prev.avgSpeed || 0;

              }

              console.log(
                "📍 TRACKING",
                {
                  added:
                    distance.toFixed(3),
                  total:
                    totalDistance.toFixed(3),
                  speed:
                    speed.toFixed(1)
                }
              );

              return {

                ...prev,

                distance:
                  totalDistance,

                avgSpeed:
                  speed,

                lastTrackedLocation:
                  loc

              };

            });

          }

        },

        (err) => {

          setError(err);

          setLocationReady(false);

        }

      );

    return () => {
      clearLocationWatch(
        watchId
      );
    };

  }, [tripState]);

  // ======================================================
  // TIMER
  // ======================================================
  useEffect(() => {

    if (
      tripState !==
      TripState.ACTIVE
    ) {
      return;
    }

    const interval =
      setInterval(() => {

        if (
          !tripStartRef.current
        ) {
          return;
        }

        const elapsed =
          Math.floor(
            (
              Date.now() -
              tripStartRef.current
            ) / 1000
          );

        setDuration(elapsed);

      }, 1000);

    return () =>
      clearInterval(interval);

  }, [tripState]);

  // ======================================================
  // SAVE ACTIVE SESSION
  // ======================================================
  useEffect(() => {

    if (
      tripState ===
      TripState.ACTIVE
    ) {

      Session.save(
        "active_trip",
        {
          currentTrip,
          tripState,
          network,
          duration
        }
      );

    }

  }, [
    currentTrip,
    tripState,
    network,
    duration
  ]);

  // ======================================================
  // PLAN TRIP
  // ======================================================
  const planTrip = async (
    selectedNetwork: TransitNetwork
  ) => {

    if (isPlanning) return;

    if (!lastLocation) {

      setError(
        "Waiting for GPS..."
      );

      return;
    }

    if (
      !destination.trim()
    ) {

      setError(
        "Please enter a destination"
      );

      return;
    }

    setError(null);

    setIsPlanning(true);

    try {

      // ============================================
      // DESTINATION ENGINE
      // ============================================
      const result =
        await DestinationEngine.plan({
          origin:
            lastLocation,

          destination:
            destination.trim()
        });

      const distance =
        Number(
          result.distance.toFixed(
            2
          )
        );

      // ============================================
      // FARE ENGINE
      // ============================================
      const fareResult =
        await FareEngine.computeFinalFare(
          {
            network:
              selectedNetwork,

            distance
          }
        );

      // ============================================
      // APPLY
      // ============================================
      setNetwork(
        selectedNetwork
      );

      setPlannedDistance(
        distance
      );

      setEstimatedFare(
        fareResult.fare
      );

      console.log(
        "✅ FARE CALCULATED",
        {
          network:
            selectedNetwork,
          distance,
          fare:
            fareResult.fare
        }
      );

    } catch (err) {

      console.error(err);

      setError(
        "Failed to calculate route"
      );

    } finally {

      setIsPlanning(false);

    }

  };

  // ======================================================
  // START TRIP
  // ======================================================
  const startTrip = async () => {

    if (
      !network ||
      !lastLocation
    ) {
      return;
    }

    tripStartRef.current =
      Date.now();

    setDuration(0);

    setTripState(
      TripState.ACTIVE
    );

    await BackgroundTracker.start();

    setCurrentTrip({

      id:
        Date.now().toString(),

      network,

      startTime:
        Date.now(),

      distance: 0,

      avgSpeed: 0,

      startLocation:
        lastLocation,

      lastTrackedLocation:
        lastLocation

    });

  };

  // ======================================================
  // END TRIP
  // ======================================================
  const endTrip = async () => {

    if (
      !network ||
      !currentTrip.startTime
    ) {
      return;
    }

    await BackgroundTracker.stop();

    const distance =
      currentTrip.distance || 0;

    const fareResult =
      await FareEngine.computeFinalFare(
        {
          network,
          distance
        }
      );

    const trip: TripData = {

      ...(currentTrip as TripData),

      endTime:
        Date.now(),

      duration,

      distance,

      fare:
        fareResult.fare,

      avgSpeed:
        currentTrip.avgSpeed || 0

    };

    setVerifyTrip(trip);

    // ============================================
    // RESET UI
    // ============================================
    setTripState(
      TripState.IDLE
    );

    setDuration(0);

    setNetwork(null);

    setEstimatedFare(null);

    setPlannedDistance(0);

    setDestination("");

    tripStartRef.current =
      null;

    Session.clear(
      "active_trip"
    );

  };

  // ======================================================
  // CONFIRM TRIP
  // ======================================================
  const confirmTrip = () => {

    if (!verifyTrip) return;

    const finalFare =
      actualFare.trim()
        ? parseFloat(
            actualFare
          )
        : verifyTrip.fare;

    const finalTrip: TripData = {

      ...verifyTrip,

      fare: finalFare

    };

    setHistory((prev) => {

      const updated = [
        finalTrip,
        ...prev
      ];

      Storage.save(
        user.email,
        "history",
        updated
      );

      return updated;

    });

    // ============================================
    // FULL RESET
    // ============================================
    setVerifyTrip(null);

    setActualFare("");

    setCurrentTrip({});

    setDestination("");

    setEstimatedFare(null);

    setPlannedDistance(0);

    setNetwork(null);

  };

  // ======================================================
  // AUTH SCREEN
  // ======================================================
  if (!user) {

    return (
      <AuthView
        onLogin={setUser}
      />
    );

  }

  // ======================================================
  // UI
  // ======================================================
  return (

    <Layout
      activeTab={activeTab}
      onNavClick={setActiveTab}
    >

      <div className="space-y-6 px-4 pb-28">

        {/* HOME */}
        {activeTab === "home" && (
          <>

            <VirtualCard
              state={tripState}
              network={network}

              distance={
                tripState ===
                TripState.ACTIVE
                  ? currentTrip.distance || 0
                  : plannedDistance
              }

              duration={duration}

              destination={destination}

              estimatedFare={
                estimatedFare || undefined
              }

              lastTrip={history[0]}
            />

            {/* CONTROL PANEL */}
            <div className="glass p-5 rounded-3xl space-y-4">

              {/* GPS STATUS */}
              <div className="flex items-center justify-between">

                <div className="text-xs">
                  {locationReady
                    ? "🟢 Live GPS Active"
                    : "🔴 Searching GPS"}
                </div>

                <div className="text-[10px] text-white/40">
                  {BackgroundTracker.native
                    ? "Native Tracking"
                    : "Browser Tracking"}
                </div>

              </div>

              {/* DESTINATION */}
              <input
                value={destination}
                onChange={(e) =>
                  setDestination(
                    e.target.value
                  )
                }
                placeholder="Enter destination"
                className="w-full h-12 px-4 bg-white/5 rounded-2xl"
              />

              {/* ERROR */}
              {error && (

                <div className="text-red-400 text-xs">
                  {error}
                </div>

              )}

              {/* NETWORK BUTTONS */}
              <div className="grid grid-cols-2 gap-2">

                {TRANSIT_NETWORKS.map((n) => (

                  <button
                    key={n}
                    onClick={() =>
                      planTrip(n)
                    }
                    disabled={isPlanning}
                    className={`text-xs py-3 rounded-2xl transition-all ${
                      network === n
                        ? "bg-emerald-500"
                        : "bg-blue-600"
                    }`}
                  >
                    {n}
                  </button>

                ))}

              </div>

              {/* ESTIMATED FARE */}
              {estimatedFare !== null && (

                <div className="text-center">

                  <p className="text-xs text-white/40">
                    Estimated Fare
                  </p>

                  <p className="text-3xl font-black">
                    R
                    {estimatedFare.toFixed(
                      2
                    )}
                  </p>

                </div>

              )}

            </div>

            {/* START */}
            {estimatedFare !== null &&
              tripState ===
                TripState.IDLE && (

              <button
                onClick={startTrip}
                className="btn-primary w-full h-14"
              >
                Start Trip
              </button>

            )}

            {/* END */}
            {tripState ===
              TripState.ACTIVE && (

              <button
                onClick={endTrip}
                className="btn-primary w-full h-14 pulse-glow"
              >
                End Trip
              </button>

            )}

            {/* VERIFY */}
            {verifyTrip && (

              <div className="glass p-5 rounded-3xl space-y-3">

                <p className="font-bold">
                  Confirm your fare
                </p>

                <p className="text-2xl font-black">
                  R
                  {verifyTrip.fare.toFixed(
                    2
                  )}
                </p>

                <input
                  placeholder="Actual fare (optional)"
                  value={actualFare}
                  onChange={(e) =>
                    setActualFare(
                      e.target.value
                    )
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

        {/* STATS */}
        {activeTab === "stats" && (

          <div className="space-y-4">

            {history.map((t) => (

              <div
                key={t.id}
                className="glass p-4 rounded-3xl"
              >

                <p className="font-bold">
                  {t.network}
                </p>

                <p className="text-xs text-white/50">
                  {new Date(
                    t.startTime
                  ).toLocaleString()}
                </p>

                <div className="mt-2 text-xs space-y-1">

                  <p>
                    📏{" "}
                    {(t.distance || 0).toFixed(
                      2
                    )} km
                  </p>

                  <p>
                    💰 R
                    {(t.fare || 0).toFixed(
                      2
                    )}
                  </p>

                  <p>
                    ⏱ {t.duration || 0}s
                  </p>

                  <p>
                    ⚡{" "}
                    {(t.avgSpeed || 0).toFixed(
                      1
                    )} km/h
                  </p>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </Layout>

  );

};

export default App;