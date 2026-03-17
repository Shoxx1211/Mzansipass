import React from 'react';
import { useData } from '../../context/DataContext';
import { CARD_THEMES } from '../../constants';
import { VirtualCard as VirtualCardType, CardTheme } from '../../types';

interface VirtualCardProps {
    card?: VirtualCardType;
    isFlipped: boolean; // "isFlipped" is kept for prop compatibility, but now means "is trip in progress"
    onTap: () => void;
    interactiveHover?: boolean;
    showTapPrompt?: boolean;
}

const BackgroundPattern: React.FC<{ theme: CardTheme }> = React.memo(({ theme }) => {
    const patterns: Partial<Record<CardTheme, string>> = {
        mzansi: "bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.1)_0%,_rgba(255,255,255,0)_60%)] bg-[length:30px_30px]",
        ocean: "bg-[linear-gradient(45deg,_rgba(255,255,255,0.05)_25%,_transparent_25%,_transparent_50%,_rgba(255,255,255,0.05)_50%,_rgba(255,255,255,0.05)_75%,_transparent_75%,_transparent)] bg-[length:40px_40px]",
        forest: "bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22/%3E%3C/g%3E%3C/svg%3E')]",
        sunset: "bg-[radial-gradient(circle_farthest-side_at_0%_0%,_rgba(255,255,255,0.1),_transparent),_radial-gradient(circle_farthest-side_at_100%_100%,_rgba(255,255,255,0.1),_transparent)] bg-[length:50px_50px]"
    };
    const patternClass = patterns[theme] || '';
    return <div className={`absolute inset-0 transition-opacity duration-500 ${patternClass}`} />;
});

const ContactlessIcon: React.FC<{ isTripInProgress: boolean }> = ({ isTripInProgress }) => (
     <svg className={`w-8 h-8 text-white transition-opacity duration-300 ${!isTripInProgress ? 'animate-pulse' : 'opacity-70'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-90 12 12)">
        <path d="M5.5 5.5a9.5 9.5 0 0 1 13 0" />
        <path d="M8 8a6 6 0 0 1 8 0" />
        <path d="M10.5 10.5a2.5 2.5 0 0 1 3 0" />
    </svg>
);


const VirtualCard: React.FC<VirtualCardProps> = ({ card, isFlipped, onTap, interactiveHover = false, showTapPrompt = false }) => {
    const { virtualCard: contextCard } = useData();
    const displayCard = card || contextCard;

    const themeClass = CARD_THEMES[displayCard.theme] || CARD_THEMES.mzansi;
    
    const formatCardNumber = (number: string) => {
        return number.replace(/\s/g, '').match(/.{1,4}/g)?.join(' ') || number;
    };

    return (
        <div 
            className={`w-full max-w-md mx-auto aspect-[1.586] transition-transform transform active:scale-95 ${interactiveHover ? 'hover:scale-105' : ''}`}
            onClick={onTap}
            aria-pressed={isFlipped} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTap(); }}
        >
            <div className={`relative w-full h-full rounded-2xl shadow-2xl flex flex-col p-6 bg-gradient-to-br ${themeClass} overflow-hidden text-white`}>
                <BackgroundPattern theme={displayCard.theme} />
                
                {showTapPrompt && !isFlipped && (
                    <div className="absolute top-2/3 left-0 right-0 flex justify-center z-20 pointer-events-none">
                        <p className="font-bold text-lg text-white/80 animate-pulse" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
                            Tap to Pay
                        </p>
                    </div>
                )}

                {isFlipped ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center z-10 animate-fade-in-up">
                        <div className="relative flex items-center justify-center w-24 h-24">
                            <div className="absolute inset-0 bg-rea-red/50 rounded-full animate-ping"></div>
                            <div className="relative w-20 h-20 bg-rea-red/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <ContactlessIcon isTripInProgress={true} />
                            </div>
                        </div>
                        <p className="mt-4 text-2xl font-bold tracking-tight text-white">Trip in Progress</p>
                        <p className="text-base text-gray-300 mt-1">Tap to End Journey</p>
                    </div>
                ) : (
                    <div className="flex flex-col justify-between h-full z-10">
                        <header className="flex justify-between items-start">
                            <div className="relative text-2xl" style={{ textShadow: '0 2px 2px rgba(0,0,0,0.3)' }}>
                                <span className="font-black">Mzansi</span><span className="font-thin">Pass</span>
                            </div>
                            <ContactlessIcon isTripInProgress={false} />
                        </header>

                        <main>
                            <p className="text-2xl md:text-3xl font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-300" style={{textShadow: '0 1px 0 rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.8)'}}>
                                {formatCardNumber(displayCard.cardNumber)}
                            </p>
                        </main>

                        <footer className="flex justify-between items-end">
                            <div>
                                <p className="text-xs opacity-70 uppercase tracking-wider">Card Holder</p>
                                <p className="font-semibold uppercase tracking-wide" style={{textShadow: '0 1px 0 rgba(255,255,255,0.2), 0 2px 3px rgba(0,0,0,0.5)'}}>
                                    {displayCard.cardHolderName}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs opacity-70 uppercase tracking-wider">Valid Thru</p>
                                <p className="font-mono" style={{textShadow: '0 1px 0 rgba(255,255,255,0.2), 0 2px 3px rgba(0,0,0,0.5)'}}>
                                    {displayCard.validThru}
                                </p>
                            </div>
                        </footer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VirtualCard;