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

const NAV_ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    description: "Plan your journey",
  },
  {
    id: "navigate",
    label: "Navigate",
    description: "AI assistant",
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

const NavigateIcon = () => (
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
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.3 5.2-5.2 2.3 2.3-5.2 5.2-2.3Z" />
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

  const Icon =
    item.id === "home"
      ? HomeIcon
      : item.id === "navigate"
        ? NavigateIcon
        : StatsIcon;

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
        relative
        flex
        min-w-[72px]
        flex-1
        max-w-[140px]
        flex-col
        items-center
        justify-center
        gap-1.5
        rounded-2xl
        px-3
        py-2.5
        transition-all
        duration-200
        ${
          isActive
            ? "text-cyan-300"
            : "text-white/45 hover:text-white/80"
        }
        ${isPressed ? "scale-95" : "scale-100"}
      `}
    >
      {isActive && (
        <div
          className="
            absolute
            -top-2
            left-1/2
            h-1
            w-8
            -translate-x-1/2
            rounded-full
            bg-gradient-to-r
            from-cyan-400
            to-emerald-400
          "
        />
      )}

      <span
        className={`
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          transition-all
          ${
            isActive
              ? "bg-cyan-400/10 text-cyan-300"
              : "bg-white/[0.03]"
          }
        `}
      >
        <Icon active={isActive} />
      </span>

      <span className="text-[11px] font-semibold tracking-wide">
        {item.label}
      </span>
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
}> = ({ title, subtitle, showBack, onBack }) => {
  return (
    <header
      className="
        sticky
        top-0
        z-30
        border-b
        border-white/[0.06]
        bg-black/70
        px-4
        backdrop-blur-2xl
        safe-top
      "
    >
      <div
        className="
          mx-auto
          flex
          min-h-[68px]
          w-full
          max-w-[1400px]
          items-center
          justify-between
          gap-4
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-xl
                border
                border-white/10
                bg-white/[0.04]
                text-white
                transition
                hover:bg-white/[0.08]
                active:scale-95
              "
            >
              <ArrowLeftIcon />
            </button>
          )}

          <div className="min-w-0">
            {title && (
              <h1 className="truncate text-lg font-bold text-white sm:text-xl">
                {title}
              </h1>
            )}

            {subtitle && (
              <p className="truncate text-xs text-white/40 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="live-dot" />
          <span className="hidden text-[10px] font-semibold tracking-widest text-white/30 sm:block">
            LIVE
          </span>
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
            fixed
            bottom-0
            left-0
            right-0
            z-50
            border-t
            border-white/[0.08]
            bg-black/80
            backdrop-blur-2xl
            safe-bottom
            transition-transform
            duration-300
            ${
              isVisible
                ? "translate-y-0"
                : "translate-y-full"
            }
          `}
        >
          <div className="mx-auto w-full max-w-[900px] px-3 sm:px-6">
            <div className="flex items-center justify-center gap-2 py-2 sm:gap-8">
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
              <div className="flex justify-center pb-2">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="
                      h-full
                      rounded-full
                      bg-gradient-to-r
                      from-cyan-400
                      to-emerald-400
                      transition-all
                      duration-300
                    "
                    style={{
                      width: `${
                        ((NAV_ITEMS.findIndex(
                          (i) => i.id === activeTab
                        ) +
                          1) /
                          NAV_ITEMS.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* HOME FLOATING ACTION */}
        {activeTab === "home" && (
          <button
            type="button"
            onClick={() => onNavClick("navigate")}
            aria-label="Open navigation assistant"
            className="
              fixed
              bottom-24
              right-4
              z-40
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-full
              border
              border-white/10
              bg-gradient-to-br
              from-cyan-500
              to-emerald-500
              text-white
              shadow-lg
              shadow-cyan-500/20
              transition-all
              duration-200
              hover:scale-105
              active:scale-95
              sm:bottom-28
              sm:right-8
            "
          >
            <NavigateIcon />
          </button>
        )}
      </div>
    );
  }
);

Layout.displayName = "Layout";