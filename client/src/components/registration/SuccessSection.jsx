import React, { useEffect } from 'react';
import { useEvent } from '../../context/EventContext';
import { generateRegistrationReceipt } from '../../services/receiptGenerator';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, Home, MessageSquare, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const SuccessSection = () => {
  const { eventData, submittedRegistration, resetRegistrationForm } = useEvent();

  useEffect(() => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0F3A24', '#7A4F23', '#D4A373', '#ffffff']
      });
    } catch (e) {}
  }, []);

  const handleDownloadReceipt = async () => {
    if (submittedRegistration) {
      toast.loading('Generating Official Pass PDF with logos...', { id: 'pdfToast' });
      await generateRegistrationReceipt(submittedRegistration);
      toast.success('Downloaded Registration Receipt PDF!', { id: 'pdfToast' });
    } else {
      toast.error('No registration record found for download');
    }
  };

  const groupLink = eventData.whatsapp?.discussion || eventData.whatsapp?.group || '#';
  const communityLink = eventData.whatsapp?.group || '#';
  const hasGroupLink = groupLink && groupLink !== '#';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-4 py-8 text-center"
    >
      {/* Clean White Card */}
      <div className="bg-white border border-[#E6DFD5] rounded-2xl p-6 sm:p-10 shadow-md flex flex-col items-center">
        
        {/* Dual Logos: FarmFusion & TARA */}
        <div className="w-full flex items-center justify-between border-b border-[#E6DFD5] pb-4 mb-6">
          <img
            src="/farm-fusion-logo.png"
            alt="FarmFusion Logo"
            className="h-12 sm:h-14 object-contain"
          />
          <div className="text-right">
            <span className="block text-[10px] font-black text-[#7A4F23] uppercase">Managed By</span>
            <img
              src="/tara-logo.jpg"
              alt="TARA Event Manager Logo"
              className="h-8 sm:h-10 object-contain"
            />
          </div>
        </div>

        {/* Animated Green Tick Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-[#FAF7F2] text-[#0F3A24] mb-6 flex items-center justify-center border-2 border-[#0F3A24] shadow-sm"
        >
          <CheckCircle2 className="w-12 h-12 text-[#0F3A24]" />
        </motion.div>

        {/* Celebration Headers */}
        <h1 className="text-2xl sm:text-4xl font-black text-[#0F3A24] mb-2">
          🎉 Registration Submitted!
        </h1>
        
        <p className="text-base font-extrabold text-[#7A4F23] mb-2">
          Thank you for registering your team for FarmFusion.
        </p>
        
        <p className="text-xs text-slate-600 max-w-md mx-auto font-medium mb-6">
          Your payment screenshot and details have been submitted. Once verified by our team, your registration status will be confirmed.
        </p>

        {/* Team Details Box */}
        {submittedRegistration && (
          <div className="w-full p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] text-left mb-6 space-y-1">
            <p className="text-xs font-extrabold text-[#0F3A24]">
              Team Name: <span className="text-[#7A4F23]">{submittedRegistration.teamName}</span>
            </p>
            <p className="text-xs font-extrabold text-[#0F3A24]">
              Leader Name: <span className="text-[#7A4F23]">{submittedRegistration.leader?.name}</span>
            </p>
            <p className="text-xs font-extrabold text-[#0F3A24]">
              Transaction ID: <span className="font-mono text-[#7A4F23]">{submittedRegistration.transactionId}</span>
            </p>
          </div>
        )}

        {/* Action Buttons: PDF Pass Download & Return Home */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <button
            onClick={handleDownloadReceipt}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0F3A24] hover:bg-[#0A2B1A] text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#D4A373]" />
            <span>Download Registration Pass PDF</span>
          </button>

          <button
            onClick={resetRegistrationForm}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white border border-[#D9CEBE] text-[#0F3A24] font-extrabold text-xs hover:bg-[#FAF7F2] flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Home className="w-4 h-4 text-[#7A4F23]" />
            <span>Register Another Team</span>
          </button>
        </div>

        {/* Single WhatsApp Group Card Section */}
        <div className="w-full pt-6 border-t border-[#E6DFD5] text-center sm:text-left space-y-3">
          <h3 className="text-sm font-black text-[#0F3A24]">
            Join Official WhatsApp Group
          </h3>
          
          <a
            href={hasGroupLink ? groupLink : undefined}
            target={hasGroupLink ? '_blank' : undefined}
            rel={hasGroupLink ? 'noopener noreferrer' : undefined}
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition ${
              hasGroupLink
                ? 'border-[#E6DFD5] bg-[#FAF7F2] hover:border-[#0F3A24] hover:shadow-xs cursor-pointer'
                : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0F3A24] text-white flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-[#D4A373]" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-extrabold text-[#0F3A24]">Official WhatsApp Group</h4>
                <p className="text-[11px] font-medium text-[#7A4F23]">Connect with fellow participants, mentors & updates</p>
              </div>
            </div>
            
            <span className={`text-xs font-extrabold shrink-0 ${hasGroupLink ? 'text-[#0F3A24]' : 'text-slate-400'}`}>
              {hasGroupLink ? 'Join Group →' : 'Link Soon'}
            </span>
          </a>

          {/* Sub-link for WhatsApp Community in small letters */}
          {communityLink && communityLink !== '#' && (
            <div className="text-center sm:text-left pt-1">
              <a
                href={communityLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#7A4F23] hover:text-[#0F3A24] hover:underline inline-flex items-center gap-1 transition"
              >
                <span>or join our official whatsapp community →</span>
              </a>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};
