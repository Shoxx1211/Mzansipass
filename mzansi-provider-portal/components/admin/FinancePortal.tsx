
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

type SettlementStatus = 'idle' | 'auditing' | 'confirming' | 'transmitting' | 'settled';

const FinancePortal: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user, trips } = useData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settlementStep, setSettlementStep] = useState<SettlementStatus>('idle');
  
  // Filter data based on administrator's provider access
  const agencyTrips = trips.filter(trip => 
    !user.providerAccess || trip.provider === user.providerAccess
  );

  const totalDaily = agencyTrips.reduce((acc, t) => acc + t.fare, 0);
  const expressFee = totalDaily * 0.015; // 1.5% Express Fee
  const netSettlement = totalDaily - expressFee;

  const filteredTrips = agencyTrips.filter(trip => 
    trip.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trip.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (trip.to && trip.to.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStartSettlement = () => {
    setSettlementStep('auditing');
    setTimeout(() => setSettlementStep('confirming'), 1500);
  };

  const handleFinalizeSettlement = () => {
    setSettlementStep('transmitting');
    setTimeout(() => setSettlementStep('settled'), 3000);
  };

  return (
    <div className="space-y-6 relative pb-24">
      <header className="mb-4">
        <h3 className="text-2xl font-bold uppercase tracking-tight">{user.providerAccess || 'Agency'} Revenue Hub</h3>
        <p className="text-rea-gray-light">Daily financial audit and liquidity management.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-rea-gray-dark p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10">
              <Icon name="wallet" className="w-20 h-20" />
          </div>
          <p className="text-rea-gray-light font-black uppercase tracking-widest text-[10px] mb-2">Unsettled Revenue (24h)</p>
          <h3 className="text-5xl font-black text-white tracking-tighter">R {totalDaily.toLocaleString()}</h3>
          <div className="mt-6 flex items-center space-x-2 text-green-400">
            <Icon name="activity" className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">+12.4% vs Daily Avg</span>
          </div>
        </div>

        <div className="bg-rea-gray-dark p-8 rounded-3xl border border-white/5 flex flex-col justify-between shadow-2xl">
          <div className="flex justify-between items-center">
             <span className="text-rea-gray-light font-black uppercase tracking-widest text-[10px]">Settlement Status</span>
             <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                 settlementStep === 'settled' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'
             }`}>
                 {settlementStep === 'settled' ? 'Funds Cleared' : 'Pending CCH Cycle'}
             </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-4 leading-relaxed font-medium uppercase">
              Funds are currently locked in the Central Clearing House (CCH) cycle. 
              {settlementStep === 'settled' ? ' Your account has been credited.' : ' Settlement expected in 18 hours.'}
          </p>
          <Button 
            variant={settlementStep === 'settled' ? 'ghost' : 'primary'} 
            className="mt-6 !py-4 !text-xs !rounded-xl bg-admin-accent/10 border border-admin-accent/20 text-admin-accent hover:bg-admin-accent hover:text-white transition-all font-black uppercase tracking-widest" 
            onClick={handleStartSettlement}
            disabled={settlementStep === 'settled'}
          >
              {settlementStep === 'settled' ? 'Settlement Complete' : 'Request Express Settlement'}
          </Button>
        </div>
      </div>

      <div className="bg-rea-gray-dark rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-6 bg-black/20 border-b border-white/5 flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-widest text-white">Daily Ledger Transactions</h4>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{filteredTrips.length} entries detected</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-rea-gray-light border-b border-white/5">
                    <tr>
                    <th className="px-8 py-5">Transaction ID</th>
                    <th className="px-8 py-5">Asset Node</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Fare (ZAR)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {filteredTrips.map(trip => (
                    <tr key={trip.id} className="text-sm hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6 font-mono text-xs text-white">TX-{trip.id.slice(-8).toUpperCase()}</td>
                        <td className="px-8 py-6">
                            <p className="font-bold text-white text-xs">{trip.from}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black">{trip.provider}</p>
                        </td>
                        <td className="px-8 py-6">
                            <span className="text-green-500 flex items-center text-[10px] font-black uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                                Recorded
                            </span>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white">R {trip.fare.toFixed(2)}</td>
                    </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* Express Settlement Terminal Modal */}
      {(settlementStep === 'auditing' || settlementStep === 'confirming' || settlementStep === 'transmitting') && (
          <Modal 
            title="Settlement Terminal" 
            onClose={() => setSettlementStep('idle')}
          >
              <div className="space-y-8 py-4">
                  {settlementStep === 'auditing' && (
                      <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                          <div className="w-16 h-16 border-4 border-white/5 border-t-admin-accent rounded-full animate-spin"></div>
                          <div>
                            <h4 className="text-xl font-black uppercase tracking-widest italic">AI Liquidity Audit</h4>
                            <p className="text-xs text-rea-gray-light mt-2 uppercase font-bold tracking-widest">Verifying Agency Credit Line...</p>
                          </div>
                      </div>
                  )}

                  {settlementStep === 'confirming' && (
                      <div className="space-y-6 animate-fade-in-up">
                          <div className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-4">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                                  <span>Gross Revenue</span>
                                  <span className="text-white">R {totalDaily.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-rea-red">
                                  <span>Express Fee (1.5%)</span>
                                  <span>- R {expressFee.toFixed(2)}</span>
                              </div>
                              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                  <span className="text-xs font-black uppercase tracking-widest text-white">Net Payout</span>
                                  <span className="text-2xl font-black text-green-500">R {netSettlement.toLocaleString()}</span>
                              </div>
                          </div>
                          
                          <div className="p-4 bg-admin-accent/5 border border-admin-accent/20 rounded-xl flex items-center space-x-4">
                              <Icon name="info" className="w-6 h-6 text-admin-accent" />
                              <p className="text-[9px] font-bold text-admin-accent uppercase leading-relaxed">
                                  By proceeding, you authorize immediate transmission to the registered agency bank account. Standard 24h clearing is bypassed.
                              </p>
                          </div>

                          <Button onClick={handleFinalizeSettlement} className="h-16 !rounded-2xl bg-admin-accent font-black uppercase tracking-widest shadow-2xl shadow-admin-accent/30">
                              Finalize Transmission
                          </Button>
                      </div>
                  )}

                  {settlementStep === 'transmitting' && (
                      <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                          <Icon name="activity" className="w-16 h-16 text-admin-accent animate-pulse" />
                          <div>
                            <h4 className="text-xl font-black uppercase tracking-widest italic">Clearing Protocol</h4>
                            <p className="text-xs text-rea-gray-light mt-2 uppercase font-bold tracking-widest">Inter-Bank Settlement in progress...</p>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                              <div className="bg-admin-accent h-full animate-[progress_3s_ease-in-out]"></div>
                          </div>
                      </div>
                  )}
              </div>
          </Modal>
      )}

      {/* Success View after settlement */}
      {settlementStep === 'settled' && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-600 text-white rounded-2xl px-10 py-5 shadow-2xl flex items-center space-x-4 animate-fade-in-up z-50">
              <Icon name="check-circle" className="w-8 h-8" />
              <div>
                  <p className="text-xs font-black uppercase tracking-widest">Funds Transmitted</p>
                  <p className="text-[10px] font-bold opacity-80 uppercase">R {netSettlement.toLocaleString()} Successfully Cleared</p>
              </div>
              <button onClick={() => setSettlementStep('idle')} className="ml-6 p-2 hover:bg-white/10 rounded-lg">
                  <Icon name="close" className="w-4 h-4" />
              </button>
          </div>
      )}

      <style>{`
          @keyframes progress {
              0% { width: 0%; }
              100% { width: 100%; }
          }
      `}</style>
    </div>
  );
};

export default FinancePortal;
