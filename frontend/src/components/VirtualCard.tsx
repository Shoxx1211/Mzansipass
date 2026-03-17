import React, { useState, useMemo } from 'react';
import { TripState } from '../types';
import type { TransitNetwork, ReportType } from '../types';

interface VirtualCardProps {
  state: TripState;
  network: TransitNetwork;
  distance: number;
  duration: number;
  lastTrip?: { distance: number; network: string };
  pulseStatus?: ReportType;
}

export const VirtualCard: React.FC<VirtualCardProps> = React.memo(
  ({ state, network, distance, duration, lastTrip, pulseStatus }) => {
    const [rotation, setRotation] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      setRotation({
        y: (x - centerX) / 15,
        x: (centerY - y) / 15
      });
    };

    const handleMouseLeave = () => setRotation({ x: 0, y: 0 });

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (status?: ReportType) => {
      switch (status) {
        case 'Smooth':
          return 'text-emerald-400';
        case 'Delayed':
          return 'text-amber-400';
        case 'Overcrowded':
          return 'text-orange-400';
        case 'Breakdown':
          return 'text-red-400';
        case 'Safety Issue':
          return 'text-purple-400';
        default:
          return 'text-white/40';
      }
    };

    const cardStyle = useMemo(
      () => ({
        transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        boxShadow: `
          ${-rotation.y * 2}px ${rotation.x * 2}px 60px rgba(0,0,0,0.6),
          0 0 40px ${
            state === TripState.ACTIVE
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(59, 130, 246, 0.1)'
          }
        `
      }),
      [rotation.x, rotation.y, state]
    );

    return (
      <div
        className="relative w-full aspect-[1.6/1] mb-8 select-none cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: '1200px' }}
      >
        <div
          className="w-full h-full rounded-[2.5rem] transition-transform duration-150 ease-out preserve-3d relative overflow-hidden shadow-2xl border border-white/10"
          style={cardStyle}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br transition-colors duration-700 ${
              state === TripState.ACTIVE
                ? 'from-emerald-900/50 via-neutral-900 to-black'
                : 'from-blue-900/50 via-neutral-900 to-black'
            }`}
          />

          <div className="absolute inset-0 card-gloss pointer-events-none opacity-80" />
          <div className="reflection opacity-30" />

          <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                  Active Network
                </p>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  {network}
                  {pulseStatus && (
                    <span
                      className={`text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/5 ${getStatusColor(
                        pulseStatus
                      )}`}
                    >
                      {pulseStatus}
                    </span>
                  )}
                </h2>
              </div>
              <div
                className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest glass border-white/5 shadow-lg ${
                  state === TripState.ACTIVE
                    ? 'text-emerald-400 border-emerald-500/30'
                    : 'text-blue-400 border-blue-500/30'
                }`}
              >
                {state === TripState.ACTIVE ? '• LIVE TRACKING' : 'IDLE'}
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div className="flex-1">
                {state === TripState.IDLE ? (
                  <>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                      Status
                    </p>
                    <p className="text-xl font-semibold text-white/90">
                      Ready to travel
                    </p>
                    {lastTrip && (
                      <p className="text-[10px] text-white/30 mt-1 uppercase tracking-tight">
                        Last: {lastTrip.distance.toFixed(1)}km via {lastTrip.network}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex gap-10">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                        Time Elapsed
                      </p>
                      <p className="text-2xl font-mono font-black">
                        {formatTime(duration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                        Distance
                      </p>
                      <p className="text-2xl font-mono font-black">
                        {distance.toFixed(2)}
                        <span className="text-xs ml-1 text-white/30 font-sans uppercase tracking-widest">
                          km
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-1">
                  MzansiPass
                </p>
                <p className="text-xs font-bold text-white/40 italic">
                  Smart Commuter Intelligence
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);