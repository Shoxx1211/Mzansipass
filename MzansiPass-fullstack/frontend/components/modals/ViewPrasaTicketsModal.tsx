import React from 'react';
import Modal from '../ui/Modal';
import { useData } from '../../context/DataContext';
import PrasaTicketCard from '../ui/PrasaTicketCard';
import Icon from '../ui/Icon';

interface ViewPrasaTicketsModalProps {
  onClose: () => void;
}

const ViewPrasaTicketsModal: React.FC<ViewPrasaTicketsModalProps> = ({ onClose }) => {
  const { prasaTickets } = useData();

  // For this demo, we'll only show active tickets.
  // A full app might have tabs for active/expired.
  const activeTickets = prasaTickets.filter(t => t.status === 'active');

  return (
    <Modal title="My PRASA Tickets" onClose={onClose}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {activeTickets.length > 0 ? (
          activeTickets.map(ticket => (
            <PrasaTicketCard key={ticket.id} ticket={ticket} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 bg-gray-800 rounded-lg">
            <Icon name="ticket" className="w-12 h-12 text-rea-gray-light mb-4" />
            <h3 className="font-bold text-lg">No Active Tickets</h3>
            <p className="text-rea-gray-light">You don't have any PRASA tickets yet. Buy one from the wallet screen to get started.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ViewPrasaTicketsModal;