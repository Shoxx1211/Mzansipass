import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import { Trip, Transaction, LoyaltyEvent } from '../../types';

type Tab = 'trips' | 'transactions' | 'loyalty';

const ActivityPage: React.FC = () => {
    const { trips, transactions, loyaltyEvents } = useData();
    const [activeTab, setActiveTab] = useState<Tab>('trips');

    const renderTrips = () => (
        <div className="space-y-3">
            {trips.map((trip: Trip) => (
                <div key={trip.id} className="bg-rea-gray-dark p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Icon name={trip.provider === 'Gautrain' ? 'train' : 'bus'} className="w-8 h-8 text-rea-gray-light" />
                        <div>
                            <p className="font-semibold">{trip.from} to {trip.to}</p>
                            <p className="text-sm text-rea-gray-light">{trip.date}</p>
                            {trip.cardNickname && (
                                <p className="text-xs text-gray-400 mt-1">Paid with: <span className="font-medium text-gray-300">{trip.cardNickname}</span></p>
                            )}
                        </div>
                    </div>
                    <p className="font-bold text-rea-red">- R {trip.fare.toFixed(2)}</p>
                </div>
            ))}
        </div>
    );

    const renderTransactions = () => (
        <div className="space-y-3">
            {transactions.map((txn: Transaction) => (
                <div key={txn.id} className="bg-rea-gray-dark p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="font-semibold">Top-up</p>
                        <p className="text-sm text-rea-gray-light">{txn.date}</p>
                    </div>
                    <p className="font-bold text-green-400">+ R {txn.amount.toFixed(2)}</p>
                </div>
            ))}
        </div>
    );
    
    const renderLoyalty = () => (
        <div className="space-y-3">
            {loyaltyEvents.map((event: LoyaltyEvent) => (
                <div key={event.id} className="bg-rea-gray-dark p-4 rounded-lg flex items-center justify-between">
                     <div className="flex items-center space-x-4">
                        <Icon name="star" className={`w-8 h-8 ${event.points < 0 ? 'text-red-500' : event.type === 'bonus' ? 'text-yellow-400' : 'text-green-400'}`} />
                        <div>
                            <p className="font-semibold capitalize">{event.description}</p>
                            <p className="text-sm text-rea-gray-light">{event.date}</p>
                        </div>
                    </div>
                    <p className={`font-bold ${event.points > 0 ? 'text-green-400' : 'text-red-500'}`}>{event.points > 0 ? '+' : ''} {event.points} pts</p>
                </div>
            ))}
        </div>
    );

    return (
        <div className="p-4 space-y-6 pb-24">
            <h1 className="text-3xl font-bold text-center">Activity</h1>
            <div className="flex bg-rea-gray-dark rounded-lg p-1">
                <button onClick={() => setActiveTab('trips')} className={`w-full py-2 rounded-md font-semibold ${activeTab === 'trips' ? 'bg-rea-red' : ''}`}>Trip History</button>
                <button onClick={() => setActiveTab('transactions')} className={`w-full py-2 rounded-md font-semibold ${activeTab === 'transactions' ? 'bg-rea-red' : ''}`}>Transactions</button>
                <button onClick={() => setActiveTab('loyalty')} className={`w-full py-2 rounded-md font-semibold ${activeTab === 'loyalty' ? 'bg-rea-red' : ''}`}>Loyalty</button>
            </div>
            <div>
                {activeTab === 'trips' && renderTrips()}
                {activeTab === 'transactions' && renderTransactions()}
                {activeTab === 'loyalty' && renderLoyalty()}
            </div>
        </div>
    );
};

export default ActivityPage;