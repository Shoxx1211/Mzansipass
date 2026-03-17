
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onNavClick: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onNavClick }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center">
      <header className="w-full max-w-md px-6 py-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            MzansiPass
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Premium Transit</p>
        </div>
        <div className="w-10 h-10 rounded-full glass flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
          <img src="https://picsum.photos/seed/mzansi/100/100" alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-md px-6 pb-24">
        {children}
      </main>
      
      <nav className="fixed bottom-0 w-full max-w-md glass border-t border-white/10 px-8 py-4 flex justify-around items-center rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-50">
        <NavItem icon="🏠" id="home" active={activeTab === 'home'} onClick={() => onNavClick('home')} />
        <NavItem icon="📊" id="stats" active={activeTab === 'stats'} onClick={() => onNavClick('stats')} />
        <NavItem icon="⚙️" id="settings" active={activeTab === 'settings'} onClick={() => onNavClick('settings')} />
      </nav>
    </div>
  );
};

const NavItem: React.FC<{ icon: string; id: string; active?: boolean; onClick: () => void }> = ({ icon, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`p-2 transition-all duration-300 transform active:scale-90 ${active ? 'scale-110 opacity-100' : 'opacity-40 grayscale hover:opacity-70'}`}
  >
    <span className="text-2xl">{icon}</span>
    {active && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mx-auto mt-1 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
  </button>
);
