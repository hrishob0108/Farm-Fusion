import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, X, Copy, Check, Phone, UserCheck, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const FloatingContact = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Hide floating contact button on all admin routes
  if (location.pathname.startsWith('/admin') || location.pathname.includes('/admin')) {
    return null;
  }

  const contacts = [
    { key: 'secretary', title: 'Secretary', name: 'Abhiram', phone: '9398779899' },
    { key: 'webLead', title: 'Web Lead', name: 'Jayanth', phone: '8869965959' }
  ];

  const handleCopy = (phone, key) => {
    navigator.clipboard.writeText(phone);
    setCopiedKey(key);
    toast.success(`Copied ${phone} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full bg-[#0F3A24] text-[#FAF7F2] border-2 border-[#D4A373] shadow-2xl flex items-center gap-2.5 cursor-pointer group hover:bg-[#0A2B1A] transition"
        title="Contact Event Coordinators"
      >
        <div className="relative flex items-center justify-center">
          <PhoneCall className="w-5 h-5 text-[#D4A373] group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
        </div>
        <span className="text-xs font-black tracking-wide hidden sm:inline text-white">Contacts</span>
      </motion.button>

      {/* Contact Support Popup Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F3A24]/60 backdrop-blur-sm">
            {/* Click Outside Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 z-0"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-[#E6DFD5] shadow-2xl overflow-hidden p-6 text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-[#FAF7F2] text-[#0F3A24] hover:bg-[#EFE9DF] transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 border-b border-[#E6DFD5] pb-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#0F3A24] text-[#D4A373] flex items-center justify-center shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F3A24]">Event Contacts</h3>
                  <p className="text-[11px] font-extrabold text-[#7A4F23]">Need help? Reach out directly</p>
                </div>
              </div>

              {/* Contacts List */}
              <div className="space-y-3">
                {contacts.map(c => (
                  <div
                    key={c.key}
                    className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] flex items-center justify-between gap-3 hover:border-[#0F3A24]/30 transition"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-black text-[#7A4F23] uppercase tracking-wider">
                          {c.title}:
                        </span>
                        <span className="text-xs font-black text-[#0F3A24]">
                          {c.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-[#0F3A24] block">
                        {c.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`tel:${c.phone}`}
                        className="p-2 rounded-lg bg-[#0F3A24] text-white hover:bg-[#0A2B1A] text-xs font-bold transition flex items-center gap-1"
                        title={`Call ${c.title}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Call</span>
                      </a>

                      <button
                        onClick={() => handleCopy(c.phone, c.key)}
                        className="p-2 rounded-lg bg-white border border-[#D9CEBE] text-[#0F3A24] hover:bg-[#EFE9DF] transition cursor-pointer"
                        title="Copy Phone Number"
                      >
                        {copiedKey === c.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#7A4F23]" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Note */}
              <div className="mt-5 pt-3 border-t border-[#E6DFD5] text-center">
                <p className="text-[10px] font-extrabold text-slate-500 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F3A24]" />
                  <span>FarmFusion Official Support Team</span>
                </p>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
