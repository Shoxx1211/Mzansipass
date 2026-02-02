import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useData } from '../../context/DataContext';
import { PrasaTicketType } from '../../types';
import { STATIONS } from '../../constants';

interface BuyPrasaTicketModalProps {
  onClose: () => void;
}

const TICKET_FARES: Record<PrasaTicketType, number> = {
  single: 22.50,
  return: 43.00,
  weekly: 160.00,
  monthly: 550.00,
};

type Step = 'form' | 'confirm' | 'success';

const BuyPrasaTicketModal: React.FC<BuyPrasaTicketModalProps> = ({ onClose }) => {
  const { purchasePrasaTicket, virtualCard } = useData();
  const [step, setStep] = useState<Step>('form');
  const [ticketType, setTicketType] = useState<PrasaTicketType>('single');
  const [fromStation, setFromStation] = useState(STATIONS['PRASA'][0]);
  const [toStation, setToStation] = useState(STATIONS['PRASA'][1]);
  const [error, setError] = useState('');

  const fare = useMemo(() => TICKET_FARES[ticketType], [ticketType]);

  const handleConfirm = () => {
    if (fromStation === toStation) {
      setError('Start and destination stations cannot be the same.');
      return;
    }
    if (virtualCard.balance < fare) {
      setError('Insufficient balance in your virtual card.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handlePurchase = () => {
    try {
      purchasePrasaTicket(ticketType, fromStation, toStation, fare);
      setStep('success');
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
      setStep('form');
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="ticketType" className="block text-sm font-medium text-rea-gray-light mb-1">Ticket Type</label>
        <select
          id="ticketType"
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as PrasaTicketType)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
        >
          {Object.keys(TICKET_FARES).map(type => (
            <option key={type} value={type} className="capitalize">{type.charAt(0).toUpperCase() + type.slice(1)}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="fromStation" className="block text-sm font-medium text-rea-gray-light mb-1">From</label>
          <select
            id="fromStation"
            value={fromStation}
            onChange={(e) => setFromStation(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
          >
            {STATIONS['PRASA'].map(station => <option key={station} value={station}>{station}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="toStation" className="block text-sm font-medium text-rea-gray-light mb-1">To</label>
          <select
            id="toStation"
            value={toStation}
            onChange={(e) => setToStation(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
          >
            {STATIONS['PRASA'].map(station => <option key={station} value={station}>{station}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm text-center -my-2">{error}</p>}
      <Button onClick={handleConfirm}>Proceed - R {fare.toFixed(2)}</Button>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-6 text-center">
      <h3 className="text-xl font-semibold">Confirm Purchase</h3>
      <div className="bg-gray-800 p-4 rounded-lg text-left space-y-2">
        <p><span className="text-rea-gray-light">Type:</span> <span className="font-bold capitalize">{ticketType}</span></p>
        <p><span className="text-rea-gray-light">Route:</span> <span className="font-bold">{fromStation} to {toStation}</span></p>
        <p><span className="text-rea-gray-light">Amount:</span> <span className="font-bold text-2xl text-rea-red">R {fare.toFixed(2)}</span></p>
      </div>
      <p className="text-sm text-rea-gray-light">This amount will be deducted from your Virtual Card balance.</p>
      <div className="flex gap-4">
        <Button variant="secondary" onClick={() => setStep('form')}>Back</Button>
        <Button onClick={handlePurchase}>Confirm & Pay</Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center h-48 space-y-4 text-center">
      <Icon name="check-circle" className="w-16 h-16 text-green-500" />
      <h3 className="text-2xl font-bold">Ticket Purchased!</h3>
      <p className="text-rea-gray-light">Your new ticket is now available in your wallet.</p>
      <Button onClick={onClose} className="mt-4">Done</Button>
    </div>
  );

  return (
    <Modal title="Buy PRASA Ticket" onClose={onClose}>
      {step === 'form' && renderForm()}
      {step === 'confirm' && renderConfirm()}
      {step === 'success' && renderSuccess()}
    </Modal>
  );
};

export default BuyPrasaTicketModal;