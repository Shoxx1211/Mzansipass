// src/components/Layout.tsx
// Pulse Transit - Premium Layout Component
// Features: Safe area handling, gesture navigation, animated transitions, haptic feedback

import React, { useState, memo } from "react";
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
  icon: string;
  activeIcon: string;
  description: string;
}

// ======================================================
// CONSTANTS
// ======================================================
const NAV_ITEMS: NavItem[] = [
  { 
    id: "home", 
    label: "Home", 
    icon: "🏠", 
    activeIcon: "🏠",
    description: "Plan your journey"
  },
  { 
    id: "navigate", 
    label: "Navigate", 
    icon: "🤖", 
    activeIcon: "🤖",
    description: "AI assistant"
  },
  { 
    id: "stats", 
    label: "Stats", 
    icon: "📊", 
    activeIcon: "📊",
    description: "Your trips"
  }
];

// ======================================================
// CUSTOM HOOKS
// ======================================================

// ======================================================
// SUB-COMPONENTS
// ======================================================
const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}> = memo(({ item, isActive, onClick }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`
        relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl
        transition-all duration-200
        ${isActive 
          ? "text-cyan-400" 
          : "text-white/50 hover:text-white/70"
        }
        ${isPressed ? "scale-95" : "scale-100"}
      `}
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
      )}
      
      <span className="text-2xl transition-transform duration-200">
        {item.icon}
      </span>
      
      <span className="text-[10px] font-medium tracking-wide">
        {item.label}
      </span>
      
      {/* Ripple Effect on Active */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl bg-cyan-400/5 animate-pulse" />
      )}
    </button>
  );
});

NavButton.displayName = "NavButton";

const Header: React.FC<{
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}> = ({ title, subtitle, showBack, onBack }) => {
  return (
    <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 safe-top">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center active:scale-95 transition-all"
            >
              <span className="text-xl">←</span>
            </button>
          )}
          <div>
            {title && (
              <h1 className="text-xl font-bold text-white">{title}</h1>
            )}
            {subtitle && (
              <p className="text-xs text-white/40">{subtitle}</p>
            )}
          </div>
        </div>
        
        {/* Pulse Logo */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/30 font-mono">LIVE</span>
        </div>
      </div>
    </div>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================
export const Layout = memo<LayoutProps>(({ 
  activeTab, 
  onNavClick, 
  children,
  showBackButton = false,
  onBack,
  title,
  subtitle,
  showHeader = true,
  enableGestures = false
}) => {
  const [isVisible] = useState(true);
  

  // Handle swipe gestures for tab navigation


  //useSwipeGesture(handleSwipeLeft, handleSwipeRight, enableGestures);

  // Hide nav on scroll (for better UX)
  //eEffect(() => {
  //const handleScroll = () => {
    //const currentScrollY = window.scrollY;
    //if (currentScrollY > lastScrollY && currentScrollY > 100) {
     // setIsVisible(false);
    //} else {
      //setIsVisible(true);
    //}
    //setLastScrollY(currentScrollY);
  //};

  //window.addEventListener('scroll', handleScroll);
  //return () => window.removeEventListener('scroll', handleScroll);
//}, [lastScrollY]);

  // Get current tab info for header
  const currentTabInfo = NAV_ITEMS.find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Optional Header */}
      {showHeader && (
        <Header 
          title={title || (currentTabInfo?.label === "Home" ? "Pulse Transit" : currentTabInfo?.label)}
          subtitle={subtitle || currentTabInfo?.description}
          showBack={showBackButton}
          onBack={onBack}
        />
      )}
      
      {/* Main Content with Safe Areas */}
      <main 
        className={`
          relative z-10 transition-all duration-300
          ${showHeader ? 'pt-0' : 'pt-safe-top'}
          pb-24
        `}
      >
        <div className="max-w-md mx-auto">
          {children}
        </div>
      </main>
      
      {/* Bottom Navigation with Hide on Scroll */}
      <nav 
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-black/95 backdrop-blur-xl
          border-t border-white/10
          transition-transform duration-300
          ${isVisible ? 'translate-y-0' : 'translate-y-full'}
          safe-bottom
        `}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                onClick={() => {
                  onNavClick(item.id);
                  // Haptic feedback on navigation
                  if ('vibrate' in navigator) {
                    navigator.vibrate(5);
                  }
                }}
              />
            ))}
          </div>
          
          {/* Swipe Indicator */}
          {enableGestures && (
            <div className="flex justify-center pb-2">
              <div className="w-12 h-1 rounded-full bg-white/20">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ 
                    width: `${((NAV_ITEMS.findIndex(i => i.id === activeTab) + 1) / NAV_ITEMS.length) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Floating Action Button (for quick actions) */}
      {activeTab === "home" && (
        <button
          onClick={() => onNavClick("navigate")}
          className="
            fixed bottom-28 right-4 z-20
            w-14 h-14 rounded-full
            bg-gradient-to-r from-cyan-500 to-emerald-500
            shadow-lg shadow-cyan-500/25
            flex items-center justify-center
            transition-all duration-200
            hover:scale-110 active:scale-95
            animate-bounce-slow
          "
        >
          <span className="text-2xl">🤖</span>
        </button>
      )}
    </div>
  );
});

Layout.displayName = "Layout";

// ======================================================
// SAFE AREA CSS (Add to your global CSS)
// ======================================================
// .safe-top {
//   padding-top: constant(safe-area-inset-top);
//   padding-top: env(safe-area-inset-top);
// }
// 
// .safe-bottom {
//   padding-bottom: constant(safe-area-inset-bottom);
//   padding-bottom: env(safe-area-inset-bottom);
// }
// 
// @keyframes bounce-slow {
//   0%, 100% { transform: translateY(0); }
//   50% { transform: translateY(-8px); }
// }
// 
// .animate-bounce-slow {
//   animation: bounce-slow 2s ease-in-out infinite;
// }