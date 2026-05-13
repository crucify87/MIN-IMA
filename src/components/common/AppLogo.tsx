import React from 'react';

const AppLogo = ({ className = "w-12 h-12", src }: { className?: string; src?: string }) => (
  <div 
    onClick={() => window.location.reload()}
    className={`${className} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity active:scale-95 duration-200`}
  >
    <img src={src || "/512x512.png?v=3"} alt="Logo" className="w-full h-full object-contain" />
  </div>
);

export default AppLogo;
