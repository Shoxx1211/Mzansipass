// src/components/Layout.tsx
// Pulse Transit - Responsive Application Layout

import React, { memo, useState } from "react";
import type { ReactNode } from "react";
import { TabType } from "../types";

// ======================================================
// TYPES
// ======================================================

interface LayoutProps {
  activeTab: TabType;
  onNavClick: (tab: TabType) => void;
  children: ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  enableGestures?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  description: string;
}

// ======================================================
// NAVIGATION
// ======================================================

// Keep beta navigation deliberately small. The AI navigator remains implemented
// in the codebase and can be restored to the tab bar when that product phase starts.
const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    description: "The rhythm of movement",
  },
  {
    id: "stats",
    label: "Stats",
    description: "Your trips",
  },
];

// ======================================================
// SIMPLE SVG ICONS
// Using SVG instead of emoji prevents encoding problems.
// ======================================================

const PulseMark = () => (
  <svg
    width="21"
    height="21"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12h4l2.2-4.2 3.1 8.4 2.7-5.2 2 1H22" />
    <circle cx="22" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const HomeIcon = ({ }: { active?: boolean }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const StatsIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 16v-4" />
    <path d="M12 16V8" />
    <path d="M16 16v-6" />
    <path d="M20 16V4" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);


// ======================================================
// NAV BUTTON
// ======================================================

const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}> = memo(({ item, isActive, onClick }) => {
  const [isPressed, setIsPressed] = useState(false);

  const Icon = item.id === "home" ? HomeIcon : StatsIcon;

  return (
    <button
      type="button"
      aria-label={item.description}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`
        relative flex min-w-0 flex-1 items-center justify-center gap-2
        rounded-2xl px-3 py-3 text-xs font-bold
        transition-all duration-200
        ${isActive
          ? "bg-white/[0.09] text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          : "text-white/40 hover:bg-white/[0.045] hover:text-white/75"
        }
        ${isPressed ? "scale-[0.97]" : "scale-100"}
      `}
    >
      <span
        className={`
          flex h-8 w-8 items-center justify-center rounded-xl transition-all
          ${isActive
            ? "bg-gradient-to-br from-cyan-400/20 to-emerald-400/15 text-cyan-200"
            : "text-white/45"
          }
        `}
      >
        <Icon active={isActive} />
      </span>

      <span className="hidden sm:inline">
        {item.label}
      </span>

      {isActive && (
        <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-cyan-300 sm:hidden" />
      )}
    </button>
  );
});

NavButton.displayName = "NavButton";

// ======================================================
// HEADER
// ======================================================

const Header: React.FC<{
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onGoHome: () => void;
}> = ({ title, subtitle, showBack, onBack, onGoHome }) => {
  const productHome = title === "Pulse Transit";

  return (
    <header className="sticky top-0 z-30 safe-top">
      <div className="premium-glass border-x-0 border-t-0 rounded-none">
        <div className="mx-auto flex min-h-[62px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-white/80 transition hover:bg-white/[0.09] active:scale-95"
              >
                <ArrowLeftIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoHome}
                title="Go to Home"
                aria-label="Pulse — go to Home"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#031019] shadow-[0_8px_30px_rgba(34,211,238,0.16)] transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <PulseMark />
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGoHome}
                  aria-label="Pulse — go to Home"
                  className="min-w-0 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  <h1 className="truncate text-[15px] font-black tracking-[-0.02em] text-white sm:text-base">
                    {productHome ? "Pulse" : title}
                  </h1>
                </button>

                {productHome && (
                  <span className="hidden rounded-full bg-white/[0.055] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35 sm:inline">
                    South Africa
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="truncate text-[10px] font-medium text-white/30 sm:text-[11px]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5">
            <span className="live-dot" />
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
              Ready
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

// ======================================================
// MAIN LAYOUT
// ======================================================

export const Layout = memo<LayoutProps>(
  ({
    activeTab,
    onNavClick,
    children,
    showBackButton = false,
    onBack,
    title,
    subtitle,
    showHeader = true,
    enableGestures = false,
  }) => {
    const [isVisible] = useState(true);

    const currentTabInfo = NAV_ITEMS.find(
      (item) => item.id === activeTab
    );

    return (
      <div className="min-h-screen w-full bg-transparent text-white">
        {/* HEADER */}
        {showHeader && (
          <Header
            title={
              title ||
              (currentTabInfo?.label === "Home"
                ? "Pulse Transit"
                : currentTabInfo?.label)
            }
            subtitle={subtitle || currentTabInfo?.description}
            onGoHome={() => onNavClick("home")}
            showBack={showBackButton}
            onBack={onBack}
          />
        )}

        {/* MAIN CONTENT */}
        <main
          className={`
            relative
            z-10
            w-full
            transition-all
            duration-300
            ${showHeader ? "pt-0" : "pt-safe-top"}
            pb-28
          `}
        >
          <div
            className="
              mx-auto
              w-full
              max-w-[1400px]
              px-4
              sm:px-6
              lg:px-8
              xl:px-10
            "
          >
            {children}
          </div>
        </main>

        {/* BOTTOM NAVIGATION */}
        <nav
          className={`
            fixed bottom-4 left-1/2 z-50
            w-[calc(100%-24px)] max-w-[430px]
            -translate-x-1/2
            premium-glass rounded-[24px] p-1.5 safe-bottom
            transition-all duration-300
            ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
          `}
        >
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => {
                  onNavClick(item.id);

                  if (
                    typeof navigator !== "undefined" &&
                    "vibrate" in navigator
                  ) {
                    navigator.vibrate?.(5);
                  }
                }}
              />
            ))}
          </div>

          {enableGestures && (
            <div className="flex justify-center pt-1">
              <div className="h-0.5 w-12 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-300/70 transition-all duration-300"
                  style={{
                    width: `${((NAV_ITEMS.findIndex((i) => i.id === activeTab) + 1) / NAV_ITEMS.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </nav>

      </div>
    );
  }
);

Layout.displayName = "Layout";