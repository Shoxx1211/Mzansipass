import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useData } from '../../context/DataContext';
import SecureGatewayModal from './SecureGatewayModal';

interface TopUpModalProps {
  onClose: () => void;
  cardId: string | null;
}

const presetAmounts = [50, 100, 150, 200];

const TopUpModal: React.FC<TopUpModalProps> = ({ onClose, cardId }) => {
  const [view, setView] = useState<'amount' | 'success'>('amount');
  const [amount, setAmount] = useState<number>(50);
  const [isGatewayOpen, setIsGatewayOpen] = useState(false);
  const { addFunds, physicalCards } = useData();

  const handlePaymentSuccess = () => {
    setIsGatewayOpen(false);
    addFunds(amount, cardId ?? undefined);
    setView('success');
  };

  const cardName = cardId 
    ? physicalCards.find(c => c.id === cardId)?.nickname ?? 'Physical Card' 
    : 'Virtual Card';

  const renderAmountSelection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {presetAmounts.map(preset => (
          <button
            key={preset}
            onClick={() => setAmount(preset)}
            className={`py-3 rounded-lg font-semibold border-2 transition-colors ${amount === preset ? 'bg-rea-red border-rea-red' : 'bg-gray-700 border-gray-600 hover:border-rea-red'}`}
          >
            R {preset}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="custom-amount" className="block text-sm font-medium text-rea-gray-light mb-1">Or enter custom amount (R)</label>
        <input
          id="custom-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-rea-white placeholder-rea-gray-light focus:outline-none focus:ring-2 focus:ring-rea-red"
          placeholder="e.g. 75"
        />
      </div>
      <div className="text-center text-xs text-rea-gray-light flex items-center justify-center space-x-2 bg-gray-800 p-2 rounded-md">
        <Icon name="lock-closed" className="w-4 h-4 text-green-400" />
        <span>Your payments are processed securely. We do not store your card details.</span>
      </div>
      <Button onClick={() => setIsGatewayOpen(true)} disabled={amount <= 0}>
        Proceed to Secure Payment
      </Button>
    </div>
  );

  const renderSuccessView = () => (
    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
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
              strokeDashoffset="100"
              className="animate-draw-check"
          />
      </svg>
      <h3 className="text-2xl font-bold">Top-up Successful!</h3>
      <p className="text-rea-gray-light text-lg">
        You've successfully added <span className="font-bold text-white">R {amount.toFixed(2)}</span> to your <span className="font-bold text-white">{cardName}</span>.
      </p>
      <div className="w-full pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );

  return (
    <>
      <Modal title={view === 'success' ? 'Payment Confirmed' : 'Top Up Balance'} onClose={onClose}>
        {view === 'amount' ? renderAmountSelection() : renderSuccessView()}
      </Modal>
      {isGatewayOpen && (
        <SecureGatewayModal
          amount={amount}
          onClose={() => setIsGatewayOpen(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};

export default TopUpModal;