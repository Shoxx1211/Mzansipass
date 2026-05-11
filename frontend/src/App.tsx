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
  // FARE CACHE
  // ======================================================
  const fareCacheRef =
    useRef<Map<string, number>>(
      new Map()
    );

  const buildCacheKey = (
    network: TransitNetwork,
    destination: string,
    origin: Location
  ) => {

    return `${network}_${destination}_${origin.lat.toFixed(
      3
    )}_${origin.lng.toFixed(3)}`;

  };

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

              // ======================================================
              // FIRST GPS POINT
              // ======================================================
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

              // ======================================================
              // DISTANCE
              // ======================================================
              const distance =
                calculateDistance(
                  previous,
                  loc
                );

              // ======================================================
              // FILTER BAD GPS JUMPS
              // ======================================================
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

              // ======================================================
              // TOTAL DISTANCE
              // ======================================================
              const totalDistance =
                (
                  prev.distance || 0
                ) + distance;

              // ======================================================
              // SPEED
              // ======================================================
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

              // ======================================================
              // FILTER BAD SPEEDS
              // ======================================================
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

      const cleanDestination =
        destination
          .trim()
          .toLowerCase();

      // ======================================================
      // DESTINATION ENGINE
      // ======================================================
      const result =
        await DestinationEngine.plan({
          origin:
            lastLocation,

          destination:
            cleanDestination
        });

      const distance =
        Number(
          result.distance.toFixed(
            2
          )
        );

      // ======================================================
      // CACHE KEY
      // ======================================================
      const cacheKey =
        buildCacheKey(
          selectedNetwork,
          cleanDestination,
          lastLocation
        );

      let fare: number;

      // ======================================================
      // CACHE HIT
      // ======================================================
      if (
        fareCacheRef.current.has(
          cacheKey
        )
      ) {

        fare =
          fareCacheRef.current.get(
            cacheKey
          )!;

        console.log(
          "⚡ Using cached fare"
        );

      } else {

        // ======================================================
        // FARE ENGINE
        // ======================================================
        const fareResult =
          await FareEngine.computeFinalFare(
            {
              network:
                selectedNetwork,

              distance
            }
          );

        fare =
          fareResult.fare;

        fareCacheRef.current.set(
          cacheKey,
          fare
        );

        console.log(
          "💾 Fare cached"
        );

      }

      // ======================================================
      // APPLY
      // ======================================================
      setNetwork(
        selectedNetwork
      );

      setPlannedDistance(
        distance
      );

      setEstimatedFare(
        fare
      );

      console.log(
        "✅ FARE CALCULATED",
        {
          network:
            selectedNetwork,

          distance,

          fare
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

    // ======================================================
    // FARE ENGINE
    // ======================================================
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

    // ======================================================
    // RESET UI
    // ======================================================
    setTripState(
      TripState.IDLE
    );

    setDuration(0);

    setNetwork(null);

    setEstimatedFare(null);

    setPlannedDistance(0);

    setDestination("");

    fareCacheRef.current.clear();

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

    // ======================================================
    // FULL RESET
    // ======================================================
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

    {/* ====================================================== */}
    {/* HERO */}
    {/* ====================================================== */}
    <div className="pt-4 space-y-2">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-white/40 text-sm">
            Welcome back
          </p>

          <h1 className="text-3xl font-black tracking-tight">
            Where are you going?
          </h1>

        </div>

        <div className="flex items-center gap-2 text-xs text-white/50">

          <span>
            {locationReady ? "🟢" : "🔴"}
          </span>

          <span>
            {locationReady
              ? "GPS Active"
              : "Searching GPS"}
          </span>

        </div>

      </div>

    </div>

    {/* ====================================================== */}
    {/* ACTIVE TRIP CARD */}
    {/* ====================================================== */}
    {tripState === TripState.ACTIVE && (

      <div className="glass rounded-3xl p-5 space-y-4 border border-emerald-500/20">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs text-emerald-400">
              LIVE TRIP
            </p>

            <h2 className="text-2xl font-black">
              {network}
            </h2>

          </div>

          <div className="h-3 w-3 rounded-full bg-emerald-400 pulse-glow" />

        </div>

        <div className="grid grid-cols-3 gap-3">

          <div className="bg-white/5 rounded-2xl p-3">

            <p className="text-[10px] text-white/40">
              Distance
            </p>

            <p className="text-lg font-bold">
              {(currentTrip.distance || 0).toFixed(2)} km
            </p>

          </div>

          <div className="bg-white/5 rounded-2xl p-3">

            <p className="text-[10px] text-white/40">
              Duration
            </p>

            <p className="text-lg font-bold">
              {Math.floor(duration / 60)}m
            </p>

          </div>

          <div className="bg-white/5 rounded-2xl p-3">

            <p className="text-[10px] text-white/40">
              Speed
            </p>

            <p className="text-lg font-bold">
              {(currentTrip.avgSpeed || 0).toFixed(1)}
            </p>

          </div>

        </div>

        <button
          onClick={endTrip}
          className="btn-primary w-full h-14 pulse-glow"
        >
          End Trip
        </button>

      </div>

    )}

    {/* ====================================================== */}
    {/* PLANNING UI */}
    {/* ====================================================== */}
    {tripState !== TripState.ACTIVE && (

      <div className="space-y-5">

        {/* SEARCH CARD */}
        <div className="glass rounded-3xl p-5 space-y-5">

          {/* DESTINATION */}
          <div className="space-y-2">

            <p className="text-xs uppercase tracking-widest text-white/40">
              Destination
            </p>

            <input
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value)
              }
              placeholder="Braamfontein, Sandton, Pretoria..."
              className="w-full h-16 px-5 text-lg bg-white/5 rounded-3xl outline-none border border-white/5 focus:border-cyan-400/40 transition-all"
            />

          </div>

          {/* ERROR */}
          {error && (

            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">

              <p className="text-red-400 text-sm">
                {error}
              </p>

            </div>

          )}

          {/* NETWORKS */}
          {destination.trim() && (

            <div className="space-y-3">

              <p className="text-xs uppercase tracking-widest text-white/40">
                Choose Transport
              </p>

              <div className="grid grid-cols-2 gap-3">

                {TRANSIT_NETWORKS.map((n) => (

                  <button
                    key={n}
                    onClick={() =>
                      planTrip(n)
                    }
                    disabled={isPlanning}
                    className={`rounded-2xl p-4 text-left transition-all border ${
                      network === n
                        ? "bg-emerald-500 border-emerald-400"
                        : "bg-white/5 border-white/5 hover:border-cyan-400/20"
                    }`}
                  >

                    <p className="font-bold text-sm">
                      {n}
                    </p>

                    <p className="text-[10px] text-white/50 mt-1">
                      Calculate fare
                    </p>

                  </button>

                ))}

              </div>

            </div>

          )}

        </div>

        {/* ESTIMATED FARE */}
        {estimatedFare !== null && (

          <div className="glass rounded-3xl p-6 text-center space-y-2">

            <p className="text-xs uppercase tracking-widest text-white/40">
              Estimated Fare
            </p>

            <h2 className="text-5xl font-black tracking-tight">

              R{estimatedFare.toFixed(2)}

            </h2>

            <p className="text-sm text-white/40">

              {plannedDistance.toFixed(2)} km trip

            </p>

          </div>

        )}

        {/* START BUTTON */}
        {estimatedFare !== null && (

          <button
            onClick={startTrip}
            className="btn-primary w-full h-16 text-lg font-bold rounded-3xl"
          >
            Start Journey
          </button>

        )}

        {/* LAST TRIP */}
        {history.length > 0 && (

          <VirtualCard
            state={tripState}
            network={history[0]?.network || null}
            distance={history[0]?.distance || 0}
            duration={history[0]?.duration || 0}
            destination={
              history[0]?.destination || ""
            }
            estimatedFare={
              history[0]?.fare || undefined
            }
            lastTrip={history[0]}
          />

        )}

      </div>

    )}

    {/* ====================================================== */}
    {/* VERIFY */}
    {/* ====================================================== */}
    {verifyTrip && (

      <div className="glass p-5 rounded-3xl space-y-4">

        <div>

          <p className="text-sm text-white/50">
            Trip Complete
          </p>

          <p className="text-4xl font-black mt-1">
            R{verifyTrip.fare.toFixed(2)}
          </p>

        </div>

        <input
          placeholder="Actual fare (optional)"
          value={actualFare}
          onChange={(e) =>
            setActualFare(
              e.target.value
            )
          }
          className="w-full p-4 bg-white/5 rounded-2xl outline-none"
        />

        <button
          onClick={confirmTrip}
          className="btn-primary w-full h-14"
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