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
  BackgroundTracker,
  type TrackerLocation
} from "./services/backgroundTracker";

// ================= STORAGE =================
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

// ================= SESSION =================
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

// ================= APP =================
const App = () => {

  // ================= AUTH =================
  const [user, setUser] =
    useState<any>(null);

  // ================= UI =================
  const [activeTab, setActiveTab] =
    useState<TabType>("home");

  // ================= TRIP =================
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

  // ================= GPS =================
  const [lastLocation, setLastLocation] =
    useState<Location | null>(null);

  const lastLocationRef =
    useRef<Location | null>(null);

  const tripStartRef =
    useRef<number | null>(null);

  // ================= ROUTE CACHE =================
  const lastPlannedRouteRef =
    useRef<{
      destination: string;
      originLat: number;
      originLng: number;
      distance: number;
      network: TransitNetwork;
    } | null>(null);

  // ================= VERIFY =================
  const [verifyTrip, setVerifyTrip] =
    useState<TripData | null>(null);

  const [actualFare, setActualFare] =
    useState("");

  // ================= STATUS =================
  const [isPlanning, setIsPlanning] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [locationReady, setLocationReady] =
    useState(false);

  // ====================================================
  // 🔐 LOAD USER
  // ====================================================
  useEffect(() => {

    const savedUser =
      Session.load("user");

    if (savedUser) {
      setUser(savedUser);
    }

  }, []);

  // ====================================================
  // ♻️ RESTORE SESSION
  // ====================================================
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

    const savedTrip =
      Session.load("active_trip");

    if (savedTrip) {

      setCurrentTrip(
        savedTrip.currentTrip
      );

      setTripState(
        savedTrip.tripState
      );

      setNetwork(
        savedTrip.network
      );

      setDuration(
        savedTrip.duration || 0
      );

      setEstimatedFare(
        savedTrip.estimatedFare
      );

      if (
        savedTrip.tripStartTime
      ) {
        tripStartRef.current =
          savedTrip.tripStartTime;
      }
    }

  }, [user]);

  // ====================================================
  // 📍 FOREGROUND GPS
  // ====================================================
  useEffect(() => {

    let watchId: number;

    watchId = watchLocation(

      (loc) => {

        setLocationReady(true);

        setError(null);

        setLastLocation(loc);

        lastLocationRef.current =
          loc;
      },

      (err) => {

        setError(err);

        setLocationReady(false);

      }
    );

    return () => {

      if (watchId) {
        clearLocationWatch(
          watchId
        );
      }

    };

  }, []);

  // ====================================================
  // 🚀 BACKGROUND TRACKING
  // ====================================================
  useEffect(() => {

    if (
      tripState !==
      TripState.ACTIVE
    ) {
      return;
    }

    BackgroundTracker.start();

    const unsubscribe =
      BackgroundTracker.subscribe(
        (
          location: TrackerLocation
        ) => {

          const mappedLocation: Location = {
            lat: location.lat,
            lng: location.lng,
            accuracy:
              location.accuracy,
            speed: location.speed,
            timestamp:
              location.timestamp
          };

          setLastLocation(
            mappedLocation
          );

          lastLocationRef.current =
            mappedLocation;

          // ====================================================
          // 📏 SAFE DISTANCE ENGINE
          // ====================================================
          setCurrentTrip((prev) => {

            if (
              !prev.lastTrackedLocation
            ) {
              return {
                ...prev,
                lastTrackedLocation:
                  mappedLocation,
                distance: 0,
                avgSpeed: 0
              };
            }

            const prevLoc =
              prev.lastTrackedLocation;

            const dist =
              calculateDistance(
                prevLoc,
                mappedLocation
              );

            // 🚨 SPIKE FILTER
            if (
              !Number.isFinite(
                dist
              ) ||
              dist < 0 ||
              dist > 2
            ) {

              console.log(
                "⚠️ GPS spike ignored:",
                dist
              );

              return prev;
            }

            // ====================================================
            // ⏱ TIME DELTA
            // ====================================================
            const prevTime =
              prevLoc.timestamp ||
              Date.now();

            const currentTime =
              mappedLocation.timestamp ||
              Date.now();

            const hours =
              (
                currentTime -
                prevTime
              ) / 3600000;

            // ====================================================
            // ⚡ SPEED
            // ====================================================
            let speed = 0;

            if (hours > 0) {
              speed =
                dist / hours;
            }

            // 🚨 SPEED FILTER
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

            return {

              ...prev,

              distance:
                (
                  prev.distance || 0
                ) + dist,

              avgSpeed: speed,

              lastTrackedLocation:
                mappedLocation

            };

          });

        }
      );

    return () => {
      unsubscribe();
    };

  }, [tripState]);

  // ====================================================
  // ⏱️ TIMER
  // ====================================================
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
        ) return;

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

  // ====================================================
  // 💾 SAVE ACTIVE SESSION
  // ====================================================
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
          duration,
          estimatedFare,
          tripStartTime:
            tripStartRef.current
        }
      );
    }

  }, [
    currentTrip,
    tripState,
    duration,
    network,
    estimatedFare
  ]);

  // ====================================================
  // 🗺️ PLAN TRIP
  // ====================================================
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
        "Enter destination"
      );

      return;
    }

    // 🚫 BLOCK DURING ACTIVE TRIP
    if (
      tripState ===
      TripState.ACTIVE
    ) {
      return;
    }

    setError(null);

    setIsPlanning(true);

    try {

      const cleanDestination =
        destination
          .trim()
          .toLowerCase();

      const cached =
        lastPlannedRouteRef.current;

      const sameDestination =
        cached?.destination ===
        cleanDestination;

      const sameNetwork =
        cached?.network ===
        selectedNetwork;

      const sameOrigin =
        cached &&
        Math.abs(
          cached.originLat -
          lastLocation.lat
        ) < 0.0005 &&
        Math.abs(
          cached.originLng -
          lastLocation.lng
        ) < 0.0005;

      // 🚫 PREVENT DUPLICATE RECALCULATION
      if (
        sameDestination &&
        sameNetwork &&
        sameOrigin
      ) {

        console.log(
          "⚠️ Duplicate fare request ignored"
        );

        return;
      }

      // ====================================================
      // 🗺️ ROUTE ENGINE
      // ====================================================
      const result =
        await DestinationEngine.plan({
          origin:
            lastLocation,
          destination:
            cleanDestination
        });

      const safeDistance =
        Math.max(
          0,
          Number(
            result.distance.toFixed(
              2
            )
          )
        );

      // ====================================================
      // 💰 FARE ENGINE
      // ====================================================
      const fareResult =
        await FareEngine.computeFinalFare(
          {
            network:
              selectedNetwork,
            distance:
              safeDistance
          }
        );

      // ====================================================
      // 💾 CACHE
      // ====================================================
      lastPlannedRouteRef.current =
        {
          destination:
            cleanDestination,

          originLat:
            lastLocation.lat,

          originLng:
            lastLocation.lng,

          distance:
            safeDistance,

          network:
            selectedNetwork
        };

      // ====================================================
      // 🎯 APPLY
      // ====================================================
      setNetwork(
        selectedNetwork
      );

      setPlannedDistance(
        safeDistance
      );

      setEstimatedFare(
        fareResult.fare
      );

      console.log(
        "✅ Trip planned",
        {
          network:
            selectedNetwork,
          distance:
            safeDistance,
          fare:
            fareResult.fare
        }
      );

    } catch (err) {

      console.error(err);

      setError(
        "Trip planning failed"
      );

    } finally {

      setIsPlanning(false);

    }

  };

  // ====================================================
  // 🚀 START TRIP
  // ====================================================
  const startTrip = async () => {

    if (
      !network ||
      !lastLocation
    ) {
      return;
    }

    tripStartRef.current =
      Date.now();

    setTripState(
      TripState.ACTIVE
    );

    setDuration(0);

    await BackgroundTracker.start();

    const trip: Partial<TripData> = {

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
    };

    setCurrentTrip(trip);

  };

  // ====================================================
  // 🛑 END TRIP
  // ====================================================
  const endTrip = async () => {

    if (
      !network ||
      !currentTrip.startTime
    ) {
      return;
    }

    await BackgroundTracker.stop();

    const dist =
      currentTrip.distance || 0;

    const fareResult =
      await FareEngine.computeFinalFare(
        {
          network,
          distance: dist
        }
      );

    const avgSpeed =
      duration > 0
        ? dist /
          (duration / 3600)
        : 0;

    const trip: TripData = {

      ...(currentTrip as TripData),

      endTime:
        Date.now(),

      duration,

      distance: dist,

      fare:
        fareResult.fare,

      avgSpeed

    };

    setVerifyTrip(trip);

    setTripState(
      TripState.IDLE
    );

    setDuration(0);

    setNetwork(null);

    tripStartRef.current =
      null;

    Session.clear(
      "active_trip"
    );

  };

  // ====================================================
  // ✅ CONFIRM TRIP
  // ====================================================
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

    setVerifyTrip(null);

    setActualFare("");

    setCurrentTrip({});

    setEstimatedFare(null);

    setPlannedDistance(0);

    setDestination("");

  };

  // ====================================================
  // 🔐 AUTH
  // ====================================================
  if (!user) {
    return (
      <AuthView
        onLogin={setUser}
      />
    );
  }

  // ====================================================
  // 🎨 UI
  // ====================================================
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

            {/* CONTROL */}
            <div className="glass p-5 rounded-3xl space-y-4">

              {/* STATUS */}
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
                onChange={(e) => {

                  setDestination(
                    e.target.value
                  );

                }}
                placeholder="Enter destination"
                className="w-full h-12 px-4 bg-white/5 rounded-2xl"
              />

              {/* ERROR */}
              {error && (
                <div className="text-red-400 text-xs">
                  {error}
                </div>
              )}

              {/* NETWORKS */}
              <div className="grid grid-cols-2 gap-2">

                {TRANSIT_NETWORKS.map((n) => (

                  <button
                    key={n}
                    onClick={() =>
                      planTrip(n)
                    }
                    disabled={
                      isPlanning
                    }
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

              {/* ESTIMATE */}
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