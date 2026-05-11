import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { TripState } from "../types";

import type {
  TransitNetwork
} from "../types";

// ======================================================
// TYPES
// ======================================================

interface VirtualCardProps {

  state: TripState;

  network: TransitNetwork | null;

  distance: number;

  duration: number;

  destination?: string;

  estimatedFare?: number;

  lastTrip?: {
    distance: number;
    network: string;
    fare: number;
    date?: number;
  };

}

// ======================================================
// NETWORK COLORS
// ======================================================

const NETWORK_THEME = {

  Taxi:
    "from-amber-500/30 to-orange-500/10",

  Gautrain:
    "from-blue-500/30 to-cyan-500/10",

  "Rea Vaya":
    "from-emerald-500/30 to-green-500/10",

  "A Re Yeng":
    "from-purple-500/30 to-fuchsia-500/10",

  "Tshwane Bus Service":
    "from-sky-500/30 to-indigo-500/10",

  Metrorail:
    "from-zinc-500/30 to-zinc-800/10"

} as const;

// ======================================================
// COMPONENT
// ======================================================

export const VirtualCard: React.FC<VirtualCardProps> =
React.memo(({

  state,
  network,

  distance = 0,
  duration = 0,

  destination,

  estimatedFare,

  lastTrip

}) => {

  // ======================================================
  // TILT ENGINE
  // ======================================================

  const [rotation, setRotation] =
    useState({ x: 0, y: 0 });

  const rafRef =
    useRef<number | null>(null);

  useEffect(() => {

    return () => {

      if (rafRef.current) {
        cancelAnimationFrame(
          rafRef.current
        );
      }

    };

  }, []);

  const updateRotation = (
    x: number,
    y: number
  ) => {

    if (rafRef.current) {

      cancelAnimationFrame(
        rafRef.current
      );

    }

    rafRef.current =
      requestAnimationFrame(() => {

        setRotation({ x, y });

      });

  };

  const handleMove = (
    clientX: number,
    clientY: number,
    rect: DOMRect
  ) => {

    const x =
      clientX - rect.left;

    const y =
      clientY - rect.top;

    const centerX =
      rect.width / 2;

    const centerY =
      rect.height / 2;

    updateRotation(
      (centerY - y) / 30,
      (x - centerX) / 30
    );

  };

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {

    handleMove(
      e.clientX,
      e.clientY,
      e.currentTarget.getBoundingClientRect()
    );

  };

  const handleTouchMove = (
    e: React.TouchEvent<HTMLDivElement>
  ) => {

    const touch =
      e.touches[0];

    if (!touch) return;

    handleMove(
      touch.clientX,
      touch.clientY,
      e.currentTarget.getBoundingClientRect()
    );

  };

  const resetTilt = () => {

    setRotation({
      x: 0,
      y: 0
    });

  };

  // ======================================================
  // FORMATTERS
  // ======================================================

  const formatTime = (
    seconds: number
  ) => {

    if (!seconds) {
      return "0m";
    }

    const h =
      Math.floor(seconds / 3600);

    const m =
      Math.floor(
        (seconds % 3600) / 60
      );

    if (h > 0) {
      return `${h}h ${m}m`;
    }

    return `${m}m`;

  };

  const speed = useMemo(() => {

    if (
      !distance ||
      !duration ||
      duration < 10
    ) {

      return 0;

    }

    const calculated =
      distance /
      (duration / 3600);

    if (
      !Number.isFinite(calculated) ||
      calculated < 0 ||
      calculated > 180
    ) {

      return 0;

    }

    return calculated;

  }, [distance, duration]);

  // ======================================================
  // STATUS
  // ======================================================

  const statusText = useMemo(() => {

    switch (state) {

      case TripState.ACTIVE:
        return "Journey Active";

      case TripState.PLANNING:
        return "Ready To Travel";

      default:
        return "Ready";

    }

  }, [state]);

  // ======================================================
  // THEME
  // ======================================================

  const theme =
    network &&
    network in NETWORK_THEME
      ? NETWORK_THEME[network]
      : "from-blue-500/20 to-cyan-500/5";

  // ======================================================
  // STYLE
  // ======================================================

  const style = {

    transform:
      `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`

  };

  // ======================================================
  // UI
  // ======================================================

  return (

    <div
      className="
        relative
        w-full
        aspect-[1.65/1]
      "
      style={{
        perspective: "1600px"
      }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={resetTilt}
      onTouchEnd={resetTilt}
    >

      {/* GLOW */}
      <div
        className={`
          absolute inset-0
          rounded-[2.5rem]
          blur-3xl
          opacity-50
          bg-gradient-to-br
          ${theme}
        `}
      />

      {/* CARD */}
      <div
        style={style}
        className="
          relative
          overflow-hidden
          w-full
          h-full
          rounded-[2.5rem]
          border border-white/10
          transition-transform
          duration-200
          will-change-transform
        "
      >

        {/* BG */}
        <div
          className={`
            absolute inset-0
            bg-gradient-to-br
            ${theme}
          `}
        />

        {/* GLASS */}
        <div
          className="
            absolute inset-0
            bg-black/50
            backdrop-blur-2xl
          "
        />

        {/* SHINE */}
        <div
          className="
            absolute
            top-0
            left-[-30%]
            h-full
            w-[40%]
            rotate-12
            bg-white/10
            blur-2xl
          "
        />

        {/* CONTENT */}
        <div
          className="
            relative
            z-10
            h-full
            p-6
            flex
            flex-col
            justify-between
          "
        >

          {/* HEADER */}
          <div
            className="
              flex
              items-start
              justify-between
            "
          >

            <div>

              <p
                className="
                  text-[11px]
                  uppercase
                  tracking-[0.25em]
                  text-white/40
                "
              >
                Pulse Transit
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-black
                  leading-none
                "
              >
                {network || "Start Journey"}
              </h2>

            </div>

            <div
              className="
                px-3
                py-1
                rounded-full
                bg-white/10
                text-[10px]
                uppercase
                tracking-wider
                text-white/70
              "
            >
              {statusText}
            </div>

          </div>

          {/* CENTER */}
          {state === TripState.ACTIVE ? (

            <div
              className="
                grid
                grid-cols-2
                gap-4
              "
            >

              <Metric
                label="Distance"
                value={`${distance.toFixed(2)} km`}
              />

              <Metric
                label="Duration"
                value={formatTime(duration)}
              />

              <Metric
                label="Speed"
                value={`${speed.toFixed(0)} km/h`}
              />

              <Metric
                label="Estimated"
                value={
                  estimatedFare !== undefined
                    ? `R${estimatedFare.toFixed(2)}`
                    : "--"
                }
                highlight
              />

            </div>

          ) : (

            <div>

              <p
                className="
                  text-white/50
                  text-sm
                "
              >
                Destination
              </p>

              <h3
                className="
                  mt-1
                  text-2xl
                  font-bold
                  truncate
                "
              >
                {destination ||
                  "Where are you going?"}
              </h3>

              {estimatedFare !== undefined && (

                <div className="mt-5">

                  <p
                    className="
                      text-white/40
                      text-xs
                    "
                  >
                    Estimated Fare
                  </p>

                  <p
                    className="
                      text-4xl
                      font-black
                      text-emerald-400
                    "
                  >
                    R
                    {estimatedFare.toFixed(2)}
                  </p>

                </div>

              )}

            </div>

          )}

          {/* FOOTER */}
          <div
            className="
              flex
              items-end
              justify-between
            "
          >

            <div>

              {lastTrip && (
                <p
                  className="
                    text-[11px]
                    text-white/35
                  "
                >
                  Last Trip • R
                  {lastTrip.fare.toFixed(2)}
                </p>
              )}

            </div>

            <p
              className="
                text-[11px]
                text-white/25
                italic
              "
            >
              Feel the rhythm
            </p>

          </div>

        </div>

      </div>

    </div>

  );

});

// ======================================================
// METRIC
// ======================================================

interface MetricProps {

  label: string;

  value: string;

  highlight?: boolean;

}

const Metric: React.FC<MetricProps> = ({
  label,
  value,
  highlight
}) => {

  return (

    <div
      className="
        rounded-2xl
        bg-white/5
        border border-white/5
        p-4
      "
    >

      <p
        className="
          text-[11px]
          uppercase
          tracking-wide
          text-white/40
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1
          text-lg
          font-bold
          ${
            highlight
              ? "text-emerald-400"
              : "text-white"
          }
        `}
      >
        {value}
      </p>

    </div>

  );

};