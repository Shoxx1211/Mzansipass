import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';

interface SetPinModalProps {
  onClose: () => void;
}

const PinDots: React.FC<{ pin: string; error: boolean }> = ({ pin, error }) => (
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
      className="w-16 h-16 rounded-full bg-rea-gray-dark text-2xl font-light flex items-center justify-center transition-colors active:bg-rea-red"
    >
      {value}
    </button>
);


const SetPinModal: React.FC<SetPinModalProps> = ({ onClose }) => {
    const { setPin: savePin, user } = useData();
    const [step, setStep] = useState<'enter' | 'confirm' | 'success'>('enter');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');

    const handleKeyPress = (key: string) => {
        if (error) setError('');
        if (step === 'enter' && pin.length < 4) {
            setPin(p => p + key);
        } else if (step === 'confirm' && confirmPin.length < 4) {
            setConfirmPin(p => p + key);
        }
    };

    const handleDelete = () => {
        if (step === 'enter') {
            setPin(p => p.slice(0, -1));
        } else if (step === 'confirm') {
            setConfirmPin(p => p.slice(0, -1));
        }
    };

    const handleContinue = () => {
        if (pin.length < 4) {
            setError('PIN must be 4 digits.');
            return;
        }
        setError('');
        setStep('confirm');
    };

    const handleSetPin = () => {
        if (pin !== confirmPin) {
            setError('PINs do not match. Please try again.');
            setTimeout(() => {
                setError('');
                setPin('');
                setConfirmPin('');
                setStep('enter');
            }, 1000);
            return;
        }
        savePin(pin);
        setError('');
        setStep('success');
    };

    const title = user.pin ? 'Change Your PIN' : 'Set a Security PIN';
    
    const getSubTitle = () => {
        switch (step) {
            case 'enter':
                return 'Enter a new 4-digit PIN';
            case 'confirm':
                return 'Confirm your new PIN';
            case 'success':
                return 'PIN Successfully Set!';
            default:
                return '';
        }
    }

    const renderContent = () => {
        if (step === 'success') {
            return (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                    <Icon name="check-circle" className="w-16 h-16 text-green-500" />
                    <p className="text-lg text-rea-gray-light">
                        Your PIN has been updated successfully.
                    </p>
                    <div className="w-full pt-4">
                        <Button onClick={onClose}>Done</Button>
                    </div>
                </div>
            );
        }

        const currentPin = step === 'enter' ? pin : confirmPin;

        return (
            <div className="flex flex-col items-center space-y-6">
                <p className="text-rea-gray-light">{getSubTitle()}</p>
                <PinDots pin={currentPin} error={!!error} />
                <div className="h-5 text-center">
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <KeypadButton key={num} value={String(num)} onClick={handleKeyPress} />
                    ))}
                    <div />
                    <KeypadButton value="0" onClick={handleKeyPress} />
                    <button onClick={handleDelete} className="w-16 h-16 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-rea-gray-light"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59l9-9c.39-.39 1.023-.39 1.414 0l9 9c.39.39.39 1.023 0 1.414l-6.375 6.375a1.125 1.125 0 0 1-1.589 0L9.66 17.579Z" /></svg>
                    </button>
                </div>
                
                <div className="w-full">
                    {step === 'enter' && pin.length === 4 && (
                        <Button onClick={handleContinue} className="mt-4">Continue</Button>
                    )}
                    {step === 'confirm' && confirmPin.length === 4 && (
                        <Button onClick={handleSetPin} className="mt-4">Set PIN</Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Modal title={title} onClose={onClose}>
            {renderContent()}
        </Modal>
    );
};

export default SetPinModal;
