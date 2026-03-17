import React, { useState, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { useData } from '../../context/DataContext';
import { Provider, ReportCategory } from '../../types';
import { STATIONS } from '../../constants';
import { categorizeReportWithAI } from '../../services/geminiService';

const CATEGORIES: { id: ReportCategory, label: string, icon: string }[] = [
  { id: 'crowded', label: 'Crowded', icon: 'users' },
  { id: 'delay', label: 'Delay', icon: 'clock' },
  { id: 'hazard', label: 'Hazard', icon: 'alert-triangle' },
  { id: 'other', label: 'Other', icon: 'info' },
];

const ReportIssueModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addTransitAlert } = useData();
  const [provider, setProvider] = useState<Provider>('Rea Vaya');
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCategorizeWithAI = useCallback(async () => {
    if (!description.trim()) {
      setError('Please enter a description first.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const category = await categorizeReportWithAI(description);
      setSelectedCategory(category);
    } catch (e) {
      setError('AI categorization failed. Please select a category manually.');
    } finally {
      setIsSubmitting(false);
    }
  }, [description]);

  const handleSubmit = () => {
    if (!selectedCategory) {
      setError('Please select a category for your report.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a short description.');
      return;
    }
    setIsSubmitting(true);
    // Create a title from the description
    const title = `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Report on ${provider}`;
    addTransitAlert(provider, selectedCategory, title, description);
    
    // Simulate submission delay and then close
    setTimeout(() => {
        setIsSubmitting(false);
        onClose();
    }, 1000);
  };

  return (
    <Modal title="Report an Issue" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-rea-gray-light -mt-2">
          Help fellow commuters by reporting what's happening on the ground.
        </p>
        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-rea-gray-light mb-1">Transport Provider</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
          >
            {(Object.keys(STATIONS) as Provider[]).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-rea-gray-light mb-2">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${selectedCategory === cat.id ? 'bg-rea-red/20 border-rea-red' : 'bg-gray-800 border-gray-700 hover:border-rea-red'}`}
              >
                <Icon name={cat.icon} className="w-6 h-6 mb-1" />
                <span className="text-sm font-semibold">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
            <label htmlFor="description" className="block text-sm font-medium text-rea-gray-light mb-1">Description</label>
            <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., The bus is running about 15 minutes late."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-rea-white focus:outline-none focus:ring-2 focus:ring-rea-red"
            />
            <Button
                variant="ghost"
                className="mt-2 text-sm !py-1"
                onClick={handleCategorizeWithAI}
                disabled={isSubmitting || !description.trim()}
            >
                <Icon name="sparkles" className="w-4 h-4" />
                {isSubmitting ? 'Analyzing...' : 'Categorize with AI'}
            </Button>
        </div>

        {error && <p className="text-red-500 text-sm text-center -my-2">{error}</p>}
        
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </Modal>
  );
};
export default ReportIssueModal;
