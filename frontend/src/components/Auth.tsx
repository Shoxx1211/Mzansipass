
import React, { useState } from 'react';

interface AuthProps {
  onLogin: (user: any) => void;
}

export const AuthView: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLogin({ email, name: email.split('@')[0] });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-md space-y-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-400 rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-6">
            <span className="text-4xl">🇿🇦</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2">MzansiPass</h1>
          <p className="text-white/40 text-sm">Experience the future of mobility.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <button 
            type="submit"
            className="w-full h-16 bg-white text-black rounded-2xl font-bold text-lg active:scale-95 transition-transform"
          >
            {isRegister ? 'CREATE ACCOUNT' : 'LOG IN'}
          </button>
        </form>

        <p className="text-center text-white/30 text-sm">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-white font-bold hover:underline"
          >
            {isRegister ? 'Sign in' : 'Register now'}
          </button>
        </p>
      </div>
    </div>
  );
};
