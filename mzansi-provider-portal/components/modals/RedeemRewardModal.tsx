import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useData } from '../../context/DataContext';
import { Reward } from '../../types';

interface RedeemRewardModalProps {
  reward: Reward;
  onClose: () => void;
}

type Step = 'confirm' | 'success' | 'error';

const RedeemRewardModal: React.FC<RedeemRewardModalProps> = ({ reward, onClose }) => {
  const { redeemReward, user } = useData();
  const [step, setStep] = useState<Step>('confirm');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRedeem = () => {
    try {
      redeemReward(reward.id);
      setStep('success');
    } catch (e: any) {
      setErrorMessage(e.message || 'An unexpected error occurred.');
      setStep('error');
    }
  };

  const renderConfirm = () => (
    <div className="space-y-6 text-center">
      <h3 className="text-xl font-semibold">Confirm Redemption</h3>
      <div className="bg-gray-800 p-4 rounded-lg text-left space-y-2">
        <p><span className="text-rea-gray-light">Reward:</span> <span className="font-bold">{reward.title}</span></p>
        <p><span className="text-rea-gray-light">Cost:</span> <span className="font-bold text-2xl text-yellow-400 flex items-center"><Icon name="star" className="w-5 h-5 mr-1" /> {reward.cost} Points</span></p>
        <p className="text-xs text-rea-gray-light pt-2">{reward.description}</p>
      </div>
      <p className="text-sm text-rea-gray-light">This amount will be deducted from your loyalty points balance.</p>
      <div className="flex gap-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleRedeem}>Redeem Now</Button>
      </div>
    </div>
  );

  const renderResult = (isSuccess: boolean) => (
    <div className="flex flex-col items-center justify-center h-48 space-y-4 text-center">
      <Icon name={isSuccess ? "check-circle" : "close"} className={`w-16 h-16 ${isSuccess ? 'text-green-500' : 'text-red-500'}`} />
      <h3 className="text-2xl font-bold">{isSuccess ? "Reward Redeemed!" : "Redemption Failed"}</h3>
      <p className="text-rea-gray-light">
        {isSuccess ? "Your reward has been applied to your account." : errorMessage}
      </p>
      <Button onClick={onClose} className="mt-4">Done</Button>
    </div>
  );

  return (
    <Modal title="Redeem Reward" onClose={onClose}>
      {step === 'confirm' && renderConfirm()}
      {step === 'success' && renderResult(true)}
      {step === 'error' && renderResult(false)}
    </Modal>
  );
};

export default RedeemRewardModal;
