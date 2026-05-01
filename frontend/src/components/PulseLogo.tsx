// components/PulseLogo.tsx

import React from "react";

// ✅ Props type
interface PulseLogoProps {
  size?: number; // optional
}

// ✅ Component
const PulseLogo: React.FC<PulseLogoProps> = ({ size = 32 }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center"
    >
      {/* 🔵 Glow */}
      <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse" />

      {/* ⚡ Core Pulse Circle */}
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg">

        {/* ❤️ Pulse line */}
        <svg
          viewBox="0 0 100 100"
          className="w-[65%] h-[65%]"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 55 L25 55 L35 35 L50 75 L65 45 L75 55 L95 55" />
        </svg>

      </div>
    </div>
  );
};

export default PulseLogo;