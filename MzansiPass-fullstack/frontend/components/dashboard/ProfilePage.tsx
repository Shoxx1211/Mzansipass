import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Reward } from '../../types';
import SetPinModal from '../modals/SetPinModal';
import RedeemRewardModal from '../modals/RedeemRewardModal';

interface ProfilePageProps {
  onLogout: () => void;
}

const ChallengeCard: React.FC = () => {
    const { challenges, challengeProgress } = useData();
    return (
        <section className="bg-rea-gray-dark p-4 rounded-lg space-y-4">
            <h2 className="text-xl font-bold text-center flex items-center justify-center gap-2">
                <Icon name="trophy" className="w-6 h-6 text-yellow-400" />
                Loyalty Challenges
            </h2>
            <div className="space-y-3">
                {challenges.map(challenge => {
                    const progress = challengeProgress.find(p => p.challengeId === challenge.id);
                    const current = progress?.current || 0;
                    const percentage = Math.min((current / challenge.goal) * 100, 100);

                    if (progress?.completed) {
                        return (
                             <div key={challenge.id} className="bg-gray-900/50 p-3 rounded-lg opacity-70">
                                <div className="flex justify-between items-center text-sm text-gray-400">
                                    <p className="font-semibold line-through">{challenge.title}</p>
                                    <div className="flex items-center gap-1 text-green-400">
                                        <Icon name="check-circle" className="w-4 h-4" />
                                        <span>Completed</span>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div key={challenge.id} className="bg-gray-800 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">{challenge.title}</p>
                                <p className="font-bold text-yellow-400">+{challenge.points} pts</p>
                            </div>
                            <p className="text-xs text-rea-gray-light mt-1">{challenge.description}</p>
                            <div className="mt-2">
                                <div className="flex justify-between text-xs text-rea-gray-light mb-1">
                                    <span>Progress</span>
                                    <span>{current} / {challenge.goal}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    );
}

const RewardsCard: React.FC<{ onRedeem: (reward: Reward) => void }> = ({ onRedeem }) => {
    const { rewards, user } = useData();
    return (
        <section className="bg-rea-gray-dark p-4 rounded-lg space-y-4">
            <h2 className="text-xl font-bold text-center flex items-center justify-center gap-2">
                <Icon name="gift" className="w-6 h-6 text-rea-red" />
                Redeem Rewards
            </h2>
             <div className="space-y-3">
                {rewards.map(reward => {
                    const canAfford = user.loyaltyPoints >= reward.cost;
                    return (
                        <div key={reward.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{reward.title}</p>
                                <p className="text-xs text-rea-gray-light">{reward.description}</p>
                            </div>
                            <Button 
                                className="w-auto px-4 !py-2 text-sm self-center"
                                variant={canAfford ? 'primary' : 'secondary'}
                                disabled={!canAfford}
                                onClick={() => onRedeem(reward)}
                            >
                                <Icon name="star" className="w-4 h-4 mr-1" />
                                {reward.cost}
                            </Button>
                        </div>
                    )
                })}
            </div>
        </section>
    );
}


const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout }) => {
    const { user, updateCardHolderName } = useData();
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(user.fullName);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

    const handleEdit = () => {
        setEditedName(user.fullName);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = () => {
        updateCardHolderName(editedName);
        setIsEditing(false);
    };

    return (
        <div className="p-4 space-y-8 pb-24">
            <header className="flex flex-col items-center space-y-4 pt-8">
                 <div className="w-24 h-24 rounded-full bg-rea-red flex items-center justify-center text-4xl font-bold">
                    {isEditing ? (editedName.charAt(0) || 'U') : user.fullName.charAt(0)}
                </div>
                <div className="text-center w-full max-w-sm">
                    {isEditing ? (
                        <div className="mt-2">
                             <Input
                                label="Full Name"
                                id="fullName"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                            />
                        </div>
                    ) : (
                        <h1 className="text-2xl font-bold">{user.fullName}</h1>
                    )}
                    <p className="text-rea-gray-light">{user.email}</p>
                </div>
            </header>
            
            <div className="flex gap-4">
                {isEditing ? (
                     <>
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave}>Save</Button>
                    </>
                ) : (
                    <Button variant="secondary" onClick={handleEdit}>Edit Profile</Button>
                )}
            </div>

            <div className="bg-rea-gray-dark p-6 rounded-lg flex items-center justify-between">
                <div>
                    <p className="text-rea-gray-light">Loyalty Points Balance</p>
                    <p className="text-3xl font-bold">{user.loyaltyPoints}</p>
                </div>
                <Icon name="star" className="w-10 h-10 text-yellow-400" />
            </div>

            <ChallengeCard />
            <RewardsCard onRedeem={setSelectedReward} />
            
            <section className="bg-rea-gray-dark p-4 rounded-lg space-y-4">
                 <h2 className="text-xl font-bold text-center">Security Settings</h2>
                 <button onClick={() => setIsPinModalOpen(true)} className="w-full flex justify-between items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-4">
                        <Icon name="keypad" className="w-6 h-6 text-rea-gray-light" />
                        <span className="font-semibold">{user.pin ? 'Change Your PIN' : 'Set a PIN'}</span>
                    </div>
                    <span className="text-lg font-bold">&gt;</span>
                 </button>
                 {!user.pin && (
                    <p className="text-xs text-yellow-400 text-center p-2 bg-yellow-900/50 rounded-md">
                        For enhanced security, we highly recommend setting a PIN.
                    </p>
                 )}
            </section>
            
            <div className="space-y-4">
                <Button variant="ghost" className="text-rea-red" onClick={onLogout}>LOGOUT</Button>
            </div>
            
            {isPinModalOpen && <SetPinModal onClose={() => setIsPinModalOpen(false)} />}
            {selectedReward && <RedeemRewardModal reward={selectedReward} onClose={() => setSelectedReward(null)} />}
        </div>
    );
};

export default ProfilePage;