import React, { useState } from 'react';
import BottomNavBar from '../ui/BottomNavBar';
import HomePage from './HomePage';
import WalletPage from './WalletPage';
import ActivityPage from './ActivityPage';
import ExplorerPage from './ExplorerPage';
import ProfilePage from './ProfilePage';
import TutorialModal from '../modals/TutorialModal';

type Page = 'home' | 'wallet' | 'activity' | 'explorer' | 'profile';

interface DashboardProps {
  onLogout: () => void;
  showTutorial: boolean;
  onCloseTutorial: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, showTutorial, onCloseTutorial }) => {
  const [activePage, setActivePage] = useState<Page>('home');

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <HomePage />;
      case 'wallet':
        return <WalletPage />;
      case 'activity':
        return <ActivityPage />;
      case 'explorer':
        return <ExplorerPage />;
      case 'profile':
        return <ProfilePage onLogout={onLogout} />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 overflow-y-auto pb-20">
        {renderPage()}
      </main>
      <BottomNavBar activePage={activePage} setActivePage={setActivePage} />
      {showTutorial && <TutorialModal onClose={onCloseTutorial} />}
    </div>
  );
};

export default Dashboard;