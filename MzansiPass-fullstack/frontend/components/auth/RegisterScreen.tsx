import React, { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

interface RegisterScreenProps {
  onRegister: (fullName: string) => void;
  onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onSwitchToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegisterClick = () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (!fullName || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    onRegister(fullName);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-rea-black">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
            <h1 className="text-4xl font-black text-rea-white">Mzansi<span className="text-rea-red">Pass</span></h1>
            <h2 className="mt-4 text-2xl font-bold text-rea-white">Create Account</h2>
            <p className="text-rea-gray-light">Get started with your digital pass</p>
        </div>
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <Input label="Full Name" id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Email address" id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Confirm Password" id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <Button type="submit" onClick={handleRegisterClick}>Register</Button>
        </form>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-4 text-rea-gray-light text-sm">OR</span>
            <div className="flex-grow border-t border-gray-600"></div>
        </div>
        
        <div className="space-y-4 -my-2">
            <Button
                variant="secondary"
                onClick={() => onRegister('Google User')}
                leftIcon={<Icon name="google" className="w-6 h-6" />}
            >
                Continue with Google
            </Button>
            <Button
                variant="secondary"
                onClick={() => onRegister('Facebook User')}
                leftIcon={<Icon name="facebook" className="w-6 h-6 text-[#1877F2]" />}
            >
                Continue with Facebook
            </Button>
        </div>
        
        <p className="text-center text-rea-gray-light">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-semibold text-rea-red hover:underline">
            Log in here
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterScreen;