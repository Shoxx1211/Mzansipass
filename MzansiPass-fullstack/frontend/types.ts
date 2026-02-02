import { LiveJourneyUpdate } from './services/geminiService';

export interface User {
  id: string;
  fullName: string;
  email: string;
  loyaltyPoints: number;
  pin?: string;
}

export type CardTheme = 'mzansi' | 'ocean' | 'forest' | 'sunset' | 'charcoal';

export interface VirtualCard {
  cardNumber: string;
  cardHolderName: string;
  validThru: string;
  balance: number;
  theme: CardTheme;
}

export type Provider = 'Rea Vaya' | 'Metrobus' | 'Gautrain' | 'MyCiTi' | 'Areyeng' | 'Tshwane Bus Service' | 'PRASA';

export interface PhysicalCard {
  id: string;
  provider: Provider;
  cardNumber: string;
  nickname: string;
  balance: number;
}

export interface Trip {
  id: string;
  provider: Provider;
  from: string;
  to: string;
  date: string;
  fare: number;
  cardId?: string;
  cardNickname?: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
}

export interface LoyaltyEvent {
  id:string;
  type: 'trip' | 'top-up' | 'bonus' | 'redeem' | 'contact';
  description: string;
  date: string;
  points: number;
}

export interface RouteStep {
  provider: Provider;
  from: string;
  to: string;
  instruction: string;
}

export interface RouteOption {
  title: string;
  tag: 'Recommended' | 'Cheapest' | 'Fastest';
  totalFare: number;
  travelTime: string;
  steps: RouteStep[];
}

export type PrasaTicketType = 'single' | 'return' | 'weekly' | 'monthly';

export interface PrasaTicket {
  id: string;
  ticketType: PrasaTicketType;
  from: string;
  to: string;
  purchaseDate: string;
  validUntil: string;
  qrCodeUrl: string; // Simulated URL for QR code image/data
  fare: number;
  status: 'active' | 'expired';
}

// Loyalty & Rewards Program Types
export interface Challenge {
  id: string;
  title: string;
  description: string;
  points: number;
  goal: number; // e.g., number of trips, amount to top-up
  type: 'trip_count' | 'top_up_amount';
}

export interface ChallengeProgress {
  challengeId: string;
  current: number;
  completed: boolean;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  cost: number;
  type: 'top_up_voucher';
  value: number; // e.g., the amount of the voucher
}

// Live Transit Feed Types
export type AlertType = 'official' | 'user_report';
export type ReportCategory = 'crowded' | 'delay' | 'hazard' | 'info' | 'other';

export interface TransitAlert {
  id: string;
  type: AlertType;
  provider?: Provider;
  category: ReportCategory;
  title: string;
  description: string;
  timestamp: string; // ISO string
}