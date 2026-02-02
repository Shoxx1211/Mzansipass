import React, { useState, useEffect } from 'react';
import Icon from '../ui/Icon';
import { Provider } from '../../types';

interface NfcScanModalProps {
  onScanSuccess: () => void;
  onClose: () => void;
  mode: 'in' | 'out';
  provider?: Provider | null;
}

const NfcScanModal: React.FC<NfcScanModalProps> = ({ onScanSuccess, onClose, mode, provider }) => {
  const [status, setStatus] = useState<'ready' | 'scanning' | 'success'>('ready');

  useEffect(() => {
    const scanTimer = setTimeout(() => setStatus('scanning'), 500);
    const successTimer = setTimeout(() => setStatus('success'), 2500);
    const closeTimer = setTimeout(() => {
      onScanSuccess();
      onClose();
    }, 4000);

    return () => {
      clearTimeout(scanTimer);
      clearTimeout(successTimer);
      clearTimeout(closeTimer);
    };
  }, [onScanSuccess, onClose]);

  const getStatusContent = () => {
    switch (status) {
      case 'ready':
        return {
          icon: <Icon name="nfc" className="w-24 h-24 text-blue-400 animate-nfc-pulse" />,
          title: "Ready to Scan",
          subtitle: "Hold your device near the reader to tap " + (mode === 'in' ? 'in' : 'out'),
        };
      case 'scanning':
        return {
          icon: <div className="w-24 h-24 border-8 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>,
          title: "Scanning...",
          subtitle: provider ? `Detecting ${provider} terminal...` : "Please keep your device steady",
        };
      case 'success':
        let successSubtitle = `Your trip has been ${mode === 'in' ? 'started' : 'completed'}.`;
        if (provider && mode === 'in') {
            successSubtitle = `Trip started with ${provider}.`;
        } else if (provider && mode === 'out') {
            successSubtitle = `Trip with ${provider} completed.`;
        }
        return {
          icon: (
             <svg className="w-24 h-24 text-green-500" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="3" />
                <path
                    d="M20 34 L28 42 L44 26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="100"
                    className="animate-draw-check"
                />
            </svg>
          ),
          title: "Tap Successful!",
          subtitle: successSubtitle,
        };
    }
  };

  const { icon, title, subtitle } = getStatusContent();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 animate-scene-in">
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div key={status} className="animate-fade-in-up">
          {icon}
        </div>
        <div key={title} className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-3xl font-bold text-white">{title}</h2>
            <p className="text-lg text-rea-gray-light mt-2">{subtitle}</p>
        </div>
      </div>
      <button onClick={onClose} className="absolute top-6 right-6 text-rea-gray-light hover:text-white">
        <Icon name="close" className="w-8 h-8" />
      </button>
    </div>
  );
};

export default NfcScanModal;