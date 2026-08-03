import React from 'react';
import { useEvent } from '../../context/EventContext';
import { CountdownTimer } from '../countdown/CountdownTimer';
import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';

export const HeroHome = () => {
  const { eventData, setStep } = useEvent();

  const registeredCount = eventData.registeredCount || 0;
  const maxTeams = eventData.maxTeams || 50;
  const progressPercent = Math.min(Math.round((registeredCount / maxTeams) * 100), 100);
  
  // Registration is open ONLY if explicitly open AND registered count is below max limit
  const isLimitReached = registeredCount >= maxTeams;
  const isOpen = eventData.registrationOpen !== false && !isLimitReached;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-4 py-6 text-center"
    >
      {/* Clean White Card with Logo Theme Borders */}
      <div className="bg-white border border-[#E6DFD5] rounded-2xl p-6 sm:p-10 shadow-md">
        
        {/* Official Farm Fusion AI Logo Enclosed in Fitted Box */}
        <div className="mb-8 flex items-center justify-center">
          <div className="p-3.5 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] shadow-xs inline-flex items-center justify-center">
            <img
              src="/farm-fusion-logo.png"
              alt="FarmFusion Logo"
              className="h-20 sm:h-28 max-w-full object-contain"
            />
          </div>
        </div>

        {/* Countdown Box */}
        <div className="bg-[#FAF7F2] border border-[#E6DFD5] rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center gap-1.5 text-[#0F3A24] mb-1">
            <Clock className="w-4 h-4 text-[#7A4F23]" />
            <h3 className="text-xs font-extrabold tracking-wider uppercase text-[#0F3A24]">
              Event Starts In
            </h3>
          </div>

          <CountdownTimer targetDate={eventData.eventDate} />

          {/* Real Team Limit Progress Bar */}
          <div className="w-full mt-6 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-[#0F3A24] mb-2">
              <span>Teams Registered Limit</span>
              <span className={`font-extrabold ${isLimitReached ? 'text-rose-600' : 'text-[#7A4F23]'}`}>
                {registeredCount} / {maxTeams} Teams {isLimitReached && '(FULL)'}
              </span>
            </div>
            <div className="w-full h-3 bg-[#E6DFD5] rounded-full overflow-hidden p-0.5 border border-[#D9CEBE]">
              <motion.div 
                className={`h-full rounded-full ${isLimitReached ? 'bg-rose-600' : 'bg-gradient-to-r from-[#0F3A24] to-[#7A4F23]'}`}
                initial={{ width: '0%' }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Register Button */}
        <button
          onClick={() => setStep(2)}
          disabled={!isOpen}
          className={`px-8 py-3.5 text-base font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 mx-auto transition ${
            isOpen
              ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white cursor-pointer'
              : 'bg-slate-400 text-slate-100 cursor-not-allowed shadow-none border border-slate-300'
          }`}
        >
          <span>
            {isOpen 
              ? 'Register Team' 
              : isLimitReached 
              ? 'Registrations Closed (Limit Reached)' 
              : 'Registrations Closed'}
          </span>
          <ArrowRight className="w-5 h-5 text-[#D4A373]" />
        </button>

      </div>
    </motion.div>
  );
};
