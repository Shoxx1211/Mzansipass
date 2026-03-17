
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import AdminDashboard from './AdminDashboard';
import IncidentManager from './IncidentManager';
import FleetTracker from './FleetTracker';
import FinancePortal from './FinancePortal';
import TicketCounter from './TicketCounter';
import BroadcastHub from './BroadcastHub';

type AdminPage = 'dashboard' | 'fleet' | 'reports' | 'finance' | 'sales' | 'broadcast';

const AdminPortal: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user } = useData();
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const renderContent = () => {
    switch(activePage) {
      case 'dashboard': return <AdminDashboard searchQuery={searchQuery} />;
      case 'fleet': return <FleetTracker searchQuery={searchQuery} />;
      case 'reports': return <IncidentManager searchQuery={searchQuery} />;
      case 'finance': return <FinancePortal searchQuery={searchQuery} />;
      case 'sales': return <TicketCounter searchQuery={searchQuery} />;
      case 'broadcast': return <BroadcastHub />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: 'home' },
    { id: 'fleet', label: 'Fleet Tracker', icon: 'bus' },
    { id: 'reports', label: 'Incident Desk', icon: 'alert-triangle' },
    { id: 'broadcast', label: 'Broadcast Hub', icon: 'sparkles' },
    { id: 'finance', label: 'Revenue/Settlement', icon: 'wallet' },
    { id: 'sales', label: 'Sales Monitor', icon: 'activity' },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-rea-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-rea-gray-dark border-r border-white/5 flex flex-col shadow-2xl z-20">
        <div className="p-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-rea-red rounded-lg flex items-center justify-center">
                <Icon name="nfc" className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">Mzansi<span className="text-rea-red">Pass</span></h1>
          </div>
          <div className="mt-6 py-2 px-4 bg-admin-accent/10 border border-admin-accent/20 rounded-xl">
             <p className="text-[10px] text-admin-accent font-black uppercase tracking-widest">Authorized Agency</p>
             <p className="text-sm font-bold text-white">{user.providerAccess || 'Transit Authority'}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id as AdminPage);
                setSearchQuery(''); 
              }}
              className={`w-full flex items-center space-x-3 px-5 py-4 rounded-xl font-bold transition-all group ${
                activePage === item.id 
                  ? 'bg-white/5 text-white border border-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]' 
                  : 'text-rea-gray-light hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <Icon name={item.icon} className={`w-5 h-5 ${activePage === item.id ? 'text-rea-red' : 'text-gray-600 group-hover:text-rea-gray-light'}`} />
              <span className="text-sm">{item.label}</span>
              {activePage === item.id && <div className="ml-auto w-1.5 h-1.5 bg-rea-red rounded-full shadow-[0_0_8px_rgba(229,9,20,1)]"></div>}
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-white/5 bg-black/20 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 overflow-hidden flex items-center justify-center">
                <Icon name="profile" className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">System Root</p>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Live Link
                </p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-gray-900 border border-white/5 text-rea-gray-light hover:text-white hover:bg-gray-800 transition-all">
            <Icon name="close" className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-rea-black/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center space-x-8 flex-1">
             <div className="flex items-center space-x-4 shrink-0">
                <div className="h-8 w-1 bg-rea-red rounded-full"></div>
                <h2 className="text-2xl font-black uppercase tracking-tight">{activePage.replace('-', ' ')}</h2>
             </div>

             <div className="max-w-md w-full relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                   <svg className="w-4 h-4 text-rea-gray-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search registry...`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm font-bold placeholder:text-rea-gray-light/40 focus:outline-none focus:ring-2 focus:ring-rea-red/50 focus:border-rea-red/50 transition-all"
                />
             </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-rea-gray-light font-black uppercase tracking-widest">Network Authority</p>
              <p className="text-sm font-bold text-white">Registry Active</p>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
    </div>
  );
};

export default AdminPortal;
