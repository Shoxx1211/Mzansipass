// src/components/PulseLogo.tsx
// Pulse Transit - Premium Animated Logo Component
// Features: Multiple variants, animations, theming, responsive sizing

import React, { memo, useState, useEffect, useRef } from "react";

// ======================================================
// TYPES
// ======================================================
interface PulseLogoProps {
  size?: number;
  variant?: "default" | "minimal" | "glow" | "gradient" | "monochrome";
  animated?: boolean;
  pulseSpeed?: "slow" | "normal" | "fast";
  showRing?: boolean;
  ringCount?: number;
  onAnimationComplete?: () => void;
  className?: string;
}

interface PulseRingProps {
  size: number;
  delay: number;
  duration: number;
  color: string;
}

// ======================================================
// CONSTANTS
// ======================================================
const PULSE_SPEEDS = {
  slow: { pulse: "3s", ring: "4s" },
  normal: { pulse: "2s", ring: "2.5s" },
  fast: { pulse: "1s", ring: "1.5s" }
} as const;

const GRADIENT_VARIANTS = {
  default: "from-emerald-400 to-blue-500",
  gradient: "from-cyan-400 via-emerald-400 to-blue-500",
  glow: "from-emerald-400 to-cyan-400",
  monochrome: "from-white to-white/70",
  minimal: "from-gray-400 to-gray-500"
} as const;

// ======================================================
// SUB-COMPONENTS
// ======================================================
const PulseRing: React.FC<PulseRingProps> = ({ size, delay, duration, color }) => (
  <div
    className="absolute rounded-full animate-ping"
    style={{
      width: size,
      height: size,
      backgroundColor: color,
      opacity: 0.15,
      animationDelay: `${delay}ms`,
      animationDuration: `${duration}ms`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)'
    }}
  />
);

const PulsePath: React.FC<{ animated: boolean; color: string }> = ({ animated, color }) => {
  const [pathLength, setPathLength] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      setPathLength(length);
    }
  }, []);

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-[60%] h-[60%]"
      fill="none"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        ref={pathRef}
        d="M5 55 L25 55 L35 35 L50 75 L65 45 L75 55 L95 55"
        strokeDasharray={pathLength}
        strokeDashoffset={animated ? pathLength : 0}
        style={{
          animation: animated ? `drawLine 1.5s ease-out forwards` : 'none'
        }}
      />
    </svg>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================
export const PulseLogo = memo<PulseLogoProps>(({
  size = 32,
  variant = "default",
  animated = true,
  pulseSpeed = "normal",
  showRing = true,
  ringCount = 2,
  onAnimationComplete,
  className = ""
}) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const speeds = PULSE_SPEEDS[pulseSpeed];
  const gradient = GRADIENT_VARIANTS[variant];
  const textColor = variant === "monochrome" ? "white" : "white";

  // Determine ring color based on variant
  const getRingColor = (): string => {
    if (variant === "monochrome") return "rgba(255,255,255,0.3)";
    if (variant === "minimal") return "rgba(156,163,175,0.3)";
    return "rgba(16,185,129,0.3)";
  };

  // Animation completion handler
useEffect(() => {
  if (!animated) return;
  
  const timer = setTimeout(() => {
    setIsAnimating(false);
    onAnimationComplete?.();
  }, 1500);
  
  return () => clearTimeout(timer);
}, [animated, onAnimationComplete]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Rings - Radar/Ping Effect */}
      {showRing && (
        <>
          {Array.from({ length: ringCount }).map((_, i) => (
            <PulseRing
              key={i}
              size={size * (1 + (i + 1) * 0.4)}
              delay={i * 400}
              duration={parseInt(speeds.ring)}
              color={getRingColor()}
            />
          ))}
        </>
      )}

      {/* Glow Effect */}
      {variant !== "minimal" && (
        <div
          className="absolute inset-0 rounded-full blur-xl animate-pulse"
          style={{
            background: variant === "monochrome" 
              ? "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)",
            animationDuration: speeds.pulse
          }}
        />
      )}

      {/* Core Logo Circle */}
      <div
        className={`
          relative w-full h-full rounded-full 
          bg-gradient-to-br ${gradient}
          flex items-center justify-center
          shadow-xl transition-all duration-300
          ${animated && isAnimating ? 'scale-105' : 'scale-100'}
        `}
        style={{
          animation: animated && variant !== "minimal" 
            ? `pulseCore ${speeds.pulse} ease-in-out infinite`
            : 'none'
        }}
      >
        {/* Inner Glow */}
        <div className="absolute inset-1 rounded-full bg-white/10" />

        {/* Pulse Wave Line */}
        <div className="relative z-10">
          <PulsePath animated={animated} color={textColor} />
        </div>

        {/* Loading Indicator for Animated State */}
        {animated && isAnimating && variant !== "minimal" && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5">
            <div className="h-full bg-white/50 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
});

PulseLogo.displayName = "PulseLogo";

// ======================================================
// PRESET VARIANTS
// ======================================================

export const PulseLogoHome: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <PulseLogo size={size} variant="default" animated pulseSpeed="normal" showRing ringCount={2} />
);

export const PulseLogoLoading: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <PulseLogo size={size} variant="glow" animated pulseSpeed="fast" showRing ringCount={3} />
);

export const PulseLogoNav: React.FC<{ size?: number; active?: boolean }> = ({ size = 28, active = false }) => (
  <PulseLogo 
    size={size} 
    variant={active ? "default" : "monochrome"} 
    animated={active} 
    showRing={false}
  />
);