import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavClick: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onNavClick }) => {
  return (
    <div className="min-h-screen app-bg text-white flex flex-col items-center relative overflow-hidden">

      {/* BACKGROUND GLOW ORBS */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-500/20 blur-3xl rounded-full" />
      <div className="absolute bottom-[-120px] right-[-100px] w-[300px] h-[300px] bg-purple-500/20 blur-3xl rounded-full" />

      {/* HEADER */}
      <header className="w-full max-w-md px-6 py-8 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            MzansiPass
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mt-1">
            Smart Transit Intelligence
          </p>
        </div>

        <div className="w-11 h-11 rounded-full glass flex items-center justify-center border border-white/10 overflow-hidden shadow-inner hover:scale-105 transition">
          <img
            src="https://picsum.photos/seed/mzansi/100/100"
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-md px-6 pb-28 z-10">
        {children}
      </main>

      {/* FLOATING NAV */}
      <nav className="fixed bottom-6 w-full max-w-md px-6 z-50">
        <div className="glass border border-white/10 rounded-3xl px-6 py-4 flex justify-between items-center shadow-2xl backdrop-blur-xl">

          <NavItem icon="🏠" label="Home" active={activeTab === 'home'} onClick={() => onNavClick('home')} />
          <NavItem icon="📡" label="Pulse" active={activeTab === 'pulse'} onClick={() => onNavClick('pulse')} />
          <NavItem icon="📊" label="Stats" active={activeTab === 'stats'} onClick={() => onNavClick('stats')} />
          <NavItem icon="⚙️" label="Settings" active={activeTab === 'settings'} onClick={() => onNavClick('settings')} />

        </div>
      </nav>
    </div>
  );
};

/* --- NAV ITEM --- */

const NavItem: React.FC<{
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="relative flex flex-col items-center justify-center group transition-all duration-300"
  >
    {/* ICON */}
    <span
      className={`text-xl transition-all duration-300 ${
        active
          ? 'scale-110 text-white'
          : 'text-white/40 group-hover:text-white/70'
      }`}
    >
      {icon}
    </span>

    {/* LABEL */}
    <span
      className={`text-[9px] uppercase tracking-widest mt-1 transition-all duration-300 ${
        active ? 'text-white' : 'text-white/30'
      }`}
    >
      {label}
    </span>

    {/* ACTIVE INDICATOR */}
    <div
      className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
        active
          ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)] scale-100'
          : 'scale-0'
      }`}
    />
  </button>
);