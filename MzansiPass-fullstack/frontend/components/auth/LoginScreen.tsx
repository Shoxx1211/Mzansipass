import React from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface LoginScreenProps {
  onLogin: () => void;
  onSwitchToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSwitchToRegister }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-rea-black">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
            <h1 className="text-4xl font-black text-rea-white">Mzansi<span className="text-rea-red">Pass</span></h1>
            <h2 className="mt-4 text-2xl font-bold text-rea-white">Welcome Back</h2>
            <p className="text-rea-gray-light">Sign in to continue</p>
        </div>
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <Input label="Email address" id="email" type="email" placeholder="you@example.com" />
          <Input label="Password" id="password" type="password" placeholder="••••••••" />
          <Button type="submit" onClick={onLogin}>Sign in</Button>
        </form>
        <div className="space-y-4">
            <Button variant="secondary" onClick={onLogin}>View Demo</Button>
            <p className="text-center text-rea-gray-light">
            Don't have an account?{' '}
            <button onClick={onSwitchToRegister} className="font-semibold text-rea-red hover:underline">
                Register here
            </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;