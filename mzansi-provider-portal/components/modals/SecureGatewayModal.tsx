import React, { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useData } from '../../context/DataContext';

interface SecureGatewayModalProps {
  amount: number;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

type Step = 'details' | 'processing' | 'success';

const SecureGatewayModal: React.FC<SecureGatewayModalProps> = ({ amount, onClose, onPaymentSuccess }) => {
  const [step, setStep] = useState<Step>('details');
  const { user } = useData();

  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: user.fullName,
    expiry: '',
    cvc: '',
  });
  const [formError, setFormError] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  const handleDetailChange = (field: keyof typeof cardDetails) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError('');
    let value = e.target.value;
    if (field === 'number') {
        value = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
    } else if (field === 'expiry') {
        value = value.replace(/\D/g, '').replace(/(.{2})/, '$1/').trim().slice(0, 5);
    } else if (field === 'cvc') {
        value = value.replace(/\D/g, '').slice(0, 3);
    }
    setCardDetails(prev => ({ ...prev, [field]: value }));
  };
  
  const validateAndPay = () => {
    if (cardDetails.number.length !== 19 || cardDetails.expiry.length !== 5 || cardDetails.cvc.length !== 3 || !cardDetails.name.trim()) {
      setFormError('Please fill in all card details correctly.');
      return;
    }
    setStep('processing');
  };

  useEffect(() => {
    let timer: number;
    if (step === 'processing') {
      timer = window.setTimeout(() => setStep('success'), 2500);
    }
    if (step === 'success') {
      timer = window.setTimeout(() => onPaymentSuccess(), 1500);
    }
    return () => window.clearTimeout(timer);
  }, [step, onPaymentSuccess]);


  const renderContent = () => {
    switch (step) {
      case 'details':
        return (
            <div className="space-y-4">
                 {/* Interactive Card Visual */}
                <div className="w-full max-w-xs mx-auto aspect-[1.586]">
                    <div className="relative w-full h-full transition-transform duration-700 ease-in-out transform-style-preserve-3d"
                         style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                        {/* Front */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl shadow-md bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-4 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <span className="font-semibold text-lg">Bank Co.</span>
                                <Icon name="credit-card" className="w-8 h-8 opacity-80" />
                            </div>
                            <div className="font-mono text-xl tracking-widest">
                                {cardDetails.number || '#### #### #### ####'}
                            </div>
                            <div className="flex justify-between text-xs uppercase">
                                <span>{cardDetails.name || 'Card Holder'}</span>
                                <span>{cardDetails.expiry || 'MM/YY'}</span>
                            </div>
                        </div>
                        {/* Back */}
                        <div className="absolute w-full h-full backface-hidden rounded-xl shadow-md bg-gray-300 text-black p-2 flex flex-col justify-center rotate-y-180">
                            <div className="w-full h-10 bg-black"></div>
                            <div className="bg-white p-2 mt-2 text-right">
                                <span className="font-mono italic pr-2">{cardDetails.cvc || 'CVC'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <Input label="Card Number" id="cardNumber" placeholder="0000 0000 0000 0000" value={cardDetails.number} onChange={handleDetailChange('number')} />
                    <button onClick={() => alert("Camera scanning not implemented in this demo.")} className="absolute top-8 right-2 p-1 text-gray-400 hover:text-blue-500">
                        <Icon name="camera" className="w-6 h-6"/>
                    </button>
                </div>
                <Input label="Card Holder Name" id="cardName" placeholder="John Doe" value={cardDetails.name} onChange={handleDetailChange('name')} />
                <div className="flex gap-4">
                    <Input label="Expiry (MM/YY)" id="expiry" placeholder="MM/YY" value={cardDetails.expiry} onChange={handleDetailChange('expiry')} />
                    <Input 
                        label="CVC" 
                        id="cvc" 
                        placeholder="123" 
                        value={cardDetails.cvc} 
                        onChange={handleDetailChange('cvc')}
                        onFocus={() => setIsFlipped(true)}
                        onBlur={() => setIsFlipped(false)}
                    />
                </div>
                {formError && <p className="text-red-500 text-sm text-center -my-2">{formError}</p>}
                <Button onClick={validateAndPay}>Pay R {amount.toFixed(2)}</Button>
            </div>
        );
      case 'processing':
          return (
              <div className="flex flex-col items-center justify-center h-48 space-y-4">
                  <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="font-semibold text-gray-500">Processing transaction securely...</p>
              </div>
          );
      case 'success':
        return (
            <div className="flex flex-col items-center justify-center h-48 space-y-4 text-center">
                <Icon name="check-circle" className="w-16 h-16 text-green-500" />
                <h3 className="text-2xl font-bold text-gray-800">Payment Confirmed!</h3>
                <p className="text-gray-500">Redirecting back to MzansiPass...</p>
            </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white text-gray-800 rounded-2xl p-6 w-full max-w-sm relative shadow-lg">
        <header className="border-b pb-3 mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2"><Icon name="lock-closed" className="w-5 h-5" /> Mock Secure Gateway</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800">
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Paying to Mzansi Transit Pass</p>
        </header>

        {renderContent()}

        <footer className="mt-6 pt-3 border-t text-center text-xs text-gray-400">
            <p>Powered by SecurePay™ | PCI DSS Compliant</p>
        </footer>
      </div>
    </div>
  );
};

// Add helper CSS for 3D transform effects
const style = document.createElement('style');
style.innerHTML = `
  .transform-style-preserve-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
`;
document.head.appendChild(style);


export default SecureGatewayModal;