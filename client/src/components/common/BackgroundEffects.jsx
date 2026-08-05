import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Scan, Wheat, Sprout } from 'lucide-react';

export const BackgroundEffects = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      
      {/* Aerial Farmlands Panoramic Background Image with Warm Gradient Overlay */}
      <div className="absolute inset-0 z-0 opacity-45 mix-blend-multiply">
        <img
          src="/aerial-fields-bg.jpg"
          alt="Aerial Farmlands Background"
          className="w-full h-full object-cover object-center filter contrast-105"
        />
        {/* Soft Vignette Overlay to maintain readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF7F2]/75 via-[#FAF7F2]/50 to-[#FAF7F2]/80" />
      </div>

      {/* Soft Ambient Theme Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#0F3A24]/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#7A4F23]/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#0F3A24]/10 rounded-full blur-3xl" />




      {/* Farmer Background Cutout Artwork (Bottom Right) */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 0.98, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="absolute bottom-0 right-0 sm:right-6 max-w-[300px] sm:max-w-[440px] pointer-events-none z-10"
      >
        <img
          src="/farmer-cutout.png"
          alt="Farmer Standing in Field Cutout"
          className="w-full h-auto object-contain filter drop-shadow-lg"
        />
      </motion.div>

      {/* Floating Background AI Scanning Badge (Top Right) */}
      {/* <motion.div
        animate={{ y: [0, 15, 0], x: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-36 right-6 sm:right-20 opacity-85 text-[#7A4F23] z-10"
      >
        <div className="p-3.5 rounded-2xl bg-white/95 border border-[#7A4F23]/20 shadow-md flex items-center gap-2 backdrop-blur-md">
          <Bot className="w-7 h-7 text-[#7A4F23]" />
          <Scan className="w-4 h-4 text-[#0F3A24] animate-pulse" />
        </div>
      </motion.div> */}

    </div>
  );
};
