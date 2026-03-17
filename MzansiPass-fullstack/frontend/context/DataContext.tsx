import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { User, VirtualCard, PhysicalCard, Trip, Transaction, LoyaltyEvent, Provider, CardTheme, PrasaTicket, PrasaTicketType, Challenge, Reward, ChallengeProgress, TransitAlert, ReportCategory } from '../types';
import { DEMO_USER, DEMO_VIRTUAL_CARD, DEMO_PHYSICAL_CARDS, DEMO_TRIPS, DEMO_TRANSACTIONS, DEMO_LOYALTY_EVENTS, DEMO_CHALLENGES, DEMO_REWARDS, DEMO_TRANSIT_ALERTS } from '../constants';

interface DataContextType {
  user: User;
  virtualCard: VirtualCard;
  physicalCards: PhysicalCard[];
  trips: Trip[];
  transactions: Transaction[];
  loyaltyEvents: LoyaltyEvent[];
  prasaTickets: PrasaTicket[];
  challenges: Challenge[];
  rewards: Reward[];
  challengeProgress: ChallengeProgress[];
  transitAlerts: TransitAlert[];
  addFunds: (amount: number, cardId?: string) => void;
  linkNewCard: (provider: Provider, cardNumber: string, nickname: string) => void;
  unlinkCard: (id: string) => void;
  startTrip: (provider: Provider, from: string) => Trip;
  endTrip: (trip: Trip, to: string) => void;
  updateCardTheme: (theme: CardTheme) => void;
  updateCardHolderName: (name: string) => void;
  createNewUser: (fullName: string) => void;
  purchasePrasaTicket: (type: PrasaTicketType, from: string, to: string, fare: number) => void;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  redeemReward: (rewardId: string) => void;
  addTransitAlert: (provider: Provider, category: ReportCategory, title: string, description: string) => void;
  notifyContact: (message: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(DEMO_USER);
  const [virtualCard, setVirtualCard] = useState<VirtualCard>(DEMO_VIRTUAL_CARD);
  const [physicalCards, setPhysicalCards] = useState<PhysicalCard[]>(DEMO_PHYSICAL_CARDS);
  const [trips, setTrips] = useState<Trip[]>(DEMO_TRIPS);
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [loyaltyEvents, setLoyaltyEvents] = useState<LoyaltyEvent[]>(DEMO_LOYALTY_EVENTS);
  const [prasaTickets, setPrasaTickets] = useState<PrasaTicket[]>([]);
  const [transitAlerts, setTransitAlerts] = useState<TransitAlert[]>(DEMO_TRANSIT_ALERTS);
  
  // Loyalty Program State
  const [challenges, setChallenges] = useState<Challenge[]>(DEMO_CHALLENGES);
  const [rewards, setRewards] = useState<Reward[]>(DEMO_REWARDS);
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress[]>(
    DEMO_CHALLENGES.map(c => ({ challengeId: c.id, current: 0, completed: false }))
  );

  const checkAndCompleteChallenges = useCallback(() => {
    setChallengeProgress(prevProgress => {
      const newProgress = [...prevProgress];
      let pointsToAdd = 0;
      const newLoyaltyEvents: LoyaltyEvent[] = [];

      newProgress.forEach(progress => {
        if (progress.completed) return;

        const challenge = challenges.find(c => c.id === progress.challengeId);
        if (challenge && progress.current >= challenge.goal) {
          progress.completed = true;
          pointsToAdd += challenge.points;
          newLoyaltyEvents.push({
            id: `le-challenge-${challenge.id}-${Date.now()}`,
            type: 'bonus',
            description: `Challenge Complete: ${challenge.title}`,
            date: new Date().toISOString().split('T')[0],
            points: challenge.points,
          });
        }
      });

      if (pointsToAdd > 0) {
        setUser(prevUser => ({...prevUser, loyaltyPoints: prevUser.loyaltyPoints + pointsToAdd }));
        setLoyaltyEvents(prevEvents => [...newLoyaltyEvents, ...prevEvents]);
      }
      return newProgress;
    });
  }, [challenges]);


  const addFunds = useCallback((amount: number, cardId?: string) => {
    if (cardId) {
        setPhysicalCards(prev =>
            prev.map(card =>
                card.id === cardId ? { ...card, balance: card.balance + amount } : card
            )
        );
    } else {
        setVirtualCard(prev => ({ ...prev, balance: prev.balance + amount }));
    }

    const newTransaction: Transaction = {
      id: `txn-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount,
      status: 'Completed',
    };
    setTransactions(prev => [newTransaction, ...prev]);
    const points = Math.floor(amount / 10);
    const newLoyaltyEvent: LoyaltyEvent = {
        id: `le-${Date.now()}`,
        type: 'top-up',
        description: `Top-up R${amount.toFixed(2)}`,
        date: new Date().toISOString().split('T')[0],
        points,
    };
    setLoyaltyEvents(prev => [newLoyaltyEvent, ...prev]);
    setUser(prev => ({ ...prev, loyaltyPoints: prev.loyaltyPoints + points }));
    
    // Update challenge progress for top-ups
    setChallengeProgress(prev => prev.map(p => {
        const challenge = challenges.find(c => c.id === p.challengeId);
        if (challenge?.type === 'top_up_amount' && !p.completed) {
            return { ...p, current: p.current + amount };
        }
        return p;
    }));
    checkAndCompleteChallenges();

  }, [challenges, checkAndCompleteChallenges]);

  const linkNewCard = useCallback((provider: Provider, cardNumber: string, nickname: string) => {
    const newCard: PhysicalCard = {
      id: `pc-${Date.now()}`,
      provider,
      cardNumber,
      nickname,
      balance: Math.floor(Math.random() * 200), // Random balance for demo
    };
    setPhysicalCards(prev => [...prev, newCard]);
  }, []);

  const unlinkCard = useCallback((id: string) => {
    setPhysicalCards(prev => prev.filter(card => card.id !== id));
  }, []);
  
  const startTrip = useCallback((provider: Provider, from: string): Trip => {
    return {
        id: `trip-${Date.now()}`,
        provider,
        from,
        to: 'Destination', // Placeholder destination
        date: new Date().toISOString().split('T')[0],
        fare: 0,
    };
  }, []);
  
  const endTrip = useCallback((trip: Trip, to: string) => {
    const fare = Math.floor(Math.random() * 30) + 5; // Random fare
    let completedTrip: Trip | null = null;

    // Deduct from a card with enough balance
    if(virtualCard.balance >= fare) {
        setVirtualCard(prev => ({ ...prev, balance: prev.balance - fare}));
        completedTrip = { 
            ...trip, 
            to, 
            fare, 
            cardId: 'virtual-card', 
            cardNickname: 'Virtual Card' 
        };
    } else {
        const cardIndex = physicalCards.findIndex(c => c.balance >= fare);
        if(cardIndex !== -1) {
            const payingCard = physicalCards[cardIndex];
            const updatedCards = [...physicalCards];
            updatedCards[cardIndex].balance -= fare;
            setPhysicalCards(updatedCards);
            completedTrip = { 
                ...trip, 
                to, 
                fare, 
                cardId: payingCard.id, 
                cardNickname: payingCard.nickname 
            };
        }
    }
    
    if (completedTrip) {
        setTrips(prev => [completedTrip!, ...prev]);
        const points = Math.floor(fare);
        const newLoyaltyEvent: LoyaltyEvent = {
            id: `le-${Date.now()}`,
            type: 'trip',
            description: `Trip from ${trip.from}`,
            date: trip.date,
            points,
        };
        setLoyaltyEvents(prev => [newLoyaltyEvent, ...prev]);
        setUser(prev => ({ ...prev, loyaltyPoints: prev.loyaltyPoints + points }));

        // Update challenge progress for trips
        setChallengeProgress(prev => prev.map(p => {
          const challenge = challenges.find(c => c.id === p.challengeId);
          if (challenge?.type === 'trip_count' && !p.completed) {
            return { ...p, current: p.current + 1 };
          }
          return p;
        }));
        checkAndCompleteChallenges();
    }
  }, [virtualCard.balance, physicalCards, challenges, checkAndCompleteChallenges]);

  const updateCardTheme = useCallback((theme: CardTheme) => {
    setVirtualCard(prev => ({ ...prev, theme }));
  }, []);
  
  const updateCardHolderName = useCallback((name: string) => {
    setVirtualCard(prev => ({ ...prev, cardHolderName: name }));
    setUser(prev => ({ ...prev, fullName: name}));
  }, []);
  
  const createNewUser = useCallback((fullName: string) => {
    const generateCardNumber = () => {
        const prefix = '5018';
        const part2 = String(Math.floor(1000 + Math.random() * 9000));
        const part3 = String(Math.floor(1000 + Math.random() * 9000));
        const part4 = String(Math.floor(1000 + Math.random() * 9000));
        return `${prefix} ${part2} ${part3} ${part4}`;
    };

    const newCardNumber = generateCardNumber();
    
    const newUser: User = {
      id: `user-${Date.now()}`,
      fullName,
      email: `${fullName.split(' ')[0].toLowerCase()}@mzansipass.co.za`,
      loyaltyPoints: 100,
      pin: undefined,
    };
    
    const newVirtualCard: VirtualCard = {
      ...DEMO_VIRTUAL_CARD,
      cardNumber: newCardNumber,
      cardHolderName: fullName,
      balance: 50.00,
      theme: 'mzansi',
    };

    const welcomeBonusEvent: LoyaltyEvent = {
        id: `le-${Date.now()}`,
        type: 'bonus',
        description: 'Welcome Bonus',
        date: new Date().toISOString().split('T')[0],
        points: 100,
    };
    
    setUser(newUser);
    setVirtualCard(newVirtualCard);
    setPhysicalCards([]);
    setTrips([]);
    setTransactions([]);
    setLoyaltyEvents([welcomeBonusEvent]);
    setChallengeProgress(DEMO_CHALLENGES.map(c => ({ challengeId: c.id, current: 0, completed: false })));
  }, []);

  const purchasePrasaTicket = useCallback((type: PrasaTicketType, from: string, to: string, fare: number) => {
    if (virtualCard.balance < fare) {
      throw new Error("Insufficient balance");
    }

    setVirtualCard(prev => ({...prev, balance: prev.balance - fare}));
    
    const newTransaction: Transaction = {
      id: `txn-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: -fare,
      status: 'Completed',
    };
    setTransactions(prev => [newTransaction, ...prev]);

    const points = Math.floor(fare / 2);
    const newLoyaltyEvent: LoyaltyEvent = {
      id: `le-${Date.now()}`,
      type: 'trip',
      description: `PRASA Ticket Purchase`,
      date: new Date().toISOString().split('T')[0],
      points,
    };
    setLoyaltyEvents(prev => [newLoyaltyEvent, ...prev]);
    setUser(prev => ({...prev, loyaltyPoints: prev.loyaltyPoints + points}));

    const purchaseDate = new Date();
    const validUntil = new Date(purchaseDate);
    if(type === 'single') validUntil.setDate(purchaseDate.getDate() + 1);
    if(type === 'return') validUntil.setDate(purchaseDate.getDate() + 1);
    if(type === 'weekly') validUntil.setDate(purchaseDate.getDate() + 7);
    if(type === 'monthly') validUntil.setMonth(purchaseDate.getMonth() + 1);

    const newTicket: PrasaTicket = {
      id: `prasa-${Date.now()}`,
      ticketType: type,
      from,
      to,
      purchaseDate: purchaseDate.toISOString().split('T')[0],
      validUntil: validUntil.toISOString().split('T')[0],
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=MzansiPass-PRASA-${Date.now()}`, // Simulated QR
      fare,
      status: 'active',
    };
    setPrasaTickets(prev => [newTicket, ...prev]);
  }, [virtualCard.balance]);

  const setPin = useCallback((pin: string) => {
    setUser(prev => ({ ...prev, pin }));
  }, []);

  const verifyPin = useCallback((pin: string): boolean => {
    return user.pin === pin;
  }, [user.pin]);
  
  const redeemReward = useCallback((rewardId: string) => {
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) {
        throw new Error("Reward not found.");
    }
    if (user.loyaltyPoints < reward.cost) {
        throw new Error("Not enough points.");
    }
    
    // Deduct points
    setUser(prev => ({...prev, loyaltyPoints: prev.loyaltyPoints - reward.cost }));
    
    // Apply reward effect
    if (reward.type === 'top_up_voucher') {
      setVirtualCard(prev => ({...prev, balance: prev.balance + reward.value}));
    }
    
    // Create loyalty event for redemption
    const newLoyaltyEvent: LoyaltyEvent = {
      id: `le-redeem-${Date.now()}`,
      type: 'redeem',
      description: `Redeemed: ${reward.title}`,
      date: new Date().toISOString().split('T')[0],
      points: -reward.cost, // Negative points for redemption
    };
    setLoyaltyEvents(prev => [newLoyaltyEvent, ...prev]);
  }, [user.loyaltyPoints, rewards]);

  const addTransitAlert = useCallback((provider: Provider, category: ReportCategory, title: string, description: string) => {
    const newAlert: TransitAlert = {
      id: `alert-${Date.now()}`,
      type: 'user_report',
      provider,
      category,
      title,
      description,
      timestamp: new Date().toISOString(),
    };
    setTransitAlerts(prev => [newAlert, ...prev]);
  }, []);

  const notifyContact = useCallback((message: string) => {
    // This is a simulation. In a real app, this would trigger an SMS or push notification.
    console.log(`SIMULATING NOTIFICATION: ${message}`);
    // Award loyalty points for being considerate
    const points = 10;
    const newLoyaltyEvent: LoyaltyEvent = {
        id: `le-contact-${Date.now()}`,
        type: 'contact',
        description: 'Notified contact about delay',
        date: new Date().toISOString().split('T')[0],
        points: points,
    };
    setLoyaltyEvents(prev => [newLoyaltyEvent, ...prev]);
    setUser(prev => ({ ...prev, loyaltyPoints: prev.loyaltyPoints + points }));
  }, []);

  return (
    <DataContext.Provider value={{ user, virtualCard, physicalCards, trips, transactions, loyaltyEvents, prasaTickets, challenges, rewards, challengeProgress, transitAlerts, addFunds, linkNewCard, unlinkCard, startTrip, endTrip, updateCardTheme, updateCardHolderName, createNewUser, purchasePrasaTicket, setPin, verifyPin, redeemReward, addTransitAlert, notifyContact }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};