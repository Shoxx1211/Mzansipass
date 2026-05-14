// src/App.tsx

import { useState, useEffect, useRef, useMemo } from "react";

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

    const [networkEstimates, setNetworkEstimates] =
  useState<
    Record<TransitNetwork, number>
  >({} as Record<TransitNetwork, number>);


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

    const [showTransportOptions, setShowTransportOptions] =
  useState(false);

    const availableNetworks = useMemo<readonly TransitNetwork[]>(() => {

  if (!lastLocation) {
    return TRANSIT_NETWORKS;
  }

  const city =
    detectCity(lastLocation);

  return TRANSIT_NETWORKS.filter(
    (network) => {

      const zones =
        NETWORK_ZONES[network];

      return (
        zones.includes(city as never) ||
        zones.includes("Everywhere" as never)
      );

    }
  );

}, [lastLocation]);

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
// RESTORE ACTIVE TRACKING SESSION
// ======================================================
useEffect(() => {

  const restored =
    BackgroundTracker.restoreTrip();

  if (!restored) {
    return;
  }

  setTripState(
    TripState.ACTIVE
  );

  setDuration(
    Math.floor(
      (
        Date.now() -
        restored.startedAt
      ) / 1000
    )
  );

  setCurrentTrip({

    distance:
      restored.totalDistance / 1000,

    avgSpeed:
      restored.averageSpeed,

    network:
      network || undefined

  });

  // ======================================================
  // LIVE SUBSCRIPTION
  // ======================================================
  const unsubscribe =
    BackgroundTracker.subscribeToTrip(
      (trip) => {

        setDuration(
          Math.floor(
            (
              Date.now() -
              trip.startedAt
            ) / 1000
          )
        );

        setCurrentTrip((prev) => ({

          ...prev,

          distance:
            trip.totalDistance / 1000,

          avgSpeed:
            trip.averageSpeed

        }));

      }
    );

  return unsubscribe;

}, []);

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
// CONTINUE TO TRANSPORT OPTIONS
// ======================================================
const continueToTransportOptions = () => {

  if (!destination.trim()) {

    setError(
      "Please enter a destination"
    );

    return;

  }

  setError(null);

  setShowTransportOptions(true);

};

  // ======================================================
