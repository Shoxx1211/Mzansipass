// src/components/Layout.tsx

import React, {
  useEffect,
  useMemo,
  useState
} from "react";

import { TabType } from "../types";
import PulseLogo from "./PulseLogo";

// ======================================================
// TYPES
// ======================================================
interface LayoutProps {
  children: React.ReactNode;

  activeTab: TabType;

  onNavClick: (
    tab: TabType
  ) => void;
}

// ======================================================
// STORAGE
// ======================================================
const STORAGE = {
  installDismissed:
    "pulse_install_dismissed"
};

// ======================================================
// COMPONENT
// ======================================================
export const Layout:
React.FC<LayoutProps> = ({
  children,
  activeTab,
  onNavClick
}) => {

  // ======================================================
  // INSTALL PROMPT
  // ======================================================
  const [
    deferredPrompt,
    setDeferredPrompt
  ] = useState<any>(null);

  const [
    showInstallBanner,
    setShowInstallBanner
  ] = useState(false);

  // ======================================================
  // ONLINE STATUS
  // ======================================================
  const [
    isOnline,
    setIsOnline
  ] = useState(
    navigator.onLine
  );

  // ======================================================
  // INSTALL LISTENER
  // ======================================================
  useEffect(() => {

    const dismissed =
      localStorage.getItem(
        STORAGE.installDismissed
      );

    const handler = (
      e: any
    ) => {

      e.preventDefault();

      setDeferredPrompt(e);

      if (!dismissed) {

        setShowInstallBanner(
          true
        );

      }

    };

    window.addEventListener(
      "beforeinstallprompt",
      handler
    );

    return () => {

      window.removeEventListener(
        "beforeinstallprompt",
        handler
      );

    };

  }, []);

  // ======================================================
  // ONLINE/OFFLINE
  // ======================================================
  useEffect(() => {

    const goOnline = () =>
      setIsOnline(true);

    const goOffline = () =>
      setIsOnline(false);

    window.addEventListener(
      "online",
      goOnline
    );

    window.addEventListener(
      "offline",
      goOffline
    );

    return () => {

      window.removeEventListener(
        "online",
        goOnline
      );

      window.removeEventListener(
        "offline",
        goOffline
      );

    };

  }, []);

  // ======================================================
  // INSTALL ACTION
  // ======================================================
  const handleInstall =
    async () => {

      if (!deferredPrompt) {
        return;
      }

      deferredPrompt.prompt();

      const choice =
        await deferredPrompt.userChoice;

      if (
        choice.outcome !==
        "accepted"
      ) {

        localStorage.setItem(
          STORAGE.installDismissed,
          "true"
        );

      }

      setDeferredPrompt(null);

      setShowInstallBanner(
        false
      );

    };

  // ======================================================
  // DISMISS INSTALL
  // ======================================================
  const dismissInstall =
    () => {

      localStorage.setItem(
        STORAGE.installDismissed,
        "true"
      );

      setShowInstallBanner(
        false
      );

    };

  // ======================================================
  // HEADER LOGIC
  // ======================================================
  const header =
    useMemo(() => {

      switch (
        activeTab
      ) {

        case TabType.home:

          return {
            title:
              "Start Journey",

            subtitle:
              "Premium smart mobility"
          };

        case TabType.pulse:

          return {
            title:
              "Live Pulse",

            subtitle:
              "Transit intelligence"
          };

        case TabType.stats:

          return {
            title:
              "Trip History",

            subtitle:
              "Travel analytics"
          };

        case TabType.settings:

          return {
            title:
              "Settings",

            subtitle:
              "Customize experience"
          };

        default:

          return {
            title:
              "Pulse",

            subtitle:
              "Urban mobility"
          };

      }

    }, [activeTab]);

  // ======================================================
  // SAVE TAB
  // ======================================================
  useEffect(() => {

    localStorage.setItem(
      "pulse_active_tab",
      activeTab
    );

  }, [activeTab]);

  // ======================================================
  // IOS DETECTION
  // ======================================================
  const isIOS =
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );

  const isStandalone =
    (window.navigator as any)
      .standalone ||
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches;

  // ======================================================
  // UI
  // ======================================================
  return (

    <div
  className="
    relative
    min-h-screen
    overflow-x-hidden
    overflow-y-auto
    bg-[#050816]
    text-white
  "
>

      {/* ======================================================
          BACKGROUND
      ====================================================== */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          overflow-hidden
        "
      >

        <div
          className="
            absolute
            -top-32
            -left-32
            h-[420px]
            w-[420px]
            rounded-full
            bg-emerald-500/10
            blur-3xl
          "
        />

        <div
          className="
            absolute
            bottom-[-180px]
            right-[-180px]
            h-[420px]
            w-[420px]
            rounded-full
            bg-cyan-500/10
            blur-3xl
          "
        />

      </div>

      {/* ======================================================
          INSTALL BANNER
      ====================================================== */}
      {showInstallBanner && (

        <div
          className="
            fixed
            top-4
            left-0
            right-0
            z-[100]
            flex
            justify-center
            px-4
          "
        >

          <div
            className="
              w-full
              max-w-md
              rounded-3xl
              border
              border-white/10
              bg-black/60
              p-4
              backdrop-blur-2xl
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                gap-3
              "
            >

              <div>

                <p
                  className="
                    text-sm
                    font-bold
                  "
                >
                  Install Pulse
                </p>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-white/50
                  "
                >
                  Faster access and offline support
                </p>

              </div>

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <button
                  onClick={
                    handleInstall
                  }
                  className="
                    rounded-2xl
                    bg-emerald-500
                    px-4
                    py-2
                    text-xs
                    font-bold
                  "
                >
                  Install
                </button>

                <button
                  onClick={
                    dismissInstall
                  }
                  className="
                    text-sm
                    text-white/40
                  "
                >
                  ✕
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          IOS INSTALL
      ====================================================== */}
      {isIOS &&
        !isStandalone && (

        <div
          className="
            fixed
            bottom-28
            left-0
            right-0
            z-40
            flex
            justify-center
            px-4
          "
        >

          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              border
              border-white/10
              bg-black/60
              p-3
              text-center
              text-xs
              text-white/70
              backdrop-blur-xl
            "
          >
            Tap Share → Add to Home Screen
          </div>

        </div>

      )}

      {/* ======================================================
          APP SHELL
      ====================================================== */}
      <div
        className="
          relative
          z-10
          mx-auto
          flex
          min-h-screen
          w-full
          max-w-md
          flex-col
        "
      >

        {/* ======================================================
            HEADER
        ====================================================== */}
        <header
          className="
            sticky
            top-0
            z-40
            border-b
            border-white/[0.03]
            bg-[#050816]/80
            px-5
            pt-[max(env(safe-area-inset-top),1.5rem)]
            pb-5
            backdrop-blur-2xl
          "
        >

          <div
            className="
              flex
              items-start
              justify-between
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/5
                  backdrop-blur-xl
                "
              >

                <PulseLogo
                  size={30}
                />

              </div>

              <div>

                <h1
                  className="
                    text-[1.35rem]
                    font-black
                    tracking-tight
                    leading-none
                  "
                >
                  {header.title}
                </h1>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-white/45
                  "
                >
                  {header.subtitle}
                </p>

                {!isOnline && (

                  <p
                    className="
                      mt-1
                      text-[10px]
                      text-red-400
                    "
                  >
                    Offline mode
                  </p>

                )}

              </div>

            </div>

            {/* PROFILE */}
            <div
              className="
                h-11
                w-11
                overflow-hidden
                rounded-2xl
                border
                border-white/10
                bg-white/5
              "
            >

              <img
                src="https://picsum.photos/100"
                alt="avatar"
                className="
                  h-full
                  w-full
                  object-cover
                "
              />

            </div>

          </div>

        </header>

        {/* ======================================================
            CONTENT
        ====================================================== */}
       <main
  className="
    flex-1
    px-5
    pb-40
    overflow-y-auto
    overflow-x-hidden
    overscroll-y-contain
  "
>
          {children}
        </main>

      </div>

      {/* ======================================================
          NAVBAR
      ====================================================== */}
      <nav
        className="
          fixed
          bottom-[max(env(safe-area-inset-bottom),1rem)]
          left-0
          right-0
          z-50
          flex
          justify-center
          px-4
          pointer-events-none
        "
      >

        <div
          className="
            pointer-events-auto
            w-full
            max-w-md
            rounded-[2rem]
            border
            border-white/10
            bg-black/60
            px-4
            py-3
            backdrop-blur-2xl
            shadow-2xl
            shadow-black/40
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
            "
          >

            <NavItem
              icon="🏠"
              label="Home"
              active={
                activeTab ===
                TabType.home
              }
              onClick={() =>
                onNavClick(
                  TabType.home
                )
              }
            />

            <NavItem
              icon="📡"
              label="Pulse"
              active={
                activeTab ===
                TabType.pulse
              }
              onClick={() =>
                onNavClick(
                  TabType.pulse
                )
              }
            />

            <NavItem
              icon="📊"
              label="Stats"
              active={
                activeTab ===
                TabType.stats
              }
              onClick={() =>
                onNavClick(
                  TabType.stats
                )
              }
            />

            <NavItem
              icon="⚙️"
              label="Settings"
              active={
                activeTab ===
                TabType.settings
              }
              onClick={() =>
                onNavClick(
                  TabType.settings
                )
              }
            />

          </div>

        </div>

      </nav>

    </div>

  );

};

// ======================================================
// NAV ITEM
// ======================================================
const NavItem:
React.FC<{
  icon: string;

  label: string;

  active?: boolean;

  onClick: () => void;
}> = ({
  icon,
  label,
  active,
  onClick
}) => {

  return (

    <button
      onClick={onClick}
      className="
        flex
        min-w-[58px]
        flex-col
        items-center
        justify-center
        gap-1
        transition-all
        active:scale-95
      "
    >

      <div
        className={`
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-2xl
          text-lg
          transition-all
          duration-300

          ${
            active
              ? `
                bg-emerald-500
                text-white
                shadow-lg
                shadow-emerald-500/20
              `
              : `
                bg-white/5
                text-white/45
              `
          }
        `}
      >
        {icon}
      </div>

      <span
        className={`
          text-[10px]
          font-medium

          ${
            active
              ? "text-white"
              : "text-white/45"
          }
        `}
      >
        {label}
      </span>

    </button>

  );

};