
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { GoogleGenAI } from '@google/genai';
import { TransitAlert, Provider } from '../../types';

const BroadcastHub: React.FC = () => {
  const { user, pushBroadcast } = useData();
  const [rawInput, setRawInput] = useState('');
  const [draft, setDraft] = useState<TransitAlert | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const handleGenerateBroadcast = async () => {
    if (!rawInput.trim() || !process.env.API_KEY) return;
    setIsGenerating(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const providerName = user.providerAccess || 'Transit Network';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a professional transit dispatcher for ${providerName}. 
        Create an official passenger alert based on this situation: "${rawInput}".
        Output strictly in JSON format with these fields:
        {
          "title": "Short catchy headline",
          "description": "Professional details including instructions for commuters",
          "category": "One of: delay, crowded, hazard, info"
        }`,
      });

      const data = JSON.parse(response.text.replace(/```json|```/g, ''));
      const newAlert: TransitAlert = {
        id: `official-${Date.now()}`,
        type: 'official',
        provider: user.providerAccess,
        category: data.category,
        title: data.title,
        description: data.description,
        timestamp: new Date().toISOString(),
        isVerified: true
      };
      setDraft(newAlert);
    } catch (e) {
      console.error(e);
      alert("AI failed to draft alert. Please use standard protocol.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePushToNetwork = () => {
    if (!draft) return;
    setIsPushing(true);
    setTimeout(() => {
      pushBroadcast(draft);
      setDraft(null);
      setRawInput('');
      setIsPushing(false);
      alert("Broadcast transmitted to all active commuter app nodes.");
    }, 1200);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="bg-rea-gray-dark p-10 rounded-3xl border border-white/5 shadow-2xl space-y-8">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-widest italic">Broadcast Center</h3>
            <p className="text-rea-gray-light text-sm mt-2">Draft official updates to be pushed instantly to the MzansiPass ecosystem.</p>
          </div>

          <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Operation Status / Update Details</label>
              <textarea 
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="e.g. Broken rail near Sandton, 20 min delay expected. Suggest bus switch."
                className="w-full bg-black border border-white/10 rounded-2xl p-6 text-white min-h-[150px] focus:ring-2 focus:ring-admin-accent outline-none"
              />
              <Button 
                onClick={handleGenerateBroadcast} 
                disabled={isGenerating || !rawInput.trim()}
                className="h-14 !rounded-xl bg-admin-accent font-black uppercase tracking-widest"
              >
                {isGenerating ? 'AI Reviewing Operation...' : 'Generate Official Alert'}
              </Button>
          </div>

          <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <div className="flex items-center space-x-3 mb-4">
                  <Icon name="info" className="w-5 h-5 text-admin-accent" />
                  <h4 className="text-xs font-black uppercase">Dispatch Guidelines</h4>
              </div>
              <ul className="text-[10px] text-gray-500 space-y-2 uppercase font-bold tracking-tight">
                  <li>• Alerts reach all commuters within 10km of affected route</li>
                  <li>• Multi-lingual translation performed automatically by Gemini</li>
                  <li>• High-severity hazards trigger NFC/Push haptic alerts</li>
              </ul>
          </div>
      </div>

      <div className="space-y-6">
          <div className={`p-10 rounded-3xl border transition-all h-full flex flex-col justify-center items-center text-center ${draft ? 'bg-admin-accent/5 border-admin-accent/20 animate-fade-in-up' : 'bg-white/[0.02] border-white/5 border-dashed'}`}>
              {!draft ? (
                  <div className="opacity-20 space-y-4">
                      <Icon name="bell" className="w-20 h-20 mx-auto" />
                      <p className="font-black uppercase tracking-widest">No Draft Pending</p>
                  </div>
              ) : (
                  <div className="space-y-8 w-full">
                      <div className="bg-black/40 p-8 rounded-2xl border border-white/10 text-left relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-admin-accent text-white`}>{draft.category}</span>
                          </div>
                          <p className="text-[10px] font-black text-admin-accent uppercase tracking-widest mb-2">{draft.provider} OFFICIAL</p>
                          <h4 className="text-2xl font-black text-white leading-tight">{draft.title}</h4>
                          <p className="text-rea-gray-light mt-4 leading-relaxed font-medium">{draft.description}</p>
                          <div className="mt-6 pt-6 border-t border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              Network Target: All active {draft.provider} subscribers
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <Button variant="secondary" onClick={() => setDraft(null)} className="h-14 !rounded-xl">Discard</Button>
                          <Button onClick={handlePushToNetwork} className="h-14 !rounded-xl bg-green-600 font-black uppercase tracking-widest shadow-2xl shadow-green-600/20">
                              {isPushing ? 'Syncing...' : 'Push to Network'}
                          </Button>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default BroadcastHub;
