// src/components/TripTracker.tsx

import {
  Timer,
  Route,
  Zap,
  Navigation,
  Activity,
  MapPinned,
  Wifi,
  Signal
} from "lucide-react";

import type {
  TransitNetwork
} from "../types";

import {
  NETWORK_UI
} from "../constants";

// ======================================================
// TYPES
// ======================================================
interface TripTrackerProps {

  network: TransitNetwork | null;

  destination: string;

  distance: number;

  duration: number;

  speed: number;

}

// ======================================================
// COMPONENT
// ======================================================
export const TripTracker = ({
  network,
  destination,
  distance,
  duration,
  speed
}: TripTrackerProps) => {

  // ======================================================
  // FORMAT DURATION
  // ======================================================
  const formatDuration = (
    seconds: number
  ) => {

    const hrs =
      Math.floor(seconds / 3600);

    const mins =
      Math.floor(
        (seconds % 3600) / 60
      );

    const secs =
      Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }

    return `${secs}s`;

  };

  // ======================================================
  // NETWORK UI
  // ======================================================
  const ui =
    network
      ? NETWORK_UI[network]
      : null;

  // ======================================================
  // QUALITY ENGINE
  // ======================================================
  const quality = (() => {

    if (speed >= 70) {
      return {
        label: "Express",
        color:
          "text-red-400"
      };
    }

    if (speed >= 40) {
      return {
        label: "Fast",
        color:
          "text-emerald-400"
      };
    }

    if (speed >= 20) {
      return {
        label: "Smooth",
        color:
          "text-cyan-400"
      };
    }

    return {
      label: "Slow",
      color:
        "text-white/40"
    };

  })();

  // ======================================================
  // LIVE ETA
  // ======================================================
  const eta = (() => {

    if (
      !speed ||
      speed <= 5
    ) {
      return "--";
    }

    const remaining =
      Math.max(
        0,
        12 - distance
      );

    const hours =
      remaining / speed;

    const mins =
      Math.round(hours * 60);

    return `${mins} min`;

  })();

  // ======================================================
  // UI
  // ======================================================
  return (

    <div className="space-y-5 fade-in">

      {/* ====================================================== */}
      {/* HERO */}
      {/* ====================================================== */}
      <div
        className={`
          relative
          overflow-hidden
          rounded-[2rem]
          border border-white/10
          bg-gradient-to-br
          ${ui?.color || "from-zinc-900 to-black"}
          p-6
          shadow-2xl
        `}
      >

        {/* BACKDROP */}
        <div className="
          absolute inset-0
          bg-black/45
          backdrop-blur-xl
        " />

        {/* CONTENT */}
        <div className="relative z-10">

          {/* TOP */}
          <div className="
            flex
            items-start
            justify-between
          ">

            <div>

              <p className="
                text-[11px]
                uppercase
                tracking-[0.25em]
                text-white/40
              ">
                Active Journey
              </p>

              <div className="
                flex
                items-center
                gap-3
                mt-2
              ">

                <div className="
                  w-14
                  h-14
                  rounded-2xl
                  bg-white/10
                  border border-white/10
                  flex
                  items-center
                  justify-center
                  text-2xl
                ">
                  {ui?.icon || "📍"}
                </div>

                <div>

                  <h2 className="
                    text-3xl
                    font-black
                    leading-none
                  ">
                    {network || "Transit"}
                  </h2>

                  <p className={`
                    text-sm
                    mt-1
                    font-semibold
                    ${quality.color}
                  `}>
                    {quality.label}
                  </p>

                </div>

              </div>

            </div>

            {/* LIVE */}
            <div className="
              flex
              items-center
              gap-2
              px-3
              py-2
              rounded-full
              bg-emerald-500/15
              border border-emerald-500/20
            ">

              <div className="
                w-2
                h-2
                rounded-full
                bg-emerald-400
                animate-pulse
              " />

              <span className="
                text-[11px]
                font-bold
                text-emerald-300
              ">
                LIVE
              </span>

            </div>

          </div>

          {/* DESTINATION */}
          <div className="mt-8">

            <p className="
              text-xs
              text-white/40
              uppercase
              tracking-wider
            ">
              Destination
            </p>

            <div className="
              flex
              items-center
              gap-3
              mt-3
            ">

              <div className="
                w-10
                h-10
                rounded-xl
                bg-cyan-500/15
                flex
                items-center
                justify-center
              ">

                <MapPinned
                  size={18}
                  className="
                    text-cyan-400
                  "
                />

              </div>

              <div>

                <p className="
                  text-lg
                  font-bold
                ">
                  {destination ||
                    "Tracking route"}
                </p>

                <p className="
                  text-xs
                  text-white/40
                ">
                  Smart GPS route monitoring
                </p>

              </div>

            </div>

          </div>

          {/* BOTTOM */}
          <div className="
            mt-8
            grid
            grid-cols-3
            gap-3
          ">

            <div className="
              rounded-2xl
              bg-white/5
              border border-white/5
              p-3
            ">

              <p className="
                text-[10px]
                text-white/40
                uppercase
              ">
                ETA
              </p>

              <p className="
                text-lg
                font-black
                mt-1
              ">
                {eta}
              </p>

            </div>

            <div className="
              rounded-2xl
              bg-white/5
              border border-white/5
              p-3
            ">

              <p className="
                text-[10px]
                text-white/40
                uppercase
              ">
                Signal
              </p>

              <div className="
                flex
                items-center
                gap-2
                mt-2
              ">

                <Signal
                  size={16}
                  className="
                    text-emerald-400
                  "
                />

                <span className="
                  text-sm
                  font-bold
                ">
                  Strong
                </span>

              </div>

            </div>

            <div className="
              rounded-2xl
              bg-white/5
              border border-white/5
              p-3
            ">

              <p className="
                text-[10px]
                text-white/40
                uppercase
              ">
                Tracking
              </p>

              <div className="
                flex
                items-center
                gap-2
                mt-2
              ">

                <Wifi
                  size={16}
                  className="
                    text-cyan-400
                  "
                />

                <span className="
                  text-sm
                  font-bold
                ">
                  Active
                </span>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* LIVE STATUS */}
      {/* ====================================================== */}
      <div className="
        glass
        rounded-[2rem]
        p-5
        border border-white/10
      ">

        <div className="
          flex
          items-center
          justify-between
        ">

          <div className="
            flex
            items-center
            gap-4
          ">

            <div className="
              w-12
              h-12
              rounded-2xl
              bg-emerald-500/10
              flex
              items-center
              justify-center
            ">

              <Activity
                size={22}
                className="
                  text-emerald-400
                "
              />

            </div>

            <div>

              <p className="
                font-bold
              ">
                Tracking in real-time
              </p>

              <p className="
                text-xs
                text-white/40
                mt-1
              ">
                Live GPS movement analysis enabled
              </p>

            </div>

          </div>

          <div className="
            px-3
            py-2
            rounded-full
            bg-emerald-500/10
            text-emerald-300
            text-xs
            font-bold
          ">
            ACTIVE
          </div>

        </div>

      </div>

      {/* ====================================================== */}
      {/* STATS */}
      {/* ====================================================== */}
      <div className="
        grid
        grid-cols-2
        gap-4
      ">

        {/* DISTANCE */}
        <div className="
          glass
          rounded-[2rem]
          p-5
        ">

          <div className="
            flex
            items-center
            gap-2
          ">

            <Route
              size={16}
              className="
                text-cyan-400
              "
            />

            <p className="
              text-xs
              text-white/40
            ">
              Distance
            </p>

          </div>

          <p className="
            text-4xl
            font-black
            mt-5
            leading-none
          ">
            {distance.toFixed(2)}
          </p>

          <p className="
            text-xs
            text-white/40
            mt-2
          ">
            kilometres travelled
          </p>

        </div>

        {/* DURATION */}
        <div className="
          glass
          rounded-[2rem]
          p-5
        ">

          <div className="
            flex
            items-center
            gap-2
          ">

            <Timer
              size={16}
              className="
                text-orange-400
              "
            />

            <p className="
              text-xs
              text-white/40
            ">
              Duration
            </p>

          </div>

          <p className="
            text-3xl
            font-black
            mt-5
            leading-none
          ">
            {formatDuration(duration)}
          </p>

          <p className="
            text-xs
            text-white/40
            mt-2
          ">
            journey time
          </p>

        </div>

        {/* SPEED */}
        <div className="
          glass
          rounded-[2rem]
          p-5
        ">

          <div className="
            flex
            items-center
            gap-2
          ">

            <Zap
              size={16}
              className="
                text-yellow-400
              "
            />

            <p className="
              text-xs
              text-white/40
            ">
              Speed
            </p>

          </div>

          <p className="
            text-4xl
            font-black
            mt-5
            leading-none
          ">
            {speed.toFixed(1)}
          </p>

          <p className="
            text-xs
            text-white/40
            mt-2
          ">
            km/h
          </p>

        </div>

        {/* NETWORK */}
        <div className="
          glass
          rounded-[2rem]
          p-5
        ">

          <div className="
            flex
            items-center
            gap-2
          ">

            <Navigation
              size={16}
              className="
                text-emerald-400
              "
            />

            <p className="
              text-xs
              text-white/40
            ">
              Transport
            </p>

          </div>

          <p className="
            text-xl
            font-black
            mt-5
            leading-tight
          ">
            {network || "Unknown"}
          </p>

          <p className="
            text-xs
            text-white/40
            mt-2
          ">
            live detected route
          </p>

        </div>

      </div>

    </div>

  );

};