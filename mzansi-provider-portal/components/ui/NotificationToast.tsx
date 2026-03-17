
import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import { TransitAlert } from '../../types';
import { PROVIDER_COLORS } from '../../constants';

interface NotificationToastProps {
  alert: TransitAlert;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ alert, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 500); // Wait for exit animation
    }, 8000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const providerColor = alert.provider ? PROVIDER_COLORS[alert.provider] : 'bg-rea-red text-white';

  return (
    <div className={`fixed top-6 left-4 right-4 z-[100] transition-all duration-500 ease-out transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}>
      <div className="max-w-md mx-auto bg-rea-gray-dark border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl">
        <div className="p-1">
            <div className={`h-1.5 w-full rounded-t-xl animate-progress-shrink ${providerColor.split(' ')[0]}`}></div>
        </div>
        <div className="p-4 flex items-start space-x-4">
          <div className={`p-3 rounded-xl shrink-0 shadow-lg ${providerColor}`}>
            <Icon name={alert.category === 'delay' ? 'clock' : 'alert-triangle'} className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-admin-accent">{alert.provider} Official Alert</span>
              <button onClick={() => setIsVisible(false)} className="text-gray-500 hover:text-white">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            <h4 className="text-sm font-black text-white leading-tight mb-1 truncate">{alert.title}</h4>
            <p className="text-xs text-rea-gray-light leading-relaxed line-clamp-2">{alert.description}</p>
          </div>
        </div>
        <div className="bg-white/[0.03] px-4 py-2 flex justify-between items-center border-t border-white/5">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">System Priority: High</span>
            <button onClick={() => setIsVisible(false)} className="text-[9px] font-black text-admin-accent uppercase tracking-widest hover:underline">Acknowledge</button>
        </div>
      </div>
      <style>{`
        @keyframes progress-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress-shrink {
          animation: progress-shrink 8s linear forwards;
        }
      `}</style>
    </div>
  );
};

export default NotificationToast;
