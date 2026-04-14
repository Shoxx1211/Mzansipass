import React, { useEffect, useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavClick: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onNavClick
}) => {

  // ---------------- PWA INSTALL ----------------
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // ---------------- DYNAMIC HEADER ----------------
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'home': return 'Your Journey';
      case 'pulse': return 'Live Pulse';
      case 'stats': return 'Your Insights';
      case 'settings': return 'Settings';
      default: return 'MzansiPass';
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeTab) {
      case 'home': return 'Track movement in real-time';
      case 'pulse': return 'Community-powered updates';
      case 'stats': return 'Smart travel analytics';
      case 'settings': return 'Control your experience';
      default: return 'Smart Transit Intelligence';
    }
  };

  return (
    <div className="min-h-screen app-bg text-white flex flex-col items-center relative overflow-hidden">

      {/* 🌌 BACKGROUND ORBS */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute bottom-[-120px] right-[-100px] w-[300px] h-[300px] bg-purple-500/20 blur-3xl rounded-full animate-pulse" />

      {/* ---------------- HEADER ---------------- */}
      <header className="w-full max-w-md px-6 py-8 flex justify-between items-center z-10">

        <div className="fade-in">
          <h1 className="text-xl font-black tracking-tight text-white">
            {getHeaderTitle()}
          </h1>

          <p className="text-[10px] text-white/40 uppercase tracking-[0.25em] mt-1">
            {getHeaderSubtitle()}
          </p>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">

          {/* INSTALL BUTTON */}
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="glass px-3 py-2 rounded-xl text-[10px] font-bold border border-blue-400/30 text-blue-300 hover:scale-105 transition"
            >
              Install
            </button>
          )}

          {/* AVATAR */}
          <div className="w-11 h-11 rounded-full glass flex items-center justify-center border border-white/10 overflow-hidden shadow-inner hover:scale-105 transition">
            <img
              src="https://picsum.photos/seed/mzansi/100/100"
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* ---------------- MAIN ---------------- */}
      <main className="flex-1 w-full max-w-md px-6 pb-28 z-10 fade-in">
        {children}
      </main>

      {/* ---------------- NAV ---------------- */}
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

// ---------------- NAV ITEM ----------------
const NavItem: React.FC<{
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => {

  return (
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

      {/* ACTIVE DOT */}
      <div
        className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
          active
            ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)] scale-100'
            : 'scale-0'
        }`}
      />

      {/* SUBTLE HOVER GLOW */}
      {active && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/5 blur-xl -z-10" />
      )}
    </button>
  );
};