// components/Layout.tsx

import React, { useEffect, useState, useMemo } from "react";
import { TabType } from "../types"; // ✅ SINGLE SOURCE OF TRUTH

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onNavClick: (tab: TabType) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onNavClick,
}) => {
  // ---------------- PWA INSTALL ----------------
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () =>
      window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // ---------------- TAB PERSISTENCE ----------------
  useEffect(() => {
    localStorage.setItem("mzansi_active_tab", activeTab);
  }, [activeTab]);

  // ---------------- HEADER ----------------
  const header = useMemo(() => {
    switch (activeTab) {
      case TabType.home:
        return {
          title: "Your Journey",
          subtitle: "Real-time movement intelligence",
        };
      case TabType.pulse:
        return {
          title: "Live Pulse",
          subtitle: "Community-powered transport data",
        };
      case TabType.stats:
        return {
          title: "Your Insights",
          subtitle: "AI-driven travel analytics",
        };
      case TabType.settings:
        return {
          title: "Settings",
          subtitle: "Control your experience",
        };
      default:
        return {
          title: "MzansiPass",
          subtitle: "Smart Transit Intelligence",
        };
    }
  }, [activeTab]);

  // ---------------- ONLINE STATUS ----------------
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div className="min-h-screen app-bg text-white flex flex-col items-center relative overflow-hidden">

      {/* BACKGROUND */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute bottom-[-120px] right-[-100px] w-[300px] h-[300px] bg-purple-500/20 blur-3xl rounded-full animate-pulse" />

      {/* HEADER */}
      <header className="w-full max-w-md px-6 py-8 flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-black">{header.title}</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.25em] mt-1">
            {header.subtitle}
          </p>

          {!isOnline && (
            <p className="text-[10px] text-red-400 mt-1">
              Offline mode
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="glass px-3 py-2 rounded-xl text-[10px] font-bold border border-blue-400/30 text-blue-300"
            >
              Install
            </button>
          )}

          <div className="w-11 h-11 rounded-full glass overflow-hidden">
            <img
              src="https://picsum.photos/seed/mzansi/100/100"
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 w-full max-w-md px-6 pb-28 z-10">
        {children}
      </main>

      {/* NAV */}
      <nav className="fixed bottom-6 w-full max-w-md px-6 z-50">
        <div className="glass border border-white/10 rounded-3xl px-6 py-4 flex justify-between">

          <NavItem
            icon="🏠"
            label="Home"
            active={activeTab === TabType.home}
            onClick={() => onNavClick(TabType.home)}
          />

          <NavItem
            icon="📡"
            label="Pulse"
            active={activeTab === TabType.pulse}
            onClick={() => onNavClick(TabType.pulse)}
          />

          <NavItem
            icon="📊"
            label="Stats"
            active={activeTab === TabType.stats}
            onClick={() => onNavClick(TabType.stats)}
          />

          <NavItem
            icon="⚙️"
            label="Settings"
            active={activeTab === TabType.settings}
            onClick={() => onNavClick(TabType.settings)}
          />
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
    <button onClick={onClick} className="flex flex-col items-center">
      <span className={active ? "text-white" : "text-white/40"}>
        {icon}
      </span>
      <span className="text-[9px]">{label}</span>
    </button>
  );
};