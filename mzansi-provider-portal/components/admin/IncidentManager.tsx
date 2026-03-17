
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';

const IncidentManager: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user, transitAlerts, verifyAndRewardAlert } = useData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');
  
  // Filter by user role/provider access: Admin should only see reports for their agency
  const agencyReports = transitAlerts.filter(a => 
    a.type === 'user_report' && 
    (!user.providerAccess || a.provider === user.providerAccess)
  );

  const filteredReports = agencyReports.filter(report => 
    report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVerifyWithAction = () => {
    if (!selectedId) return;
    verifyAndRewardAlert(selectedId, actionText);
    setSelectedId(null);
    setActionText('');
    alert("Report verified. Commuter has been rewarded with 50 Bonsella Points.");
  };

  return (
    <div className="space-y-6 relative pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">{user.providerAccess || 'Agency'} Incident Review</h3>
          <p className="text-rea-gray-light">Audit crowd-sourced intelligence and issue Bonsella rewards for valid data.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
            {filteredReports.map(report => (
              <div 
                key={report.id} 
                onClick={() => setSelectedId(report.id)}
                className={`bg-rea-gray-dark p-6 rounded-2xl border transition-all cursor-pointer group ${
                    selectedId === report.id ? 'border-admin-accent shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-admin-accent/5' : 'border-gray-800 hover:border-white/10'
                }`}
              >
                <div className="flex items-start justify-between">
                    <div className="flex space-x-4">
                        <div className={`p-4 rounded-xl transition-colors ${selectedId === report.id ? 'bg-admin-accent text-white' : 'bg-gray-800 text-yellow-500'}`}>
                            <Icon name={report.category === 'delay' ? 'clock' : 'alert-triangle'} className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center space-x-2">
                                <h4 className="text-lg font-bold">{report.title}</h4>
                                <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-rea-gray-light uppercase font-bold tracking-widest">{report.category}</span>
                            </div>
                            <p className="text-rea-gray-light mt-1 text-sm line-clamp-2">{report.description}</p>
                            <div className="flex items-center space-x-4 mt-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                <span className="text-admin-accent">{report.provider}</span>
                                <span>{new Date(report.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                    {report.rewarded && (
                        <div className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-[10px] font-black uppercase">Rewarded</div>
                    )}
                </div>
              </div>
            ))}
            {filteredReports.length === 0 && (
                <div className="text-center py-20 bg-rea-gray-dark rounded-2xl border border-dashed border-gray-700">
                    <p className="text-gray-500 font-bold italic">No pending user reports for review.</p>
                </div>
            )}
        </div>

        <div className="space-y-6">
            <div className={`bg-rea-gray-dark p-8 rounded-3xl border transition-all ${selectedId ? 'border-admin-accent shadow-2xl opacity-100' : 'border-white/5 opacity-50 pointer-events-none'}`}>
                <h4 className="text-sm font-black uppercase tracking-widest mb-6">Resolution Protocol</h4>
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-500 block mb-2">Agency Action (Visible to Commuter)</label>
                        <textarea 
                            value={actionText}
                            onChange={(e) => setActionText(e.target.value)}
                            placeholder="e.g. Technician dispatched to site. Switch to Gautrain bus."
                            className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-admin-accent outline-none min-h-[100px]"
                        />
                    </div>
                    <div className="bg-admin-accent/10 p-4 rounded-xl border border-admin-accent/20 flex items-center space-x-3">
                        <Icon name="star" className="w-6 h-6 text-yellow-500" />
                        <div>
                            <p className="text-xs font-black text-white uppercase">Reward Commuter</p>
                            <p className="text-[10px] text-admin-accent font-bold uppercase">Grant +50 Bonsella Points</p>
                        </div>
                    </div>
                    <Button onClick={handleVerifyWithAction} className="bg-admin-accent h-14 !rounded-xl font-black uppercase tracking-widest text-sm">
                        Verify & Reward
                    </Button>
                    <button onClick={() => setSelectedId(null)} className="w-full text-center text-xs font-bold text-gray-500 uppercase hover:text-white transition-colors">
                        Cancel Audit
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentManager;
