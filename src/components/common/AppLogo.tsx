import React from 'react';

const AppLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={`${className} rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 flex items-center justify-center bg-white`}>
    <img src="/favicon.svg" alt="Logo" className="w-full h-full object-contain" />
  </div>
);

export default AppLogo;
