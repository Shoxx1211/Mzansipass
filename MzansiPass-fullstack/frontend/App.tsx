import React, { useState, useCallback } from 'react';
import LoginScreen from './components/auth/LoginScreen';
import RegisterScreen from './components/auth/RegisterScreen';
import Dashboard from './components/dashboard/Dashboard';
import { DataProvider } from './context/DataContext';
import PinLockScreen from './components/auth/PinLockScreen';
import { useData } from './context/DataContext';

type View = 'login' | 'register' | 'dashboard';

const AppContent: React.FC = () => {
  const { createNewUser, user, verifyPin } = useData();
  const [currentView, setCurrentView] = useState<View>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
    setCurrentView('dashboard');
    setIsLocked(!!user.pin);
  }, [user.pin]);

  const handleRegister = useCallback((fullName: string) => {
    createNewUser(fullName);
    setIsAuthenticated(true);
    setCurrentView('dashboard');
    setShowTutorial(true);
    // New users don't have a PIN, so they are not locked initially.
    // They will be prompted to set one in the Profile section.
    setIsLocked(false); 
  }, [createNewUser]);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setIsLocked(true);
    setCurrentView('login');
  }, []);
  
  const handleUnlock = useCallback((pin: string) => {
    if (verifyPin(pin)) {
        setIsLocked(false);
        return true;
    }
    return false;
  }, [verifyPin]);

  const switchView = useCallback((view: View) => {
    setCurrentView(view);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const renderContent = () => {
    if (isAuthenticated) {
      if (isLocked) {
        return <PinLockScreen onUnlock={handleUnlock} />;
      }
      return <Dashboard onLogout={handleLogout} showTutorial={showTutorial} onCloseTutorial={handleCloseTutorial} />;
    }
    switch (currentView) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} onSwitchToRegister={() => switchView('register')} />;
      case 'register':
        return <RegisterScreen onRegister={handleRegister} onSwitchToLogin={() => switchView('login')} />;
      default:
        return <LoginScreen onLogin={handleLogin} onSwitchToRegister={() => switchView('register')} />;
    }
  };

  return <div className="min-h-screen bg-rea-black">{renderContent()}</div>;
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
};

export default App;