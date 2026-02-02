
import React, { useState, useMemo, useEffect } from 'react';
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

type Step = 'form' | 'processing' | 'success';

const BuyPrasaTicketModal: React.FC<BuyPrasaTicketModalProps> = ({ onClose }) => {
  const { purchasePrasaTicket, virtualCard } = useData();
  const [step, setStep] = useState<Step>('form');
  const [ticketType, setTicketType] = useState<PrasaTicketType>('single');
  const [fromStation, setFromStation] = useState(STATIONS['PRASA'][0]);
  const [toStation, setToStation] = useState(STATIONS['PRASA'][1]);
  const [error, setError] = useState('');
  const [processingStage, setProcessingStage] = useState(0);

  const fare = useMemo(() => TICKET_FARES[ticketType], [ticketType]);
  const isSameStation = fromStation === toStation;

  const stages = [
    "Validating Station Route...",
    "Registering Counter Transaction...",
    "Securing Digital Signature...",
    "Finalizing PRASA Asset ID..."
  ];

  useEffect(() => {
    let timer: number;
    if (step === 'processing') {
      if (processingStage < stages.length) {
        timer = window.setTimeout(() => {
          setProcessingStage(prev => prev + 1);
        }, 600);
      } else {
        timer = window.setTimeout(() => {
          try {
            // Note: Since this is the Provider Portal, we assume 'Counter' source.
            // Counter sales don't deduct from the agent's virtual card in this simulation,
            // they add to the agency's total revenue.
            purchasePrasaTicket(ticketType, fromStation, toStation, fare, 'Counter');
            setStep('success');
          } catch (e: any) {
            setError(e.message || 'Transaction rejected by Registry.');
            setStep('form');
          }
        }, 400);
      }
    }
    return () => clearTimeout(timer);
  }, [step, processingStage, purchasePrasaTicket, ticketType, fromStation, toStation, fare]);

  const handleInitiatePurchase = () => {
    if (isSameStation) {
      setError('Departure and destination must be different.');
      return;
    }
    setError('');
    setProcessingStage(0);
    setStep('processing');
  };

  const renderForm = () => (
    <div className="space-y-6">
      <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-rea-gray-light">Agent Terminal</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-admin-accent px-2 py-1 bg-admin-accent/10 rounded">PRASA Counter</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 block">Ticket Classification</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TICKET_FARES) as PrasaTicketType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setTicketType(type)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                    ticketType === type 
                    ? 'bg-admin-accent border-admin-accent text-white shadow-lg shadow-admin-accent/20' 
                    : 'bg-white/5 border-white/5 text-rea-gray-light hover:border-white/10'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 block">Departure</label>
              <select
                value={fromStation}
                onChange={(e) => setFromStation(e.target.value)}
                className={`w-full bg-black border rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-admin-accent transition-all ${isSameStation ? 'border-red-500/50' : 'border-white/10'}`}
              >
                {STATIONS['PRASA'].map(station => <option key={station} value={station}>{station}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 block">Destination</label>
              <select
                value={toStation}
                onChange={(e) => setToStation(e.target.value)}
                className={`w-full bg-black border rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-admin-accent transition-all ${isSameStation ? 'border-red-500/50' : 'border-white/10'}`}
              >
                {STATIONS['PRASA'].map(station => <option key={station} value={station}>{station}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center space-x-3 animate-shake">
            <Icon name="alert-circle" className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-admin-accent/5 border border-admin-accent/10 p-4 rounded-xl flex justify-between items-center">
          <div>
              <p className="text-[10px] font-black uppercase text-rea-gray-light tracking-widest">Amount to Collect (Cash/POS)</p>
              <p className="text-2xl font-black text-white">R {fare.toFixed(2)}</p>
          </div>
          <div className="text-right">
              <p className="text-[10px] font-black uppercase text-rea-gray-light tracking-widest">Revenue Impact</p>
              <p className="text-sm font-black text-green-500">+ R {fare.toFixed(2)}</p>
          </div>
      </div>

      <Button 
        onClick={handleInitiatePurchase} 
        disabled={isSameStation}
        className="h-16 !rounded-2xl bg-admin-accent shadow-2xl shadow-admin-accent/20 font-black uppercase tracking-widest text-sm disabled:opacity-30"
      >
        Issue Digital Ticket
      </Button>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 text-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-white/5 border-t-admin-accent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <Icon name="ticket" className="w-8 h-8 text-admin-accent opacity-50" />
        </div>
      </div>
      <div>
        <h3 className="text-xl font-black uppercase tracking-widest italic mb-2">Secure Issuance</h3>
        <div className="flex flex-col items-center space-y-2">
            {stages.map((stage, i) => (
                <div key={i} className={`flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest transition-opacity duration-300 ${i < processingStage ? 'text-green-500 opacity-100' : i === processingStage ? 'text-white animate-pulse' : 'text-gray-700 opacity-50'}`}>
                    {i < processingStage ? <Icon name="check-circle" className="w-3 h-3" /> : <div className="w-3 h-px bg-current"></div>}
                    <span>{stage}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center animate-fade-in-up">
      <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
        <Icon name="check-circle" className="w-12 h-12" />
      </div>
      <div>
        <h3 className="text-2xl font-black uppercase tracking-widest italic text-white">Ticket Issued</h3>
        <p className="text-rea-gray-light text-sm font-medium mt-2">Counter transaction verified. Syncing with commuter app...</p>
      </div>
      <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/5 text-left space-y-2">
         <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
             <span>Registry Receipt #</span>
             <span>PR-CTR-{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
         </div>
         <p className="text-xs font-bold text-white uppercase">{ticketType} • {fromStation} → {toStation}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full pt-4">
        <Button variant="secondary" onClick={() => alert("Digital copy transmitted to commuter via NFC push.")} className="!py-3 !text-xs !rounded-xl">NFC Push</Button>
        <Button onClick={onClose} className="!py-3 !text-xs !rounded-xl bg-admin-accent">New Sale</Button>
      </div>
    </div>
  );

  return (
    <Modal title={step === 'success' ? 'Issuance Complete' : step === 'processing' ? 'Registry Sync' : 'PRASA Ticket Sales'} onClose={onClose}>
      {step === 'form' && renderForm()}
      {step === 'processing' && renderProcessing()}
      {step === 'success' && renderSuccess()}
    </Modal>
  );
};

export default BuyPrasaTicketModal;
