import React from 'react';
import { RouteOption, Provider } from '../../types';
import Icon from './Icon';
import { PROVIDER_COLORS } from '../../constants';


const getProviderColor = (provider: Provider): string => {
  const colors: Record<Provider, string> = {
    'Rea Vaya': 'border-red-500',
    'Metrobus': 'border-yellow-400',
    'Gautrain': 'border-blue-600',
    'MyCiTi': 'border-cyan-500',
    'Areyeng': 'border-green-500',
    'Tshwane Bus Service': 'border-teal-500',
    'PRASA': 'border-purple-600',
  };
  return colors[provider] || 'border-gray-500';
};

const getProviderBgColor = (provider: Provider): string => {
    return PROVIDER_COLORS[provider]?.split(' ')[0] || 'bg-gray-500';
}

const RouteMap: React.FC<{ route: RouteOption }> = ({ route }) => {
  const uniqueProviders: Provider[] = Array.from(new Set(route.steps.map(step => step.provider)));

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <div className="relative h-24 w-full">
        {/* Track Line */}
        <div className="absolute top-1/2 left-4 right-4 h-1 bg-gray-600 -translate-y-1/2"></div>

        {/* Stations */}
        <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
          <span className="text-xs text-rea-gray-light mt-2 truncate max-w-[60px] text-center">{route.steps[0].from}</span>
        </div>
        
        {route.steps.length > 1 && route.steps.map((step, index) => {
            if (index === route.steps.length - 1) return null; // last one is handled separately
            const percentage = ((index + 1) / route.steps.length) * 100;
            return (
                 <div key={index} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `calc(${percentage}% - 8px)`}}>
                    <div className={`w-3 h-3 bg-gray-800 rounded-full border-2 ${getProviderColor(step.provider)}`}></div>
                    <span className="text-xs text-rea-gray-light mt-2 truncate max-w-[60px] text-center">{step.to}</span>
                </div>
            )
        })}

        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-gray-800"></div>
          <span className="text-xs text-rea-gray-light mt-2 truncate max-w-[60px] text-center">{route.steps[route.steps.length - 1].to}</span>
        </div>
      </div>
      <div className="flex items-center justify-center flex-wrap gap-2 pt-2">
        <p className="text-sm font-semibold">Providers:</p>
        {uniqueProviders.map(provider => (
           <div key={provider} className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-md ${getProviderBgColor(provider)} ${provider === 'Metrobus' ? 'text-black' : 'text-white'}`}>
               <Icon name={provider === 'Gautrain' || provider === 'PRASA' ? 'train' : 'bus'} className="w-4 h-4" />
               <span>{provider}</span>
           </div>
        ))}
      </div>
    </div>
  );
};

export default RouteMap;