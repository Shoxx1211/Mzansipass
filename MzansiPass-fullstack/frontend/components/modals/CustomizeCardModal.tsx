import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useData } from '../../context/DataContext';
import { CardTheme } from '../../types';
import { CARD_THEMES } from '../../constants';

interface CustomizeCardModalProps {
  onClose: () => void;
}

const CustomizeCardModal: React.FC<CustomizeCardModalProps> = ({ onClose }) => {
    const { virtualCard, updateCardTheme, updateCardHolderName } = useData();
    const [name, setName] = useState(virtualCard.cardHolderName);
    const [selectedTheme, setSelectedTheme] = useState<CardTheme>(virtualCard.theme);

    const handleSave = () => {
        updateCardHolderName(name);
        updateCardTheme(selectedTheme);
        onClose();
    };
    
    return (
        <Modal title="Customize Card" onClose={onClose}>
            <div className="space-y-6">
                <Input
                    label="Card Holder Name"
                    id="cardHolderName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <div>
                    <label className="block text-sm font-medium text-rea-gray-light mb-2">Card Theme</label>
                    <div className="grid grid-cols-2 gap-3">
                        {(Object.keys(CARD_THEMES) as CardTheme[]).map(theme => (
                            <button
                                key={theme}
                                onClick={() => setSelectedTheme(theme)}
                                className={`h-16 rounded-lg capitalize font-semibold bg-gradient-to-br ${CARD_THEMES[theme]} ${selectedTheme === theme ? 'ring-2 ring-white ring-offset-2 ring-offset-rea-gray-dark' : ''}`}
                            >
                                {theme}
                            </button>
                        ))}
                    </div>
                </div>
                <Button onClick={handleSave}>Save Changes</Button>
            </div>
        </Modal>
    );
};

export default CustomizeCardModal;