import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  leftIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, leftIcon, ...props }) => {
  const baseClasses = 'w-full py-3 rounded-lg font-semibold text-lg transition-transform transform active:scale-95 flex items-center justify-center gap-3';
  
  const variantClasses = {
    primary: 'bg-rea-red text-rea-white hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed',
    secondary: 'bg-rea-gray-dark border border-gray-600 text-rea-white hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed',
    ghost: 'bg-transparent text-rea-red hover:bg-rea-gray-dark disabled:text-gray-600 disabled:cursor-not-allowed',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {leftIcon}
      {children}
    </button>
  );
};

export default Button;