// src/components/Layout.tsx
import type { ReactNode } from "react";
import { TabType } from "../types";

interface LayoutProps {
  activeTab: TabType;
  onNavClick: (tab: TabType) => void;
  children: ReactNode;
}

export const Layout = ({ activeTab, onNavClick, children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-black">
      {/* Main content - ensure it's interactive */}
      <main className="relative z-10 pb-24">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass rounded-t-3xl border-t border-white/10">
        <div className="flex items-center justify-around p-3">
          <button
            onClick={() => onNavClick("home")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all ${
              activeTab === "home" 
                ? "text-cyan-400 bg-white/10" 
                : "text-white/50"
            }`}
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          
          <button
            onClick={() => onNavClick("stats")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-2xl transition-all ${
              activeTab === "stats" 
                ? "text-cyan-400 bg-white/10" 
                : "text-white/50"
            }`}
          >
            <span className="text-2xl">📊</span>
            <span className="text-xs">Stats</span>
          </button>
        </div>
      </nav>
    </div>
  );
};