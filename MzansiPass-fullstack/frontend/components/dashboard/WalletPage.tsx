import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import { PROVIDER_COLORS } from '../../constants';
import TopUpModal from '../modals/TopUpModal';
import LinkCardModal from '../modals/LinkCardModal';
import VirtualCard from '../ui/VirtualCard';
import BuyPrasaTicketModal from '../modals/BuyPrasaTicketModal';
import ViewPrasaTicketsModal from '../modals/ViewPrasaTicketsModal';

const WalletPage: React.FC = () => {
    const { virtualCard, physicalCards, unlinkCard, prasaTickets } = useData();
    const totalBalance = virtualCard.balance + physicalCards.reduce((sum, card) => sum + card.balance, 0);

    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [isLinkCardModalOpen, setIsLinkCardModalOpen] = useState(false);
    const [isBuyPrasaModalOpen, setIsBuyPrasaModalOpen] = useState(false);
    const [isViewPrasaModalOpen, setIsViewPrasaModalOpen] = useState(false);

    const openTopUpModal = (cardId: string | null = null) => {
        setSelectedCardId(cardId);
        setIsTopUpModalOpen(true);
    };

    return (
        <div className="p-4 space-y-6 pb-24">
            <header className="text-center">
                <p className="text-rea-gray-light">Total Available Balance</p>
                <h1 className="text-5xl font-extrabold text-rea-white">R {totalBalance.toFixed(2)}</h1>
            </header>

            <section className="space-y-4">
                <h2 className="text-xl font-bold">Virtual Card</h2>
                <div className="px-4">
                    <VirtualCard
                        isFlipped={false}
                        onTap={() => {}}
                    />
                </div>
                <div className="bg-rea-gray-dark p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="font-semibold">Card Balance</p>
                        <p className="text-2xl font-bold">R {virtualCard.balance.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => openTopUpModal(null)} className="w-auto px-6 py-2 text-base">Top Up</Button>
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold">PRASA Metrorail</h2>
                <div className="bg-rea-gray-dark p-4 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-3">
                            <Icon name="ticket" className="w-8 h-8 text-purple-400" />
                            <div>
                                <p className="font-semibold">Digital Tickets</p>
                                <p className="text-sm text-rea-gray-light">{prasaTickets.filter(t => t.status === 'active').length} active tickets</p>
                            </div>
                        </div>
                        <Button onClick={() => setIsViewPrasaModalOpen(true)} variant="secondary" className="w-auto px-4 py-2 text-sm">View</Button>
                    </div>
                    <Button onClick={() => setIsBuyPrasaModalOpen(true)} leftIcon={<Icon name="plus" className="w-5 h-5"/>} className="text-base">
                        Buy New Ticket
                    </Button>
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Linked Physical Cards</h2>
                    <span className="text-rea-gray-light font-semibold">{physicalCards.length}</span>
                </div>
                <div className="space-y-3">
                    {physicalCards.map(card => (
                        <div key={card.id} className="bg-rea-gray-dark p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{card.nickname}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROVIDER_COLORS[card.provider]}`}>{card.provider}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-xl font-bold">R {card.balance.toFixed(2)}</p>
                                    <button onClick={() => unlinkCard(card.id)} className="text-xs text-red-500 hover:underline">Unlink</button>
                                </div>
                                <Button variant="secondary" onClick={() => openTopUpModal(card.id)} className="w-auto px-4 !py-2 text-sm self-center">Top Up</Button>
                            </div>
                        </div>
                    ))}
                </div>
                 <button onClick={() => setIsLinkCardModalOpen(true)} className="w-full flex items-center justify-center py-3 space-x-2 bg-rea-gray-dark border border-dashed border-rea-gray-light rounded-lg hover:bg-gray-700 transition-colors">
                    <Icon name="plus" className="w-6 h-6" />
                    <span className="font-semibold">Link a New Physical Card</span>
                </button>
            </section>

            {isTopUpModalOpen && <TopUpModal onClose={() => setIsTopUpModalOpen(false)} cardId={selectedCardId} />}
            {isLinkCardModalOpen && <LinkCardModal onClose={() => setIsLinkCardModalOpen(false)} />}
            {isBuyPrasaModalOpen && <BuyPrasaTicketModal onClose={() => setIsBuyPrasaModalOpen(false)} />}
            {isViewPrasaModalOpen && <ViewPrasaTicketsModal onClose={() => setIsViewPrasaModalOpen(false)} />}
        </div>
    );
};

export default WalletPage;