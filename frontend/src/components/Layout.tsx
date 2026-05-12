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
              "Simple smart transport"
          };

        case TabType.pulse:

          return {
            title:
              "Live Pulse",

            subtitle:
              "Transport intelligence"
          };

        case TabType.stats:

          return {
            title:
              "Trip History",

            subtitle:
              "Your travel insights"
          };

        case TabType.settings:

          return {
            title:
              "Settings",

            subtitle:
              "Customize Pulse"
          };

        default:

          return {
            title:
              "Pulse",

            subtitle:
              "Smart mobility"
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
        min-h-screen
        bg-[#050816]
        text-white
        relative
        overflow-x-hidden
      "
    >

      {/* ======================================================
          BACKGROUND
      ====================================================== */}
      <div
        className="
          absolute
          top-[-120px]
          left-[-120px]
          w-[320px]
          h-[320px]
          bg-emerald-500/10
          rounded-full
          blur-3xl
        "
      />

      <div
        className="
          absolute
          bottom-[-120px]
          right-[-120px]
          w-[320px]
          h-[320px]
          bg-blue-500/10
          rounded-full
          blur-3xl
        "
      />

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
            z-50
            px-4
            flex
            justify-center
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
              backdrop-blur-xl
              p-4
              flex
              items-center
              justify-between
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
                  text-[11px]
                  text-white/50
                  mt-1
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
                  px-4
                  py-2
                  rounded-2xl
                  bg-emerald-500
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
                  text-white/40
                  text-sm
                "
              >
                ✕
              </button>

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
            bottom-24
            left-0
            right-0
            z-40
            px-4
            flex
            justify-center
          "
        >

          <div
            className="
              w-full
              max-w-md
              rounded-2xl
              bg-black/60
              border
              border-white/10
              backdrop-blur-xl
              p-3
              text-center
              text-xs
              text-white/70
            "
          >
            Tap Share →
            Add to Home Screen
          </div>

        </div>

      )}

      {/* ======================================================
          MAIN WRAPPER
      ====================================================== */}
      <div
        className="
          relative
          z-10
          w-full
          max-w-md
          mx-auto
          min-h-screen
          flex
          flex-col
        "
      >

        {/* ======================================================
            HEADER
        ====================================================== */}
        <header
          className="
            px-5
            pt-8
            pb-5
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
                  w-12
                  h-12
                  rounded-2xl
                  bg-white/5
                  border
                  border-white/10
                  flex
                  items-center
                  justify-center
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
                    text-xl
                    font-black
                    leading-none
                  "
                >
                  {header.title}
                </h1>

                <p
                  className="
                    text-[11px]
                    text-white/45
                    mt-1
                  "
                >
                  {
                    header.subtitle
                  }
                </p>

                {!isOnline && (

                  <p
                    className="
                      text-[10px]
                      text-red-400
                      mt-1
                    "
                  >
                    Offline mode
                  </p>

                )}

              </div>

            </div>

            <div
              className="
                w-11
                h-11
                rounded-2xl
                bg-white/5
                border
                border-white/10
                overflow-x-hidden
              "
            >

              <img
                src="https://picsum.photos/100"
                alt="avatar"
                className="
                  w-full
                  h-full
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
            pb-32
          "
        >
          {children}
        </main>

      </div>

      {/* ======================================================
          BOTTOM NAV
      ====================================================== */}
      <nav
        className="
          fixed
          bottom-5
          left-0
          right-0
          z-50
          px-4
          flex
          justify-center
        "
      >

        <div
          className="
            w-full
            max-w-md
            rounded-[2rem]
            border
            border-white/10
            bg-black/60
            backdrop-blur-2xl
            px-4
            py-3
            flex
            justify-between
            items-center
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
        flex-col
        items-center
        justify-center
        gap-1
        transition-all
        active:scale-90
        min-w-[56px]
      "
    >

      <div
        className={`
          w-11
          h-11
          rounded-2xl
          flex
          items-center
          justify-center
          text-lg
          transition-all
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