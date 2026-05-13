import React from 'react';

const AppLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div 
    onClick={() => window.location.reload()}
    className={`${className} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity active:scale-95 duration-200`}
  >
    <img src="/favicon.svg?v=2" alt="Logo" className="w-full h-full object-contain" />
  </div>
);

export default AppLogo;