// LIVE NETWORK ESTIMATES
// ======================================================
useEffect(() => {

  const generateEstimates =
    async () => {

      if (
        !destination.trim() ||
        !lastLocation
      ) {
        return;
      }

      try {

        const result =
          await DestinationEngine.plan({

            origin:
              lastLocation,

            destination:
              destination.trim().toLowerCase()

          });

        const distance =
          result.distance;

        const estimates:
          Record<
            TransitNetwork,
            number
          > =
            {} as Record<
              TransitNetwork,
              number
            >;

        for (const network of availableNetworks) {

          const fareResult =
            await FareEngine.computeFinalFare({

              network,
              distance

            });

          estimates[network] =
            fareResult.fare;

        }

        setNetworkEstimates(
          estimates
        );

      } catch (err) {

        console.error(
          "Estimate generation failed",
          err
        );

      }

    };

  generateEstimates();

}, [
  destination,
  lastLocation,
  availableNetworks
]);

  // ======================================================
  // PLAN TRIP
  // ======================================================
  const  planTrip = async (
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

    setShowTransportOptions(false);

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

    setShowTransportOptions(false);

    setEstimatedFare(null);

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
{/* PREMIUM ACTIVE TRIP */}
{/* ====================================================== */}
{tripState === TripState.ACTIVE && (

  <div
    className="
      relative
      overflow-hidden
      rounded-[2rem]
      border
      border-white/10
      bg-gradient-to-br
      from-emerald-500/15
      via-black/40
      to-cyan-500/10
      backdrop-blur-2xl
      p-6
      shadow-2xl
      shadow-emerald-500/10
    "
  >

    {/* BACKGROUND GLOW */}
    <div
      className="
        absolute
        -top-20
        -right-20
        h-56
        w-56
        rounded-full
        bg-emerald-400/10
        blur-3xl
      "
    />

    {/* HEADER */}
    <div className="relative flex items-start justify-between">

      <div className="space-y-2">

        <div className="flex items-center gap-2">

          <div
            className="
              h-2.5
              w-2.5
              rounded-full
              bg-emerald-400
              animate-pulse
            "
          />

          <p
            className="
              text-[11px]
              uppercase
              tracking-[0.25em]
              text-emerald-300/80
            "
          >
            Journey Active
          </p>

        </div>

        <div>

          <h2
            className="
              text-3xl
              font-black
              tracking-tight
              text-white
            "
          >
            {network}
          </h2>

          <p className="mt-1 text-sm text-white/45">
            Destination
          </p>

          <p
            className="
              text-lg
              font-semibold
              text-white/90
            "
          >
            {destination}
          </p>

        </div>

      </div>

      {/* LIVE CHIP */}
      <div
        className="
          rounded-2xl
          border
          border-emerald-400/20
          bg-emerald-400/10
          px-4
          py-2
          backdrop-blur-xl
        "
      >

        <p
          className="
            text-[10px]
            uppercase
            tracking-widest
            text-emerald-300
          "
        >
          Live Tracking
        </p>

      </div>

    </div>

    {/* MAIN TIME */}
    <div className="relative mt-8">

      <p className="text-xs uppercase tracking-widest text-white/35">
        Duration
      </p>

      <h1
        className="
          mt-2
          text-6xl
          font-black
          leading-none
          tracking-tight
          text-white
        "
      >
        {duration >= 3600
          ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
          : duration >= 60
          ? `${Math.floor(duration / 60)}m ${duration % 60}s`
          : `${duration}s`}
      </h1>

    </div>

    {/* METRICS */}
    <div className="relative mt-8 grid grid-cols-2 gap-4">

      {/* DISTANCE */}
      <div
        className="
          rounded-3xl
          border
          border-white/5
          bg-white/5
          p-4
          backdrop-blur-xl
        "
      >

        <p
          className="
            text-[11px]
            uppercase
            tracking-widest
            text-white/35
          "
        >
          Distance
        </p>

        <div className="mt-3 flex items-end gap-1">

          <h3 className="text-3xl font-black">
            {(currentTrip.distance || 0).toFixed(2)}
          </h3>

          <span className="pb-1 text-sm text-white/45">
            km
          </span>

        </div>

      </div>

      {/* SPEED */}
      <div
        className="
          rounded-3xl
          border
          border-white/5
          bg-white/5
          p-4
          backdrop-blur-xl
        "
      >

        <p
          className="
            text-[11px]
            uppercase
            tracking-widest
            text-white/35
          "
        >
          Avg Speed
        </p>

        <div className="mt-3 flex items-end gap-1">

          <h3 className="text-3xl font-black">
            {(currentTrip.avgSpeed || 0).toFixed(1)}
          </h3>

          <span className="pb-1 text-sm text-white/45">
            km/h
          </span>

        </div>

      </div>

    </div>

    {/* END BUTTON */}
    <button
      onClick={endTrip}
      className="
        relative
        mt-8
        h-16
        w-full
        rounded-3xl
        bg-gradient-to-r
        from-emerald-500
        to-cyan-500
        text-lg
        font-black
        tracking-wide
        text-white
        transition-all
        duration-300
        hover:scale-[1.02]
        active:scale-[0.98]
        shadow-xl
        shadow-emerald-500/20
      "
    >
      End Journey
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

            <button
  onClick={continueToTransportOptions}
  className="
    w-full
    h-14
    rounded-3xl
    bg-gradient-to-r
    from-cyan-500
    to-emerald-500
    font-bold
    text-white
    transition-all
    duration-300
    hover:scale-[1.01]
    active:scale-[0.99]
  "
>
  Continue
</button>

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
{showTransportOptions && (

  <div className="space-y-3">

    <p className="text-xs uppercase tracking-widest text-white/40">
      Available Transport
    </p>

    <div className="space-y-3">

      {availableNetworks.map((n) => {

        const estimate =
          networkEstimates[n];

        const selected =
          network === n;

        return (

          <button
            key={n}

            onClick={() => {

              setNetwork(n);

              if (estimate) {

                setEstimatedFare(
                  estimate
                );

              }

            }}

            className={`
              w-full
              rounded-3xl
              p-5
              text-left
              transition-all
              border

              ${
                selected
                  ? `
                    bg-emerald-500/15
                    border-emerald-400/40
                    shadow-[0_0_30px_rgba(16,185,129,0.15)]
                  `
                  : `
                    bg-white/[0.03]
                    border-white/5
                    hover:border-cyan-400/20
                  `
              }
            `}
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-lg font-bold">
                  {n}
                </p>

                <p className="text-xs text-white/40 mt-1">
                  Smart fare estimate
                </p>

              </div>

              <div className="text-right">

                <p className="text-2xl font-black">

                  {estimate
                    ? `~R${estimate.toFixed(2)}`
                    : "--"}

                </p>

                <p className="text-[10px] text-white/40 mt-1">
                  Approximate
                </p>

              </div>

            </div>

          </button>

        );

      })}

    </div>

  </div>

)}

        </div>

      {/* ESTIMATED FARE */}
{estimatedFare !== null && (

  <div
    className="
      glass
      rounded-[2rem]
      p-7
      text-center
      border
      border-emerald-500/10
      bg-gradient-to-br
      from-emerald-500/10
      to-cyan-500/5
      backdrop-blur-2xl
      space-y-3
    "
  >

    <p
      className="
        text-[11px]
        uppercase
        tracking-[0.3em]
        text-white/40
      "
    >
      Estimated Fare
    </p>

    <h2
      className="
        text-6xl
        font-black
        tracking-tight
        leading-none
      "
    >
      R{estimatedFare.toFixed(2)}
    </h2>

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