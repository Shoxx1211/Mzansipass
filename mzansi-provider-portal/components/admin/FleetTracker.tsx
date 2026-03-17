
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';

const FleetTracker: React.FC<{ searchQuery?: string }> = ({ searchQuery = '' }) => {
  const { user, fleet, updateFleetStatus, trips } = useData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');

  // Filter fleet based on administrator's provider access
  const agencyFleet = fleet.filter(vehicle => 
    !user.providerAccess || vehicle.provider === user.providerAccess
  );

  // Simple "Demand" calculation based on recent trips (simulation)
  const highDemandStations = ['Sandton', 'Park Station', 'Soweto'].filter(s => 
     trips.filter(t => t.from === s).length > 2
  );

  const filteredFleet = agencyFleet.filter(vehicle => 
    vehicle.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vehicle.lastStation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 relative pb-24">
      <header className="flex justify-between items-center">
        <div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">{user.providerAccess || 'Network'} Operations</h3>
            <p className="text-rea-gray-light text-sm">Real-time asset telemetry and demand forecasting.</p>
        </div>
        <div className="bg-rea-gray-dark p-1 rounded-xl flex border border-white/5">
            <button onClick={() => setView('list')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>List</button>
            <button onClick={() => setView('map')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'map' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Tactical Map</button>
        </div>
      </header>

      {view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFleet.map(vehicle => (
            <div 
                key={vehicle.id} 
                onClick={() => toggleSelection(vehicle.id)}
                className={`bg-rea-gray-dark p-6 rounded-2xl border transition-all group cursor-pointer ${
                    selectedIds.includes(vehicle.id) ? 'border-admin-accent shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-admin-accent/5' : 'border-gray-800 hover:border-white/20'
                }`}
            >
                <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl transition-colors ${
                        vehicle.status === 'delayed' ? 'bg-red-500/20 text-red-500' : 
                        vehicle.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-green-500/20 text-green-500'
                    }`}>
                    <Icon name={vehicle.type === 'bus' ? 'bus' : 'train'} className="w-6 h-6" />
                    </div>
                    <div>
                    <h4 className="font-bold">{vehicle.id}</h4>
                    <p className="text-[10px] text-rea-gray-light font-bold uppercase tracking-widest">{vehicle.route}</p>
                    </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                    vehicle.status === 'on-time' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-400'
                }`}>
                    {vehicle.status}
                </span>
                </div>

                <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-[10px] mb-1 font-black uppercase text-gray-500">
                    <span>Live Load Factor</span>
                    <span className="text-white">{vehicle.occupancy}%</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${vehicle.occupancy > 80 ? 'bg-red-500' : 'bg-admin-accent'}`} 
                        style={{ width: `${vehicle.occupancy}%` }}
                    ></div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                    <div className="flex items-center space-x-2">
                        <Icon name="home" className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-500">Station:</span>
                        <span className="text-white">{vehicle.lastStation}</span>
                    </div>
                    {highDemandStations.includes(vehicle.lastStation) && (
                        <span className="text-orange-500 animate-pulse">High Demand Area</span>
                    )}
                </div>
                </div>
            </div>
            ))}
        </div>
      ) : (
        <div className="bg-rea-gray-dark rounded-3xl border border-gray-800 h-[600px] relative overflow-hidden shadow-inner">
            <div className="absolute inset-0 opacity-40">
                <div className="w-full h-full bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/28.0473,26.2041,11/800x600?access_token=none')] bg-cover grayscale contrast-125"></div>
            </div>
            
            {/* Legend */}
            <div className="absolute top-6 right-6 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-xl space-y-3 z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Network Legend</p>
                <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,1)]"></div>
                    <span className="text-[10px] font-bold uppercase text-white">Active Unit</span>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-orange-500/20 border border-orange-500/50 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold uppercase text-orange-500">Surge Demand</span>
                </div>
            </div>

            {/* Simulated Vehicle Pips */}
            <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-green-500 rounded-full cursor-pointer hover:scale-150 transition-transform"></div>
            <div className="absolute top-1/4 left-1/2 w-3 h-3 bg-green-500 rounded-full cursor-pointer hover:scale-150 transition-transform"></div>
            <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-red-500 rounded-full cursor-pointer hover:scale-150 transition-transform"></div>

            {/* Demand Heatmap Simulation */}
            <div className="absolute top-[45%] left-[30%] w-32 h-32 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[20%] right-[40%] w-48 h-48 bg-orange-500/5 rounded-full blur-3xl"></div>
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-2xl">
                <p className="text-xs font-black uppercase text-center text-white tracking-widest">
                    Live Telemetry: Tracking {agencyFleet.length} Units in {user.providerAccess || 'Greater Gauteng'}
                </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default FleetTracker;
