
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import { GoogleGenAI } from '@google/genai';

const StatCard: React.FC<{ label: string; value: string; sub: string; icon: string; trend: 'up' | 'down'; color?: string }> = ({ label, value, sub, icon, trend, color = "text-rea-red" }) => (
  <div className="bg-rea-gray-dark p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-all cursor-default">
    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
        <Icon name={icon} className="w-24 h-24" />
    </div>
    <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className={`p-4 bg-white/5 rounded-2xl ${color} group-hover:bg-white/10 transition-all`}>
            <Icon name={icon} className="w-6 h-6" />
          </div>
          <div className={`flex items-center space-x-1 text-[10px] font-black px-3 py-1.5 rounded-full ${trend === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            <span>{trend === 'up' ? '↑' : '↓'}</span>
            <span>12.4%</span>
          </div>
        </div>
        <p className="text-[10px] text-rea-gray-light font-black uppercase tracking-[0.2em]">{label}</p>
        <h3 className="text-4xl font-black mt-2 tracking-tighter text-white">{value}</h3>
        <p className="text-xs text-gray-500 mt-3 font-medium">{sub}</p>
    </div>
  </div>
);

const AdminDashboard: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user, trips, transitAlerts, fleet, prasaTickets } = useData();
  const [briefing, setBriefing] = useState<string>('');
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  // Filter core data based on administrator's provider access
  const agencyTrips = trips.filter(t => !user.providerAccess || t.provider === user.providerAccess);
  const agencyAlerts = transitAlerts.filter(a => !user.providerAccess || a.provider === user.providerAccess);
  const agencyFleet = fleet.filter(v => !user.providerAccess || v.provider === user.providerAccess);
  
  // Calculate revenue. For PRASA, revenue is primarily from ticket sales.
  const revenueTotal = useMemo(() => {
    if (user.providerAccess === 'PRASA') {
      return prasaTickets.reduce((acc, t) => acc + t.fare, 0);
    }
    return agencyTrips.reduce((acc, t) => acc + t.fare, 0);
  }, [user.providerAccess, prasaTickets, agencyTrips]);

  const salesByChannel = useMemo(() => {
    const appSales = prasaTickets.filter(t => t.source === 'App').length;
    const counterSales = prasaTickets.filter(t => t.source === 'Counter').length;
    return { appSales, counterSales };
  }, [prasaTickets]);

  useEffect(() => {
    const fetchAIBriefing = async () => {
      if (!process.env.API_KEY) return;
      setLoadingBriefing(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const providerName = user.providerAccess || 'MzansiPass Network';
      
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `You are the MzansiPass Network Intelligence Engine. 
          Provide a high-level executive summary (briefing) for the transport provider: ${providerName}.
          Current Network Status: ${user.providerAccess === 'PRASA' ? prasaTickets.length : agencyTrips.length} active transactions, ${agencyAlerts.length} active alerts.
          Revenue to date: R ${revenueTotal.toLocaleString()}.
          Focus on efficiency, safety, and revenue growth. Keep it professional, data-driven, and under 100 words.`,
        });
        setBriefing(response.text || '');
      } catch (e) {
        console.error("AI Briefing failed", e);
        setBriefing("Operational integrity maintained. Network occupancy is within nominal range. Monitor evening peak load patterns for optimal asset allocation.");
      } finally {
        setLoadingBriefing(false);
      }
    };
    fetchAIBriefing();
  }, [user.providerAccess, agencyTrips.length, agencyAlerts.length, revenueTotal, prasaTickets.length]);

  const filteredTrips = agencyTrips.filter(trip => 
    trip.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trip.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trip.to.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPrasa = prasaTickets.filter(ticket =>
    ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.to.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Verification Header */}
      <div className="bg-admin-accent/5 border border-admin-accent/20 rounded-3xl p-6 flex items-center justify-between">
          <div className="flex items-center space-x-6">
              <div className="w-12 h-12 bg-admin-accent rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <Icon name="check-circle" className="w-7 h-7 text-white" />
              </div>
              <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Verified {user.providerAccess} Node</h2>
                  <p className="text-[10px] text-admin-accent font-black uppercase tracking-widest mt-1 opacity-80">Connected to National Clearing House and Commuter App Stream</p>
              </div>
          </div>
          <div className="text-right">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Active Session ID</p>
              <p className="text-xs font-mono font-bold text-white mt-1">SES-MP-2025-{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Agency Daily Commuters" value={user.providerAccess === 'PRASA' ? prasaTickets.length.toLocaleString() : (agencyTrips.length * 42).toLocaleString()} sub="Estimated from trip logs" icon="users" trend="up" color="text-admin-accent" />
        <StatCard label="Revenue (ZAR)" value={`R ${revenueTotal.toLocaleString()}`} sub="Current collection period" icon="wallet" trend="up" />
        <StatCard label="Network Health" value={`${agencyAlerts.length === 0 ? '100%' : '88%'}`} sub="Infrastructure Status" icon="activity" trend="up" color="text-green-500" />
      </div>

      {user.providerAccess === 'PRASA' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-rea-gray-dark p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-rea-gray-light font-black uppercase tracking-widest">Mobile App Sales</p>
                    <h4 className="text-2xl font-black text-white mt-1">{salesByChannel.appSales}</h4>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Icon name="sparkles" className="w-6 h-6" />
                </div>
            </div>
            <div className="bg-rea-gray-dark p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-rea-gray-light font-black uppercase tracking-widest">Counter Agent Sales</p>
                    <h4 className="text-2xl font-black text-white mt-1">{salesByChannel.counterSales}</h4>
                </div>
                <div className="p-3 bg-rea-red/10 rounded-xl text-rea-red">
                    <Icon name="ticket" className="w-6 h-6" />
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-gradient-to-br from-rea-gray-dark to-black p-10 rounded-3xl border border-white/5 shadow-2xl flex flex-col justify-between">
           <div>
              <div className="flex items-center space-x-3 mb-8">
                <div className="w-10 h-10 bg-rea-red/10 rounded-xl flex items-center justify-center">
                  <Icon name="sparkles" className="w-6 h-6 text-rea-red" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-widest italic">Intelligence Briefing</h3>
              </div>
              
              {loadingBriefing ? (
                <div className="space-y-4 animate-pulse">
                   <div className="h-4 bg-white/5 rounded w-full"></div>
                   <div className="h-4 bg-white/5 rounded w-5/6"></div>
                </div>
              ) : (
                <p className="text-rea-gray-light leading-relaxed font-medium text-lg">
                  {briefing}
                </p>
              )}
           </div>
           
           <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Powered by Gemini AI v3</p>
              <button className="text-xs font-black text-rea-red uppercase tracking-widest hover:brightness-125 transition-all">Full Analytics →</button>
           </div>
        </div>

        <div className="bg-rea-gray-dark p-8 rounded-3xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center">
              <Icon name="bell" className="w-4 h-4 mr-2 text-rea-red" />
              Agency Alerts
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {agencyAlerts.map(alert => (
                <div key={alert.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-rea-red uppercase tracking-widest">{alert.category}</span>
                    <span className="text-[10px] text-gray-600">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="text-xs font-black text-white mb-1">{alert.title}</h4>
                  <p className="text-[10px] text-rea-gray-light line-clamp-2">{alert.description}</p>
                </div>
              ))}
              {agencyAlerts.length === 0 && (
                <p className="text-center text-xs text-gray-600 py-10 italic">No alerts found for this agency</p>
              )}
            </div>
        </div>
      </div>

      <div className="bg-rea-gray-dark rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center">
              <Icon name="activity" className="w-4 h-4 mr-2 text-admin-accent" />
              {user.providerAccess || 'Network'} Operations Ledger
            </h3>
            <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Live Transaction Stream
            </span>
        </div>
        <div className="overflow-x-auto">
          {user.providerAccess === 'PRASA' ? (
            <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-rea-gray-light border-b border-white/5">
                <tr>
                    <th className="px-8 py-5">Ticket ID</th>
                    <th className="px-8 py-5">Route</th>
                    <th className="px-8 py-5">Source</th>
                    <th className="px-8 py-5 text-right">Fare (ZAR)</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                {filteredPrasa.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                        <span className="font-black text-white text-sm tracking-tight">{ticket.id.slice(-8).toUpperCase()}</span>
                    </td>
                    <td className="px-8 py-6 text-sm text-rea-gray-light font-bold">{ticket.from} → {ticket.to}</td>
                    <td className="px-8 py-6">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${ticket.source === 'App' ? 'bg-blue-500/10 text-blue-500' : 'bg-rea-red/10 text-rea-red'}`}>
                            {ticket.source}
                        </span>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-white text-sm">
                        R {ticket.fare.toFixed(2)}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-rea-gray-light border-b border-white/5">
                <tr>
                    <th className="px-8 py-5">Unit ID</th>
                    <th className="px-8 py-5">Departure Station</th>
                    <th className="px-8 py-5">Network Time</th>
                    <th className="px-8 py-5 text-right">Fare (ZAR)</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                {filteredTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-admin-accent rounded-full"></div>
                        <span className="font-black text-white text-sm tracking-tight">{trip.id}</span>
                        </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-rea-gray-light font-bold">{trip.from}</td>
                    <td className="px-8 py-6 text-sm text-gray-500 font-mono">
                        {new Date(trip.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-white text-sm">
                        R {trip.fare.toFixed(2)}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
