import React, { useState, useMemo, useRef, useEffect } from "react";
import { TripState } from "../types";
import type { TransitNetwork } from "../types";

// ---------------- TYPES ----------------
interface VirtualCardProps {
  state: TripState;
  network: TransitNetwork | null;

  distance: number;
  duration: number;

  destination?: string;
  estimatedFare?: number; // 🔥 THIS IS NOW THE SOURCE OF TRUTH

  lastTrip?: {
    distance: number;
    network: string;
    fare: number;
    date?: number;
  };
}

// ---------------- COMPONENT ----------------
export const VirtualCard: React.FC<VirtualCardProps> = React.memo(
({
  state,
  network,
  distance = 0,
  duration = 0,

  destination,
  estimatedFare,

  lastTrip
}) => {

  // ===============================
  // 🎯 TILT ENGINE
  // ===============================
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateRotation = (x: number, y: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setRotation({ x, y });
    });
  };

  const handleMove = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    updateRotation((centerY - y) / 18, (x - centerX) / 18);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    handleMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    handleMove(t.clientX, t.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleLeave = () => setRotation({ x: 0, y: 0 });

  // ===============================
  // ⏱ FORMATTERS
  // ===============================
  const formatTime = (s: number) => {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatDate = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleDateString();
  };

  // ===============================
  // 🚀 SPEED
  // ===============================
  const speed = useMemo(() => {
    if (!duration) return 0;
    return distance / (duration / 3600);
  }, [distance, duration]);

  // ===============================
  // 🔒 LOCKED FARE DISPLAY
  // ===============================
  const displayFare = useMemo(() => {
    if (state === TripState.ACTIVE) {
      return estimatedFare ?? null; // 🔥 LOCKED
    }
    return estimatedFare ?? null;
  }, [state, estimatedFare]);

  // ===============================
  // 🧠 TRIP QUALITY
  // ===============================
  const quality = useMemo(() => {
    if (speed > 70) return { label: "Express", color: "text-red-400" };
    if (speed > 30) return { label: "Efficient", color: "text-emerald-400" };
    if (speed > 10) return { label: "Moderate", color: "text-amber-400" };
    return { label: "Slow", color: "text-white/40" };
  }, [speed]);

  const cardStyle = {
    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
  };

  const displayNetwork = network ?? "Select mode";

  // ===============================
  // UI
  // ===============================
  return (
    <div
      className="relative w-full aspect-[1.6/1] mb-8"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleLeave}
      onTouchEnd={handleLeave}
      style={{ perspective: "1400px" }}
    >

      <div className="absolute inset-0 rounded-[2.5rem] blur-2xl bg-blue-500/20 opacity-40" />

      <div
        className="w-full h-full rounded-[2.5rem] relative overflow-hidden border border-white/10"
        style={cardStyle}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/60 via-black to-black" />
        <div className="absolute inset-0 backdrop-blur-xl bg-white/5" />

        <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">

          {/* TOP */}
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] text-white/30 uppercase">Mode</p>
              <h2 className="text-xl font-black">{displayNetwork}</h2>
            </div>
            <div className="text-[10px] text-blue-400 font-bold">PULSE</div>
          </div>

          {/* CENTER */}
          {state === TripState.IDLE ? (
            <div>
              <p className="text-lg font-semibold">Where are we going?</p>

              {destination && (
                <p className="text-sm text-white/60 mt-1">→ {destination}</p>
              )}

              {estimatedFare !== undefined && (
                <p className="text-xl font-bold text-emerald-400 mt-2">
                  Est: R{estimatedFare.toFixed(2)}
                </p>
              )}

              {lastTrip && (
                <p className="text-xs text-white/30 mt-2">
                  Last: {(lastTrip.distance ?? 0).toFixed(1)}km • R
                  {(lastTrip.fare ?? 0).toFixed(2)} •{" "}
                  {formatDate(lastTrip.date)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex justify-between text-sm">

              <div>
                <p className="text-white/40 text-xs">Time</p>
                <p className="font-mono">{formatTime(duration)}</p>
              </div>

              <div>
                <p className="text-white/40 text-xs">Distance</p>
                <p>{distance.toFixed(2)} km</p>
              </div>

              <div>
                <p className="text-white/40 text-xs">Speed</p>
                <p>{speed.toFixed(0)} km/h</p>
              </div>

              <div>
                <p className="text-white/40 text-xs">Fare</p>
                <p className="text-emerald-400 font-bold">
                  {displayFare !== null
                    ? `R${displayFare.toFixed(2)}`
                    : "--"}
                </p>
              </div>

            </div>
          )}

          {/* FOOTER */}
          <div className="flex justify-between items-end text-xs">
            {state === TripState.ACTIVE && (
              <span className={quality.color}>{quality.label}</span>
            )}
            <span className="text-white/30 italic">
              Feel the rhythm of your journey
            </span>
          </div>

        </div>
      </div>
    </div>
  );
});