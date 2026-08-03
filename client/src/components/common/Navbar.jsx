import React from 'react';
import { useEvent } from '../../context/EventContext';

export const Navbar = () => {
  const { eventData, step, setStep } = useEvent();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E6DFD5] transition-all duration-300 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setStep(1)} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <img
            src="/cb.png"
            alt="CB Logo"
            className="h-12 w-12 rounded-full object-cover shadow-sm border border-[#E6DFD5] group-hover:scale-105 transition-transform duration-300"
          />
          <div>
            <span className="text-xl sm:text-2xl font-black tracking-tight text-[#0F3A24]">
              {eventData.eventName || 'FarmFusion'}
            </span>
            <span className="hidden sm:block text-xs font-extrabold text-[#7A4F23]">
              {eventData.tagline || 'Where AI Meets Agriculture'}
            </span>
          </div>
        </div>

        {/* Step Status Badge */}
        {step > 1 && (
          <button 
            onClick={() => setStep(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#EFE9DF] text-[#0F3A24] border border-[#D9CEBE] hover:bg-[#E4DACB] transition cursor-pointer"
          >
            ← Return to Home
          </button>
        )}

      </div>
    </header>
  );
};
