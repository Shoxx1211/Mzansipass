import React from 'react';
import { PrasaTicket } from '../../types';
import { PROVIDER_COLORS } from '../../constants';
import Icon from './Icon';

interface PrasaTicketCardProps {
  ticket: PrasaTicket;
}

const PrasaTicketCard: React.FC<PrasaTicketCardProps> = ({ ticket }) => {
  return (
    <div className="bg-rea-gray-dark rounded-lg flex overflow-hidden shadow-md">
      <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center p-2 text-center ${PROVIDER_COLORS['PRASA']}`}>
        <Icon name="train" className="w-6 h-6 mb-1" />
        <p className="font-black text-sm leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
          METRORAIL
        </p>
      </div>
      <div className="flex-grow p-4 border-l-2 border-dashed border-gray-600 relative">
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-rea-black rounded-full"></div>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-xs uppercase text-rea-gray-light">{ticket.ticketType} Ticket</p>
                <h3 className="font-bold text-lg leading-tight">{ticket.from}</h3>
                <p className="text-xs text-rea-gray-light">to</p>
                <h3 className="font-bold text-lg leading-tight">{ticket.to}</h3>
            </div>
            <div className="bg-white p-1 rounded-md">
                <img src={ticket.qrCodeUrl} alt="QR Code" className="w-16 h-16" />
            </div>
        </div>
        <div className="border-t border-gray-700 mt-3 pt-2 flex justify-between items-center text-xs text-rea-gray-light">
            <div>
                <p>Purchased: {ticket.purchaseDate}</p>
                <p>Valid Until: <span className="font-semibold text-white">{ticket.validUntil}</span></p>
            </div>
            <p className="font-mono text-rea-white">ID: {ticket.id.slice(-6)}</p>
        </div>
      </div>
    </div>
  );
};

export default PrasaTicketCard;