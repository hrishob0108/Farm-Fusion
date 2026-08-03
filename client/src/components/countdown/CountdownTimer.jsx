import React, { useState, useEffect } from 'react';

// Helper to parse target date in strict +05:30 IST timezone
const parseTargetAsIST = (target) => {
  if (!target) return new Date();
  if (target instanceof Date) return target;
  let str = String(target).trim();
  // If string contains datetime-local format without offset, append +05:30 IST offset
  if (str.length === 16 && !str.includes('Z') && !str.includes('+')) {
    str += ':00+05:30';
  } else if (!str.includes('Z') && !str.includes('+') && !str.includes('-')) {
    str += '+05:30';
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? new Date(target) : date;
};

export const CountdownTimer = ({ targetDate, onEnd }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isEnded: false
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const targetTime = parseTargetAsIST(targetDate);
      const difference = targetTime - new Date();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        if (onEnd) onEnd();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.isEnded) {
    return (
      <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-bold text-lg">
        🎉 Event Started!
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6 my-6">
      {[
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Minutes', value: timeLeft.minutes },
        { label: 'Seconds', value: timeLeft.seconds }
      ].map((item, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {String(item.value).padStart(2, '0')}
            </span>
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-bold tracking-wider text-slate-600 uppercase">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};
