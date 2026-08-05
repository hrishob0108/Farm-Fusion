import React, { useState, useEffect } from 'react';
import { useEvent } from '../../context/EventContext';
import { useDropzone } from 'react-dropzone';
import { compressImage } from '../../utils/imageCompressor';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { CreditCard, Copy, Check, FileCheck, Trash2, Loader2, ArrowLeft, ShieldCheck, Image as ImageIcon, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

export const PaymentSection = () => {
  const {
    eventData,
    formData,
    setStep,
    setSubmittedRegistration,
    checkLiveRegistrationOpen,
    activeReservation,
    releaseSlot,
    checkReservationStatus
  } = useEvent();

  const registeredCount = eventData.registeredCount || 0;
  const maxTeams = eventData.maxTeams || 50;
  const hasReservation = Boolean(activeReservation?.reservationId);
  
  // Allow payment submission for reservation holders as long as the admin portal is open
  const isPortalOpen = eventData.isPortalOpen !== false;
  const isRegistrationOpen = isPortalOpen || hasReservation;
  const showClosedBanner = !isPortalOpen && !hasReservation;
  
  const [transactionId, setTransactionId] = useState(formData.transactionId || '');
  const [checkingTxn, setCheckingTxn] = useState(false);
  const [txnAvailability, setTxnAvailability] = useState(null);

  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 5-Minute Reservation Countdown Timer State
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (!activeReservation?.expiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((new Date(activeReservation.expiresAt) - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        toast.error('⏰ Your 5-minute reservation slot has expired. Please fill out the registration form again to reserve a new slot.');
        releaseSlot();
        setStep(1);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeReservation]);

  // Initial reservation validity check on mount
  useEffect(() => {
    let isMounted = true;
    const verifyReservation = async () => {
      if (activeReservation?.reservationId) {
        const res = await checkReservationStatus();
        if (isMounted && !res.valid) {
          toast.error('Your reservation slot has expired or is invalid. Please fill out the registration form again.');
          setStep(1);
        }
      }
    };
    verifyReservation();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const payment = eventData.payment || {};
  const upiId = (payment.upiId && typeof payment.upiId === 'string' && !payment.upiId.includes('undefined')) ? payment.upiId : 'farmfusionai@okaxis';
  const amount = payment.amount || 499;
  const accountHolder = payment.accountHolder || 'FarmFusion Org';
  const qrImage = payment.qrImage || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis';

  // Automatic Debounced Duplicate Check for Transaction ID
  useEffect(() => {
    if (!transactionId || transactionId.trim().length < 4) {
      setTxnAvailability(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingTxn(true);
      try {
        const res = await axios.post('/api/check-duplicate', { transactionId: transactionId.trim() });
        if (res.data.isDuplicate && res.data.duplicateField === 'transactionId') {
          setTxnAvailability({ isDuplicate: true, message: 'Transaction ID already exists / has been submitted!' });
        } else {
          setTxnAvailability({ isDuplicate: false, message: 'Transaction ID is valid!' });
        }
      } catch (e) {
        setTxnAvailability(null);
      } finally {
        setCheckingTxn(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [transactionId]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  const onDrop = async (acceptedFiles, fileRejections) => {
    if (!isRegistrationOpen) return;

    if (fileRejections && fileRejections.length > 0) {
      const err = fileRejections[0]?.errors[0];
      if (err?.code === 'file-too-large') {
        toast.error('File size exceeds 10MB limit. Please upload a smaller image.');
      } else {
        toast.error('Invalid file type. Only image screenshots (JPEG, JPG, PNG, WEBP) are allowed.');
      }
      return;
    }

    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      try {
        const compressed = await compressImage(file);
        if (!compressed.name) {
          Object.defineProperty(compressed, 'name', { value: file.name, writable: false });
        }
        setScreenshotFile(compressed);
        setScreenshotPreview(URL.createObjectURL(compressed));
      } catch (e) {
        setScreenshotFile(file);
        setScreenshotPreview(URL.createObjectURL(file));
      }
      toast.success('Payment screenshot attached successfully!');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !isRegistrationOpen,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.pjpeg']
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1
  });

  const removeFile = () => {
    if (!isRegistrationOpen) return;
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();

    if (activeReservation?.reservationId) {
      const res = await checkReservationStatus();
      if (!res.valid) {
        toast.error('Your 5-minute reservation slot has expired. Please fill out the registration form again.');
        setStep(1);
        return;
      }
    } else {
      const status = await checkLiveRegistrationOpen();
      if (!status.isOpen) {
        toast.error(
          status.isLimit
            ? 'Registrations are CLOSED because the maximum team limit has been reached.'
            : 'Registrations are currently CLOSED by the event organizers.'
        );
        return;
      }
    }

    if (!transactionId || transactionId.trim().length < 6) {
      toast.error('Please enter a valid Transaction ID (Min 6 characters)');
      return;
    }

    if (transactionId.includes('@')) {
      toast.error('Transaction ID / UTR number cannot contain @ symbol');
      return;
    }

    if (txnAvailability && txnAvailability.isDuplicate) {
      toast.error('Transaction ID already exists. Please check your transaction details.');
      return;
    }

    if (!screenshotFile) {
      toast.error('Please upload your payment receipt screenshot image (Max 10MB)');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Submitting team registration...');

    try {
      const payload = new FormData();
      payload.append('teamName', formData.teamName);
      payload.append('leader', JSON.stringify(formData.leader));
      payload.append('members', JSON.stringify(formData.members || []));
      if (activeReservation?.reservationId) {
        payload.append('reservationId', activeReservation.reservationId);
      }
      payload.append('transactionId', transactionId.trim());
      
      const fileName = screenshotFile.name || 'screenshot.png';
      payload.append('paymentScreenshot', screenshotFile, fileName);

      const res = await axios.post('/api/register', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.dismiss(loadingToast);
        toast.success('🎉 Registration submitted & slot permanently confirmed!');
        setSubmittedRegistration(res.data.registration);
        setStep(4);
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      const message = error.response?.data?.message || 'Submission failed. Please check your details.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = async () => {
    if (window.confirm('Going back will release your temporary 5-minute slot reservation. Are you sure?')) {
      await releaseSlot();
      setStep(2);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-4 py-6"
    >
      {/* Clean White Card */}
      <div className="bg-white border border-[#E6DFD5] rounded-2xl p-6 sm:p-10 shadow-md">
        
        {/* Closed Banner */}
        {showClosedBanner && (
          <div className="mb-6 p-4 rounded-xl bg-[#800E13]/10 border border-[#800E13]/30 text-[#800E13] text-xs sm:text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#800E13] shrink-0" />
            <span>
              {registeredCount >= maxTeams
                ? `Registrations are CLOSED. Maximum allowed team limit (${maxTeams} teams) has been reached.`
                : 'Registrations are currently CLOSED. Submission buttons are disabled.'}
            </span>
          </div>
        )}

        {/* 5-Minute Temporary Reservation Countdown Banner */}
        {activeReservation && (
          <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
            timeLeft < 60 ? 'bg-[#800E13]/10 border-[#800E13]/40 text-[#800E13]' : 'bg-[#FAF7F2] border-[#E6DFD5] text-[#0F3A24]'
          }`}>
            <div className="flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                timeLeft < 60 ? 'bg-[#800E13] text-white animate-pulse' : 'bg-[#0F3A24] text-[#D4A373]'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                  Slot Reserved Temporarily ({activeReservation.teamName || formData?.teamName})
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Slot Locked" />
                </p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">
                  Complete your payment within 5 minutes to confirm your registration slot.
                </p>
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-mono font-black px-3.5 py-1.5 rounded-lg border text-center shrink-0 ${
              timeLeft < 60 ? 'bg-[#800E13] text-white border-[#600A0E] animate-bounce' : 'bg-white text-[#0F3A24] border-[#D9CEBE]'
            }`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="border-b border-[#E6DFD5] pb-6 mb-8 text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0F3A24] text-white flex items-center justify-center shadow-sm shrink-0">
            <CreditCard className="w-6 h-6 text-[#D4A373]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#0F3A24]">
              Payment & Verification
            </h2>
            <p className="text-sm font-bold text-[#7A4F23] mt-0.5">
              Complete payment of ₹{amount} to confirm registration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left: QR & UPI */}
          <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] text-center">
            
            <div className="p-3 bg-white rounded-xl shadow-sm mb-4 border border-[#E6DFD5]">
              <img
                src={qrImage}
                alt="Payment QR Code"
                className="w-48 h-48 object-contain rounded-lg"
              />
            </div>

            <div className="px-4 py-1.5 rounded-lg bg-[#0F3A24] text-white font-extrabold text-base mb-4">
              Fee: ₹{amount}
            </div>

            <div className="w-full max-w-xs p-3 rounded-lg bg-white border border-[#E6DFD5] flex items-center justify-between gap-2 shadow-sm">
              <div className="text-left overflow-hidden">
                <span className="block text-[10px] font-black text-[#7A4F23] uppercase">UPI ID</span>
                <span className="font-mono text-xs font-black text-[#0F3A24] truncate block">
                  {upiId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="p-1.5 rounded-md bg-[#FAF7F2] text-[#0F3A24] hover:bg-[#EFE9DF] font-bold"
                title="Copy UPI ID"
              >
                {copied ? <Check className="w-4 h-4 text-[#0F3A24]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-xs text-[#7A4F23] mt-3 font-bold">
              Account Holder: <span className="font-black text-[#0F3A24]">{accountHolder}</span>
            </p>
          </div>

          {/* Right: Upload & Form */}
          <form onSubmit={handleFinalSubmit} className="space-y-5">
            
            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                Transaction ID / UPI Ref No <span className="text-[#800E13]">*</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  disabled={!isRegistrationOpen}
                  placeholder="e.g. 320918239012"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value.replace(/@/g, ''))}
                  onInput={(e) => { e.target.value = e.target.value.replace(/@/g, ''); }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-sm font-mono font-bold uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />

                {checkingTxn && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-400 font-semibold">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0F3A24]" />
                  </div>
                )}
              </div>

              <p className="text-[11px] font-bold text-[#7A4F23] mt-1">
                Note: Enter the Transaction ID or UTR number only. <span className="text-[#800E13] font-black">Do not enter</span> a UPI ID.
              </p>

              {/* Live Duplicate Transaction ID Indicator */}
              {txnAvailability && !checkingTxn && (
                <div className={`flex items-center gap-1.5 text-xs font-bold mt-1.5 ${
                  txnAvailability.isDuplicate ? 'text-[#800E13]' : 'text-[#0F3A24]'
                }`}>
                  {txnAvailability.isDuplicate ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-[#0F3A24]" />}
                  <span>{txnAvailability.message}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                Upload Payment Screenshot <span className="text-[#800E13]">*</span>
              </label>

              {!screenshotFile ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    !isRegistrationOpen
                      ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                      : isDragActive
                      ? 'border-[#0F3A24] bg-[#FAF7F2]'
                      : 'border-[#D9CEBE] hover:border-[#0F3A24] bg-[#FAF7F2]/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <ImageIcon className="w-8 h-8 text-[#0F3A24] mx-auto mb-2" />
                  <p className="text-xs font-bold text-[#0F3A24]">
                    {isDragActive ? 'Drop screenshot here...' : 'Click to select or drag & drop payment screenshot'}
                  </p>
                  <p className="text-[10px] text-[#7A4F23] mt-1 font-bold">Images: JPEG, JPG, PNG, WEBP (Up to 10MB)</p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {screenshotPreview ? (
                      <img src={screenshotPreview} alt="Screenshot Preview" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <FileCheck className="w-6 h-6 text-[#0F3A24]" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-[#0F3A24] truncate">{screenshotFile.name || 'Screenshot'}</p>
                      <p className="text-[10px] text-[#7A4F23] font-medium">{(screenshotFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  {isRegistrationOpen && (
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1.5 text-[#800E13] hover:bg-[#800E13]/10 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E6DFD5] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBackToForm}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg border border-[#D9CEBE] text-[#0F3A24] text-xs font-bold hover:bg-[#FAF7F2] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer ${
                  isRegistrationOpen && !isSubmitting
                    ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white'
                    : 'bg-[#800E13] hover:bg-[#600A0E] text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#D4A373]" />
                    <span>
                      {isRegistrationOpen 
                        ? 'Submit Registration' 
                        : isLimitReached 
                        ? 'Registrations Closed (Limit Reached)' 
                        : 'Registrations Closed'}
                    </span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

      </div>
    </motion.div>
  );
};
