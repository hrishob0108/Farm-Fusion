import React, { useEffect, useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { CountdownTimer } from '../countdown/CountdownTimer';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock, Leaf, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const HeroHome = () => {
  const { eventData, setStep, checkLiveRegistrationOpen, fetchEventDetails, activeReservation } = useEvent();
  const [isNavigating, setIsNavigating] = useState(false);

  // Auto-request live event details, slots, and registration status every 5 seconds without page reload
  useEffect(() => {
    fetchEventDetails();
    const interval = setInterval(() => {
      fetchEventDetails();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchEventDetails]);

  const registeredCount = eventData.registeredCount || 0;
  const maxTeams = eventData.maxTeams || 50;
  const progressPercent = Math.min(Math.round((registeredCount / maxTeams) * 100), 100);
  
  const hasReservation = Boolean(activeReservation?.reservationId);
  const isLimitReached = registeredCount >= maxTeams;
  const isOpen = eventData.registrationOpen !== false && (!isLimitReached || hasReservation);

  const handleRegisterClick = async () => {
    if (!isOpen) {
      toast.error(
        isLimitReached
          ? 'Registrations are CLOSED because the maximum team limit has been reached.'
          : 'Registrations are currently CLOSED by the event organizers.'
      );
      return;
    }

    setIsNavigating(true);

    try {
      const status = await checkLiveRegistrationOpen();
      if (!status.isOpen) {
        toast.error(
          status.isLimit
            ? 'Registrations are CLOSED because the maximum team limit has been reached.'
            : 'Registrations are currently CLOSED by the event organizers.'
        );
        setIsNavigating(false);
        return;
      }
      setStep(2);
    } catch (e) {
      // Fallback: proceed to step 2 if live check encountered net error
      setStep(2);
    } finally {
      setIsNavigating(false);
    }
  };

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
        
        {/* Registration Announcement Note */}
        <div className="mb-6 px-4 py-3 bg-[#FAF7F2] border border-[#D4A373]/60 rounded-xl flex items-center justify-center gap-2.5 text-sm text-[#0F3A24] shadow-sm">
          <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A373] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#7A4F23]"></span>
          </span>
          <Calendar className="w-4 h-4 text-[#7A4F23] flex-shrink-0" />
          <span className="text-center font-medium">
            <strong className="font-extrabold text-[#7A4F23]">Important Note:</strong> Registration opens on <span className="font-bold underline decoration-[#D4A373]">7th August after 5:45 PM</span>
          </span>
        </div>

        {/* Official Farm Fusion AI Logo Enclosed in Fitted Box */}
        <div className="mb-8 flex items-center justify-center">
          <div className="p-3.5 sm:p-5  inline-flex items-center justify-center">
            <img
              src="/farm-fusion-logo.png"
              alt="FarmFusion Logo"
              className="h-30 sm:h-30 w-80 sm:w-80 object-contain"
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

          {/* Leaf Registration Demand Visual Bar */}
          <div className="w-full mt-6 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-[#0F3A24] mb-2">
              <span className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                <Leaf className="w-4 h-4 text-emerald-700" />
                <span>Registration Demand</span>
                <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Auto-Refreshing Every 5s" />
              </span>
            </div>
            <div className="relative w-full h-4 bg-[#E6DFD5] rounded-full p-0.5 border border-[#D9CEBE] flex items-center">
              <motion.div 
                className={`h-full rounded-full relative flex items-center justify-end transition-all duration-700 ease-out ${isLimitReached ? 'bg-[#800E13]' : 'bg-gradient-to-r from-[#0F3A24] via-[#2D6A4F] to-[#52B788]'}`}
                initial={false}
                animate={{ width: `${Math.max(progressPercent, 4)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-[#0F3A24] shadow-md flex items-center justify-center z-10">
                  <Leaf className="w-3 h-3 text-[#0F3A24]" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Register Button */}
        <button
          onClick={handleRegisterClick}
          disabled={isNavigating}
          className={`px-8 py-3.5 text-base font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 mx-auto transition cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed ${
            isOpen
              ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white'
              : 'bg-[#800E13] hover:bg-[#600A0E] text-white'
          }`}
        >
          {isNavigating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#D4A373]" />
              <span>Verifying & Opening Form...</span>
            </>
          ) : (
            <>
              <span>
                {isOpen 
                  ? 'Register Team' 
                  : isLimitReached 
                  ? 'Registrations Closed (Limit Reached)' 
                  : 'Registrations Closed'}
              </span>
              <ArrowRight className="w-5 h-5 text-[#D4A373]" />
            </>
          )}
        </button>

      </div>
    </motion.div>
  );
};