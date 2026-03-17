
import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';

const TicketCounter: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user, prasaTickets } = useData();

  // Filter sales records by search query
  const filteredTickets = prasaTickets.filter(ticket => 
    ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticketType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const app = filteredTickets.filter(t => t.source === 'App').length;
    const counter = filteredTickets.filter(t => t.source === 'Counter').length;
    const revenue = filteredTickets.reduce((acc, t) => acc + t.fare, 0);
    return { total, app, counter, revenue };
  }, [filteredTickets]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-rea-gray-dark p-8 rounded-3xl border border-white/5 shadow-2xl space-y-4 md:space-y-0">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-widest italic text-white">Sales Monitor</h3>
            <p className="text-rea-gray-light text-sm mt-1">Real-time audit of digital ticket issuance across the MzansiPass network.</p>
          </div>
          <div className="flex items-center space-x-2 bg-admin-accent/10 px-4 py-2 rounded-xl border border-admin-accent/20">
              <span className="w-2 h-2 bg-admin-accent rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-admin-accent">Live Feed Active</span>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-rea-gray-light">Total Network Sales</p>
              <h4 className="text-3xl font-black text-white mt-1">{stats.total}</h4>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 border-blue-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">App Conversions</p>
              <h4 className="text-3xl font-black text-white mt-1">{stats.app}</h4>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 border-rea-red/20 opacity-50">
              <p className="text-[10px] font-black uppercase tracking-widest text-rea-red">Legacy Counter</p>
              <h4 className="text-3xl font-black text-white mt-1">{stats.counter}</h4>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-rea-gray-light">Gross Revenue (ZAR)</p>
              <h4 className="text-2xl font-black text-green-500 mt-1">R {stats.revenue.toLocaleString()}</h4>
          </div>
      </div>

      <div className="bg-rea-gray-dark rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
            <div className="flex items-center space-x-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-white">Consolidated Ledger</h4>
                <div className="flex space-x-2">
                    <span className="flex items-center text-[9px] font-black uppercase text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                        <div className="w-1 h-1 bg-blue-500 rounded-full mr-1"></div>
                        Digital App
                    </span>
                    <span className="flex items-center text-[9px] font-black uppercase text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        <div className="w-1 h-1 bg-gray-500 rounded-full mr-1"></div>
                        Manual/Other
                    </span>
                </div>
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Node ID: {user.providerAccess || 'Global'}-SEC-2025</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-rea-gray-light border-b border-white/5">
              <tr>
                <th className="px-8 py-5">Asset Reference</th>
                <th className="px-8 py-5">Issuance Channel</th>
                <th className="px-8 py-5">Classification</th>
                <th className="px-8 py-5">Route Node</th>
                <th className="px-8 py-5 text-right">Settlement (ZAR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTickets.map(ticket => (
                <tr key={ticket.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6 font-mono text-xs text-white">#PR-{ticket.id.slice(-6).toUpperCase()}</td>
                  <td className="px-8 py-6">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${ticket.source === 'App' ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-gray-400'}`}>
                          {ticket.source === 'App' ? 'Mobile App' : 'Counter'}
                      </span>
                  </td>
                  <td className="px-8 py-6">
                      <span className="text-[10px] font-black uppercase text-rea-gray-light bg-white/5 px-2 py-1 rounded">
                          {ticket.ticketType}
                      </span>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-rea-gray-light">
                      {ticket.from} <span className="mx-2 text-gray-700">→</span> {ticket.to}
                  </td>
                  <td className="px-8 py-6 text-right font-black text-white">R {ticket.fare.toFixed(2)}</td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-500 italic">No network traffic recorded for this query.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TicketCounter;
