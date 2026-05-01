// components/Layout.tsx

import React, { useEffect, useState, useMemo } from "react";
import { TabType } from "../types";
import PulseLogo from "./PulseLogo";

// ---------------- TYPES ----------------
interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  onNavClick: (tab: TabType) => void;
}

// ---------------- STORAGE ----------------
const STORAGE = {
  installDismissed: "pulse_install_dismissed", // 🔥 renamed
};

// ---------------- COMPONENT ----------------
export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onNavClick,
}) => {

  // ===============================
  // 📲 PWA INSTALL
  // ===============================
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE.installDismissed);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);

      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () =>
      window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome !== "accepted") {
      localStorage.setItem(STORAGE.installDismissed, "true");
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem(STORAGE.installDismissed, "true");
  };

  // ===============================
  // 🌐 ONLINE STATUS
  // ===============================
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

  // ===============================
  // 🧠 HEADER LOGIC
  // ===============================
  const header = useMemo(() => {
    switch (activeTab) {
      case TabType.home:
        return {
          title: "Your Journey",
          subtitle: "Feel the rhythm of your movement",
        };
      case TabType.pulse:
        return {
          title: "Live Pulse",
          subtitle: "Real-time commuter intelligence",
        };
      case TabType.stats:
        return {
          title: "Insights",
          subtitle: "Track your transport spend",
        };
      case TabType.settings:
        return {
          title: "Settings",
          subtitle: "Control your experience",
        };
      default:
        return {
          title: "Pulse",
          subtitle: "Smart Mobility Intelligence",
        };
    }
  }, [activeTab]);

  // ===============================
  // 💾 TAB PERSISTENCE
  // ===============================
  useEffect(() => {
    localStorage.setItem("pulse_active_tab", activeTab);
  }, [activeTab]);

  // ===============================
  // 🍏 iOS INSTALL DETECTION
  // ===============================
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    (window.navigator as any).standalone ||
    window.matchMedia("(display-mode: standalone)").matches;

  // ===============================
  // 🎨 UI
  // ===============================
  return (
    <div className="min-h-screen app-bg text-white flex flex-col items-center relative overflow-hidden">

      {/* 🌌 BACKGROUND FX */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute bottom-[-120px] right-[-100px] w-[300px] h-[300px] bg-blue-500/20 blur-3xl rounded-full animate-pulse" />

      {/* ===============================
          📲 INSTALL BANNER
      =============================== */}
      {showInstallBanner && (
        <div className="fixed top-4 z-50 w-full max-w-md px-6">
          <div className="glass p-4 rounded-2xl flex justify-between items-center border border-emerald-500/30">
            <div>
              <p className="text-xs font-bold">Install Pulse</p>
              <p className="text-[10px] text-white/50">
                Feel the rhythm. Works offline.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="px-3 py-2 bg-emerald-500 rounded-xl text-xs font-bold"
              >
                Install
              </button>

              <button
                onClick={dismissInstall}
                className="px-2 text-white/40"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===============================
          🍏 iOS INSTALL HINT
      =============================== */}
      {isIOS && !isStandalone && (
        <div className="fixed bottom-24 z-50 w-full max-w-md px-6">
          <div className="glass p-4 rounded-2xl text-center text-xs text-white/70">
            Tap <b>Share</b> → <b>Add to Home Screen</b>
          </div>
        </div>
      )}

      {/* ===============================
          HEADER
      =============================== */}
      <header className="w-full max-w-md px-6 py-8 flex justify-between items-center z-10">

        <div className="flex items-center gap-3">
          <PulseLogo size={36} /> {/* 🔥 LOGO */}
          <div>
            <h1 className="text-lg font-black">{header.title}</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.25em] mt-1">
              {header.subtitle}
            </p>

            {!isOnline && (
              <p className="text-[10px] text-red-400 mt-1">
                Offline mode
              </p>
            )}
          </div>
        </div>

        <div className="w-11 h-11 rounded-full glass overflow-hidden">
          <img
            src="https://picsum.photos/seed/pulse/100/100"
            alt="User avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      {/* ===============================
          MAIN CONTENT
      =============================== */}
      <main className="flex-1 w-full max-w-md px-6 pb-28 z-10">
        {children}
      </main>

      {/* ===============================
          NAVIGATION
      =============================== */}
      <nav className="fixed bottom-6 w-full max-w-md px-6 z-50">
        <div className="glass border border-white/10 rounded-3xl px-6 py-4 flex justify-between">

          <NavItem icon="🏠" label="Home" active={activeTab === TabType.home} onClick={() => onNavClick(TabType.home)} />
          <NavItem icon="📡" label="Pulse" active={activeTab === TabType.pulse} onClick={() => onNavClick(TabType.pulse)} />
          <NavItem icon="📊" label="Stats" active={activeTab === TabType.stats} onClick={() => onNavClick(TabType.stats)} />
          <NavItem icon="⚙️" label="Settings" active={activeTab === TabType.settings} onClick={() => onNavClick(TabType.settings)} />

        </div>
      </nav>
    </div>
  );
};

// ===============================
// NAV ITEM
// ===============================
const NavItem: React.FC<{
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center transition-all active:scale-90"
    >
      <span className={active ? "text-white" : "text-white/40"}>
        {icon}
      </span>
      <span className="text-[9px]">{label}</span>
    </button>
  );
};