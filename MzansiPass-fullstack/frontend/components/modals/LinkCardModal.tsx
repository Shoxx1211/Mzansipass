import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useData } from '../../context/DataContext';
import { Provider } from '../../types';
import { STATIONS } from '../../constants';

interface LinkCardModalProps {
  onClose: () => void;
}

const LinkCardModal: React.FC<LinkCardModalProps> = ({ onClose }) => {
    const [provider, setProvider] = useState<Provider>('Rea Vaya');
    const [cardNumber, setCardNumber] = useState('');
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');
    const { linkNewCard } = useData();

    const handleValueChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        if (error) {
            setError(''); // Clear error when user types
        }
    };

    const handleLinkCard = () => {
        // Validate card number: must be 4 characters and all digits
        if (!/^\d{4}$/.test(cardNumber)) {
            setError('Please enter the last 4 digits of your card.');
            return;
        }
        // Validate nickname: cannot be empty
        if (!nickname.trim()) {
            setError('Please enter a nickname for your card.');
            return;
        }
        
        // If validation passes
        linkNewCard(provider, `**** ${cardNumber}`, nickname);
        onClose();
    };

    return (
        <Modal title="Link New Card" onClose={onClose}>
            <div className="space-y-4">
                <div>
                    <label htmlFor="provider" className="block text-sm font-medium text-rea-gray-light mb-1">Card Provider</label>
                    <select
                        id="provider"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as Provider)}
                        className="w-full bg-rea-gray-dark border border-gray-600 rounded-lg px-4 py-3 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
                    >
                        {(Object.keys(STATIONS) as Provider[]).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <Input
                    label="Physical Card Number"
                    id="cardNumber"
                    value={cardNumber}
                    onChange={handleValueChange(setCardNumber)}
                    placeholder="Enter last 4 digits"
                    maxLength={4}
                    type="tel"
                    inputMode="numeric"
                />
                <Input
                    label="Card Nickname"
                    id="nickname"
                    value={nickname}
                    onChange={handleValueChange(setNickname)}
                    placeholder="e.g., Work Metrobus"
                />

                {error && <p className="text-red-500 text-sm text-center -my-2">{error}</p>}
                
                <Button onClick={handleLinkCard}>Link Card</Button>
            </div>
        </Modal>
    );
};

export default LinkCardModal;