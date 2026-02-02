
import React, { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { Provider } from '../../types';
import { PROVIDER_PREFIXES, PROVIDER_COLORS } from '../../constants';

interface LoginScreenProps {
  onLogin: (provider: Provider) => void;
  onSwitchToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSwitchToRegister }) => {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    // Detect prefix (e.g., GT from GT-1234)
    const prefix = adminId.split('-')[0].toUpperCase();
    if (PROVIDER_PREFIXES[prefix]) {
      setIsResolving(true);
      // Short delay to simulate "Registry Lookup"
      const timer = setTimeout(() => {
        setProvider(PROVIDER_PREFIXES[prefix]);
        setIsResolving(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setProvider(null);
      setIsResolving(false);
    }
  }, [adminId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (provider) {
        onLogin(provider);
    } else {
        alert("Security Protocol: Invalid Fleet ID. Please use an authorized agency prefix (e.g., GT- for Gautrain).");
    }
  };

  const fillDemo = (pref: string) => {
    setAdminId(`${pref}-ADMIN-2025`);
    setPassword('demo-pass');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#050505] selection:bg-admin-accent/30">
      <div className="w-full max-w-md space-y-8 bg-rea-gray-dark p-10 rounded-3xl border border-white/5 shadow-[0_0_80px_rgba(0,0,0,1)] relative overflow-hidden transition-all duration-500">
        
        {/* Dynamic Agency Glow */}
        <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[120px] rounded-full transition-colors duration-700 ${provider ? PROVIDER_COLORS[provider].split(' ')[0] : 'bg-admin-accent'}/15`}></div>
        
        <div className="relative z-10 text-center">
            <div className="flex justify-center mb-6">
                <div className={`p-5 rounded-3xl border shadow-2xl transition-all duration-500 scale-110 ${provider ? `${PROVIDER_COLORS[provider]} border-white/20` : 'bg-admin-accent/10 border-admin-accent/20 text-admin-accent shadow-admin-accent/5'}`}>
                    <Icon name={provider === 'Gautrain' || provider === 'PRASA' ? 'train' : 'nfc'} className="w-12 h-12" />
                </div>
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
              {provider ? provider.split(' ')[0] : 'Provider'}<span className="text-admin-accent">Portal</span>
            </h1>
            <div className="h-4 mt-2">
                {isResolving ? (
                    <p className="text-admin-accent font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Consulting Registry...</p>
                ) : (
                    <p className="text-rea-gray-light font-bold text-[10px] uppercase tracking-[0.3em] opacity-80">
                      {provider ? `${provider} Infrastructure Node` : 'Secure Network Uplink'}
                    </p>
                )}
            </div>
        </div>

        <form className="relative z-10 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
              <div className="relative group">
                <Input 
                    label="Administrator Fleet ID" 
                    type="text" 
                    placeholder="PREFIX-XXXX-2025" 
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    required 
                    autoFocus
                    className="!bg-black !border-white/10 group-hover:!border-white/20 transition-all"
                />
                {provider && !isResolving && (
                    <div className="absolute right-4 bottom-3 text-[9px] font-black text-green-500 uppercase flex items-center gap-1 animate-fade-in-up bg-green-500/10 px-2 py-0.5 rounded">
                        <Icon name="check-circle" className="w-3 h-3" />
                        Verified: {adminId.split('-')[0]}
                    </div>
                )}
              </div>
              <Input 
                label="Security Credentials" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="!bg-black !border-white/10"
              />
          </div>
          
          <div className="bg-black/60 border border-white/5 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Auth Protocol</span>
                  <span className="text-[9px] font-black text-admin-accent uppercase tracking-widest">C-Level Encryption</span>
              </div>
              <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Uplink Status</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${provider ? 'text-green-500' : 'text-orange-500'}`}>
                    {provider ? 'Handshake Ready' : 'Awaiting Prefix'}
                  </span>
              </div>
          </div>

          <Button 
            type="submit" 
            disabled={!provider || isResolving}
            className={`h-16 !rounded-2xl shadow-2xl font-black uppercase tracking-widest text-sm transition-all transform active:scale-95 ${provider ? 'bg-admin-accent shadow-admin-accent/40 scale-100 opacity-100' : 'bg-gray-800 text-gray-500 shadow-none grayscale opacity-50 cursor-not-allowed'}`}
          >
            {isResolving ? 'Authenticating...' : 'Secure Entry'}
          </Button>
        </form>

        <div className="relative z-10 space-y-6">
            <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-3 text-center">Authorized Agency Prefixes</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {Object.keys(PROVIDER_PREFIXES).map(pref => (
                        <button 
                            key={pref}
                            onClick={() => fillDemo(pref)}
                            className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-rea-gray-light hover:text-white hover:bg-white/10 hover:border-admin-accent transition-all uppercase"
                        >
                            {pref}
                        </button>
                    ))}
                </div>
            </div>

            <div className="text-center">
                <button 
                    onClick={onSwitchToRegister}
                    className="text-xs font-black uppercase tracking-widest text-rea-gray-light hover:text-white transition-all underline underline-offset-8"
                >
                    Register New Agency Unit
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
