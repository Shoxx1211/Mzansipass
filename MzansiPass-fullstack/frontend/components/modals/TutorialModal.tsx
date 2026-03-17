import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

interface TutorialModalProps {
  onClose: () => void;
}

const scenes = [
  {
    title: 'Tap to start your trip',
    icon: 'hand',
    duration: 3000,
  },
  {
    title: 'Manage your funds in the Wallet',
    icon: 'wallet',
    duration: 3000,
  },
  {
    title: 'Tap here to add funds',
    icon: 'plus',
    duration: 3000,
  },
  {
    title: 'And link your physical cards here',
    icon: 'link',
    duration: 3000,
  },
  {
    title: 'Plan the smartest routes with AI',
    icon: 'planner',
    duration: 3000,
  },
  {
    title: "You're ready to travel!",
    icon: 'star',
    duration: 3000,
  },
];

const WalletScene: React.FC<{ highlight?: 'topup' | 'link' }> = ({ highlight }) => (
  <div className="flex flex-col items-center justify-start h-full text-center bg-gray-900 p-2 space-y-2">
    <div className="w-full bg-rea-gray-dark p-2 rounded-md flex items-center justify-between">
      <div>
        <p className="text-xs text-left text-rea-gray-light">Card Balance</p>
        <p className="text-lg font-bold text-left">R 50.00</p>
      </div>
      <div className={`w-auto px-4 py-1.5 text-sm rounded-md transition-all duration-300 ${highlight === 'topup' ? 'animate-glow bg-rea-red' : 'bg-gray-700'}`}>
        Top Up
      </div>
    </div>
    <p className="text-sm font-bold self-start px-1 pt-1">Linked Cards</p>
    <div className="w-full bg-rea-gray-dark p-2 rounded-md flex items-center justify-between">
      <p className="text-xs font-semibold">Work Rea Vaya</p>
      <p className="text-sm font-bold">R 120.50</p>
    </div>
    <div className={`w-full flex items-center justify-center py-2 space-x-2 bg-rea-gray-dark border border-dashed border-rea-gray-light rounded-md transition-all duration-300 ${highlight === 'link' ? 'animate-glow border-rea-red text-rea-red' : ''}`}>
      <Icon name="plus" className="w-4 h-4" />
      <span className="text-xs font-semibold">Link a New Card</span>
    </div>
  </div>
);


const AnimatedTutorial: React.FC = () => {
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSceneIndex((prevIndex) => (prevIndex + 1) % scenes.length);
    }, scenes[sceneIndex].duration);
    
    return () => clearTimeout(timer);
  }, [sceneIndex]);

  const CurrentScene = () => {
    switch (sceneIndex) {
      case 0: // Tap to Pay
        return (
          <div className="flex flex-col items-center justify-center h-full text-center bg-gray-800 p-4">
            <div className="relative w-48 h-32 bg-gradient-to-br from-mzansi-flag-red to-mzansi-flag-blue rounded-lg shadow-lg flex flex-col justify-between p-3 text-white from-yellow-400 via-red-500 to-green-500">
              <span className="font-bold text-lg">MzansiPass</span>
              <span className="font-mono text-sm self-end">**** 7890</span>
            </div>
            <Icon name="hand" className="w-12 h-12 text-white absolute bottom-8 right-8 animate-hand-tap" />
          </div>
        );
      case 1: // Wallet Overview
        return <WalletScene />;
      case 2: // Highlight Top Up
        return <WalletScene highlight="topup" />;
      case 3: // Highlight Link Card
        return <WalletScene highlight="link" />;
      case 4: // Planner
         return (
          <div className="flex flex-col items-center justify-center h-full text-center bg-gray-800 p-4">
             <div className="w-full max-w-[90%] bg-gray-700 rounded-md p-2 space-y-1.5">
                <div className="h-4 bg-gray-600 rounded-sm w-3/4"></div>
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-red-500 flex-shrink-0"></div>
                    <div className="h-3 bg-gray-500 rounded-sm w-full"></div>
                </div>
                 <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-400 flex-shrink-0"></div>
                    <div className="h-3 bg-gray-500 rounded-sm w-full"></div>
                </div>
            </div>
          </div>
        );
      case 5: // All Set
        return (
          <div className="flex flex-col items-center justify-center h-full text-center bg-green-600 p-4">
            <Icon name="star" className="w-16 h-16 text-yellow-300" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
      <div key={sceneIndex} className="w-full h-full animate-scene-in">
        <CurrentScene />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center space-x-3">
          <Icon name={scenes[sceneIndex].icon} className="w-5 h-5 text-white" />
          <p className="text-white text-sm font-semibold">{scenes[sceneIndex].title}</p>
        </div>
      </div>
      <div className="absolute top-0 left-0 h-1 bg-rea-gray-dark w-full">
        <div className="h-1 bg-rea-red animate-progress-fill" style={{ animationDuration: `${scenes.reduce((acc, s) => acc + s.duration, 0)}ms` }}></div>
      </div>
    </div>
  );
};


const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  return (
    <Modal title="Welcome to MzansiPass!" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-rea-gray-light text-center">
          Your all-in-one digital wallet for seamless travel across all of Mzansi's public transport. This quick guide will get you started.
        </p>
        <AnimatedTutorial />
        <Button onClick={onClose}>Get Started!</Button>
      </div>
    </Modal>
  );
};

export default TutorialModal;