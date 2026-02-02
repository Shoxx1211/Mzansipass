import React from 'react';
import Icon from './Icon';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: string;
}

const Input: React.FC<InputProps> = ({ label, id, icon, ...props }) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm font-medium text-rea-gray-light mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          className={`w-full bg-rea-gray-dark border border-gray-600 rounded-lg py-3 text-rea-white placeholder-rea-gray-light focus:outline-none focus:ring-2 focus:ring-rea-red disabled:bg-gray-800 disabled:cursor-not-allowed ${icon ? 'pl-10' : 'px-4'}`}
          {...props}
        />
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Icon name={icon} className="w-5 h-5 text-rea-gray-light" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Input;