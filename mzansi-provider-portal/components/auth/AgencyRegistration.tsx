
import React, { useState, useMemo } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { GoogleGenAI } from '@google/genai';
import { Provider } from '../../types';
import { PROVIDER_PREFIXES } from '../../constants';

interface AgencyRegistrationProps {
  onRegister: (provider: Provider) => void;
  onSwitchToLogin: () => void;
}

const AgencyRegistration: React.FC<AgencyRegistrationProps> = ({ onRegister, onSwitchToLogin }) => {
  const [provider, setProvider] = useState<Provider>('Rea Vaya');
  const [license, setLicense] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verificationLog, setVerificationLog] = useState<string[]>([]);

  const providerPrefix = useMemo(() => {
      const entry = Object.entries(PROVIDER_PREFIXES).find(([_, p]) => p === provider);
      return entry ? entry[0] : 'ADM';
  }, [provider]);

  const generatedAdminId = useMemo(() => {
      return `${providerPrefix}-ADMIN-${Math.floor(1000 + Math.random() * 9000)}`;
  }, [providerPrefix]);

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setVerificationLog(["Connecting to National Transit Registry...", "Scanning Operator License..."]);

    // AI Credential Audit Simulation
    if (process.env.API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analyze this registration attempt for a transport agency. 
          Agency: ${provider}, License: ${license}, RegNum: ${regNumber}, AssignedID: ${generatedAdminId}. 
          Generate 3 short, professional-sounding verification steps (e.g., 'Validating fleet UUIDs...'). 
          End with 'CREDENTIALS_VALIDATED'.`,
        });
        
        const steps = response.text.split('\n').filter(s => s.trim().length > 0);
        for (const step of steps) {
            await new Promise(r => setTimeout(r, 600));
            setVerificationLog(prev => [...prev, step]);
        }
      } catch (err) {
        setVerificationLog(prev => [...prev, "Syncing with Offline Registry...", "CREDENTIALS_VALIDATED"]);
      }
    } else {
        await new Promise(r => setTimeout(r, 1200));
        setVerificationLog(prev => [...prev, "CREDENTIALS_VALIDATED"]);
    }

    setTimeout(() => {
        setIsVerifying(false);
        setIsSuccess(true);
    }, 800);
  };

  const handleFinalStep = () => {
    onRegister(provider);
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
        <div className="w-full max-w-md bg-rea-gray-dark border border-white/10 p-10 rounded-3xl shadow-2xl space-y-8">
            <div className="flex justify-center">
                <Icon name="sparkles" className="w-16 h-16 text-admin-accent animate-pulse" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-black uppercase tracking-widest">AI Credential Audit</h2>
                <p className="text-rea-gray-light text-[10px] mt-2 font-bold uppercase tracking-[0.3em] opacity-50">National Security Protocol</p>
            </div>
            <div className="bg-black/50 rounded-xl p-6 font-mono text-[10px] space-y-2 border border-white/5">
                {verificationLog.map((log, i) => (
                    <div key={i} className="flex items-center space-x-2">
                        <span className="text-green-500">›</span>
                        <span className={log === 'CREDENTIALS_VALIDATED' ? 'text-admin-accent font-black' : 'text-gray-400'}>{log}</span>
                    </div>
                ))}
                <div className="w-2 h-4 bg-admin-accent animate-pulse inline-block ml-1"></div>
            </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] text-white">
            <div className="w-full max-w-md bg-rea-gray-dark border border-admin-accent/30 p-10 rounded-3xl shadow-2xl space-y-8 text-center animate-fade-in-up">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 border border-green-500/20">
                        <Icon name="check-circle" className="w-12 h-12" />
                    </div>
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-widest italic">Agency Enrolled</h2>
                    <p className="text-rea-gray-light text-sm mt-2">Your transport infrastructure has been linked to the national pass registry.</p>
                </div>
                <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-2">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Your Assigned Administrator ID</p>
                    <p className="text-2xl font-mono font-black text-admin-accent tracking-tighter">{generatedAdminId}</p>
                    <p className="text-[9px] text-orange-500 font-bold uppercase pt-2">Note: Keep this ID secure for portal access.</p>
                </div>
                <Button onClick={handleFinalStep} className="h-16 !rounded-2xl bg-admin-accent font-black uppercase tracking-widest shadow-xl shadow-admin-accent/20">
                    Enter Portal Hub
                </Button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505]">
      <div className="w-full max-w-lg space-y-8 bg-rea-gray-dark p-12 rounded-3xl border border-white/5 shadow-[0_0_50px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-admin-accent/5 blur-3xl"></div>
        
        <div className="relative z-10 text-center">
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
              Provider<span className="text-admin-accent">Portal</span>
            </h1>
            <p className="mt-2 text-rea-gray-light font-bold text-[10px] uppercase tracking-[0.4em] opacity-80">
              Agency Registration Suite
            </p>
        </div>

        <form className="relative z-10 space-y-6" onSubmit={handleVerifyAndRegister}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rea-gray-light ml-1">Transport Provider</label>
                <select 
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as Provider)}
                    className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white focus:ring-2 focus:ring-admin-accent focus:border-transparent outline-none transition-all appearance-none font-bold"
                >
                    <option>Rea Vaya</option>
                    <option>Gautrain</option>
                    <option>Metrobus</option>
                    <option>MyCiTi</option>
                    <option>Areyeng</option>
                    <option>PRASA</option>
                    <option>Tshwane Bus Service</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-rea-gray-light ml-1">New Administrator ID</label>
                <div className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-6 text-admin-accent font-mono font-bold flex items-center justify-between group">
                    <span>{generatedAdminId}</span>
                    <Icon name="lock-closed" className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Operator License Key" 
                id="license" 
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="NTA-2025-XXXX" 
                required
                className="!bg-black !border-white/10"
              />
              <Input 
                label="Corporate Reg #" 
                id="reg" 
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="2023/123456/07" 
                required
                className="!bg-black !border-white/10"
              />
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
              <Input label="Fleet Admin Email" type="email" placeholder="admin@agency.gov.za" required className="!bg-black !border-white/10" />
              <Input label="System Access Password" type="password" placeholder="••••••••" required className="!bg-black !border-white/10" />
          </div>
          
          <Button type="submit" className="h-16 !rounded-2xl shadow-2xl bg-admin-accent shadow-admin-accent/20 font-black uppercase tracking-widest text-sm hover:brightness-110 active:scale-95 transition-all">
            Link Infrastructure
          </Button>
        </form>

        <div className="relative z-10 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest leading-relaxed">Assigned IDs utilize mandatory agency prefixes for national clearing house tracking.</p>
            <button 
                onClick={onSwitchToLogin}
                className="text-xs font-black uppercase tracking-widest text-rea-gray-light hover:text-white transition-all underline underline-offset-4"
            >
                Already registered? Sign in
            </button>
        </div>
      </div>
    </div>
  );
};

export default AgencyRegistration;
