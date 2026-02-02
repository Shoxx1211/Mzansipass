import React, { useState, useEffect } from 'react';
import Icon from '../ui/Icon';

interface PinLockScreenProps {
  onUnlock: (pin: string) => boolean;
}

const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (pin.length === 4) {
      const success = onUnlock(pin);
      if (!success) {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 800);
      }
    }
  }, [pin, onUnlock]);

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + key);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };
  
  const PinDots = () => (
    <div className={`flex space-x-4 ${error ? 'animate-shake' : ''}`}>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 border-rea-gray-light transition-colors ${
            pin.length > i ? (error ? 'bg-red-500' : 'bg-rea-white') : 'bg-transparent'
          }`}
        ></div>
      ))}
    </div>
  );

  const KeypadButton: React.FC<{ value: string; onClick: (v: string) => void }> = ({ value, onClick }) => (
    <button
      onClick={() => onClick(value)}
      className="w-20 h-20 rounded-full bg-rea-gray-dark text-3xl font-light flex items-center justify-center transition-colors active:bg-rea-red"
    >
      {value}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-rea-black z-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center justify-between h-full py-10">
        <div className="text-center space-y-4">
          <Icon name="lock-closed" className="w-12 h-12 text-rea-red mx-auto" />
          <h1 className="text-2xl font-bold">Enter Your PIN</h1>
          <p className="text-rea-gray-light">Unlock your MzansiPass wallet</p>
        </div>

        <PinDots />
        
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <KeypadButton key={num} value={String(num)} onClick={handleKeyPress} />
          ))}
          <div /> {/* Empty space for layout */}
          <KeypadButton value="0" onClick={handleKeyPress} />
          <button onClick={handleDelete} className="w-20 h-20 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-rea-gray-light"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59l9-9c.39-.39 1.023-.39 1.414 0l9 9c.39.39.39 1.023 0 1.414l-6.375 6.375a1.125 1.125 0 0 1-1.589 0L9.66 17.579Z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinLockScreen;