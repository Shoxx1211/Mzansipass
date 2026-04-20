// components/VirtualCard.tsx

import React, { useState, useMemo, useRef, useEffect } from "react";
import { TripState } from "../types";
import type { TransitNetwork, ReportType } from "../types";

// ---------------- TYPES ----------------
interface VirtualCardProps {
  state: TripState;
  network: TransitNetwork | null;
  distance: number; // km
  duration: number; // seconds
  lastTrip?: { distance: number; network: string };
  pulseStatus?: ReportType;
}

// ---------------- COMPONENT ----------------
export const VirtualCard: React.FC<VirtualCardProps> = React.memo(
({
  state,
  network,
  distance,
  duration,
  lastTrip,
  pulseStatus
}) => {

  // ---------------- TILT STATE ----------------
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // Cleanup RAF (production safety)
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ---------------- SMOOTH TILT ----------------
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

    updateRotation(
      (centerY - y) / 18,
      (x - centerX) / 18
    );
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    handleMove(
      e.clientX,
      e.clientY,
      e.currentTarget.getBoundingClientRect()
    );
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;

    handleMove(
      touch.clientX,
      touch.clientY,
      e.currentTarget.getBoundingClientRect()
    );
  };

  const handleLeave = () => setRotation({ x: 0, y: 0 });

  // ---------------- FORMATTERS ----------------
  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ---------------- SPEED ----------------
  const speed = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    const s = distance / (duration / 3600);
    return isFinite(s) ? s : 0;
  }, [distance, duration]);

  const speedGlow =
    speed > 60
      ? "rgba(239,68,68,0.35)"      // fast (train)
      : speed > 25
      ? "rgba(245,158,11,0.3)"      // medium (bus/taxi)
      : "rgba(16,185,129,0.25)";    // slow (walking / idle)

  // ---------------- STATUS COLOR ----------------
  const getStatusColor = (status?: ReportType) => {
    switch (status) {
      case "Smooth": return "text-emerald-400";
      case "Delayed": return "text-amber-400";
      case "Overcrowded": return "text-orange-400";
      case "Breakdown": return "text-red-400";
      case "Safety Issue": return "text-purple-400";
      default: return "text-white/40";
    }
  };

  // ---------------- DISPLAY NETWORK ----------------
  const displayNetwork = network ?? "Detecting...";

  // ---------------- CARD STYLE ----------------
  const cardStyle = useMemo(
    () => ({
      transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
      boxShadow: `
        ${-rotation.y * 2}px ${rotation.x * 2}px 60px rgba(0,0,0,0.6),
        0 0 50px ${
          state === TripState.ACTIVE
            ? speedGlow
            : "rgba(59,130,246,0.15)"
        }
      `
    }),
    [rotation, state, speedGlow]
  );

  // ---------------- UI ----------------
  return (
    <div
      className="relative w-full aspect-[1.6/1] mb-8 select-none cursor-pointer"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleLeave}
      onTouchEnd={handleLeave}
      style={{ perspective: "1400px" }}
    >

      {/* GLOW */}
      <div
        className={`absolute inset-0 rounded-[2.5rem] blur-2xl transition-all duration-700 ${
          state === TripState.ACTIVE ? "opacity-60" : "opacity-30"
        }`}
        style={{
          background:
            state === TripState.ACTIVE
              ? speedGlow
              : "rgba(59,130,246,0.15)"
        }}
      />

      {/* CARD */}
      <div
        className="w-full h-full rounded-[2.5rem] transition-transform duration-200 ease-out relative overflow-hidden border border-white/10"
        style={cardStyle}
      >

        {/* BACKGROUND */}
        <div
          className={`absolute inset-0 ${
            state === TripState.ACTIVE
              ? "bg-gradient-to-br from-emerald-900/60 via-black to-black"
              : "bg-gradient-to-br from-blue-900/60 via-black to-black"
          }`}
        />

        {/* LIGHT SWEEP */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 translate-x-[-50%] hover:translate-x-[50%] transition-transform duration-1000" />
        </div>

        {/* GLASS */}
        <div className="absolute inset-0 backdrop-blur-xl bg-white/5" />

        {/* CONTENT */}
        <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">

          {/* TOP */}
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                Active Network
              </p>

              <h2 className="text-2xl font-black flex items-center gap-2">
                {displayNetwork}

                {pulseStatus && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border border-white/10 ${getStatusColor(
                      pulseStatus
                    )}`}
                  >
                    {pulseStatus}
                  </span>
                )}
              </h2>
            </div>

            <div
              className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest glass ${
                state === TripState.ACTIVE
                  ? "text-emerald-400"
                  : "text-blue-400"
              }`}
            >
              {state === TripState.ACTIVE ? "• LIVE" : "IDLE"}
            </div>
          </div>

          {/* CENTER */}
          <div className="flex justify-between items-end">

            {state === TripState.IDLE ? (
              <div>
                <p className="text-xl font-semibold">
                  Ready to travel
                </p>

                {lastTrip ? (
                  <p className="text-[10px] text-white/30 mt-1">
                    Last: {lastTrip.distance.toFixed(1)}km via{" "}
                    {lastTrip.network}
                  </p>
                ) : (
                  <p className="text-[10px] text-white/20 mt-1">
                    No trips yet
                  </p>
                )}
              </div>
            ) : (
              <div className="flex gap-10">
                <div>
                  <p className="text-[10px] text-white/30">Time</p>
                  <p className="text-2xl font-mono font-black">
                    {formatTime(duration)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-white/30">Distance</p>
                  <p className="text-2xl font-mono font-black">
                    {distance.toFixed(2)} km
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-white/30">Speed</p>
                  <p className="text-xl font-mono font-bold">
                    {speed.toFixed(0)} km/h
                  </p>
                </div>
              </div>
            )}

            {/* BRAND */}
            <div className="text-right">
              <p className="text-[10px] text-white/30">MzansiPass</p>
              <p className="text-xs text-white/40 italic">
                Movement Intelligence
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
});