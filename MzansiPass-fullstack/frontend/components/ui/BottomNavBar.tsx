import React from 'react';
import Icon from './Icon';

type Page = 'home' | 'wallet' | 'activity' | 'explorer' | 'profile';

interface BottomNavBarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'explorer', label: 'Explorer', icon: 'sparkles' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
];

const NavItem: React.FC<{
    item: { id: Page; label: string; icon: string };
    isActive: boolean;
    onClick: () => void;
}> = ({ item, isActive, onClick }) => (
    <button
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200"
        aria-label={item.label}
    >
        {/* Tooltip on hover */}
        <span className="absolute bottom-full mb-2 w-max px-3 py-1.5 bg-rea-white text-rea-black text-sm font-bold rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
            {item.label}
            {/* Tooltip arrow */}
            <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-rea-white"></span>
        </span>
        <div className="relative w-full flex justify-center">
            {isActive && <div className="absolute -top-2 h-1 w-8 bg-rea-red rounded-full"></div>}
            <Icon name={item.icon} className={`h-6 w-6 mb-1 ${isActive ? 'text-rea-red' : 'text-rea-gray-light'}`} />
        </div>
        <span className={`text-xs font-medium ${isActive ? 'text-rea-white' : 'text-rea-gray-light'}`}>
            {item.label}
        </span>
    </button>
);


const BottomNavBar: React.FC<BottomNavBarProps> = ({ activePage, setActivePage }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-rea-gray-dark border-t border-gray-700 flex items-center justify-around z-50">
      {navItems.map((item) => (
        <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            onClick={() => setActivePage(item.id)}
        />
      ))}
    </nav>
  );
};

export default BottomNavBar;