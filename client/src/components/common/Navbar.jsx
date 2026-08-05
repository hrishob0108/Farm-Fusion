import React from 'react';
import { useEvent } from '../../context/EventContext';

export const Navbar = () => {
  const { eventData, step, setStep } = useEvent();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E6DFD5] transition-all duration-300 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setStep(1)} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="h-12 w-12 rounded-full bg-black flex items-center justify-center border border-black shadow-md overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300">
            <img
              src="/cb-logo.png"
              alt="CB Logo"
              className="w-[140%] max-w-none h-auto object-contain"
            />
          </div>
          <img
            src="/farm-fusion-logo.png"
            alt="Farm Fusion Logo"
            className="h-25 w-52 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Step Status Badge */}
        {/* {step > 1 && (
          <button 
            onClick={() => setStep(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#EFE9DF] text-[#0F3A24] border border-[#D9CEBE] hover:bg-[#E4DACB] transition cursor-pointer"
          >
            ← Return to Home
          </button>
        )} */}

      </div>
    </header>
  );
};
