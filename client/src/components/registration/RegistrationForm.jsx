import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useEvent } from '../../context/EventContext';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, XCircle, User, Users, Loader2, AlertCircle, Mail } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export const RegistrationForm = () => {
  const { eventData, formData, setFormData, setStep, checkLiveRegistrationOpen, reserveSlot } = useEvent();

  const registeredCount = eventData.registeredCount || 0;
  const maxTeams = eventData.maxTeams || 50;
  const isLimitReached = registeredCount >= maxTeams;
  const isRegistrationOpen = eventData.registrationOpen !== false && !isLimitReached;

  const minMembers = eventData.minMembers || 2;
  const maxMembers = eventData.maxMembers || 4;
  const numAdditionalMembers = Math.max(0, maxMembers - 1);

  // Automatic Live Team Name Availability State
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailability, setNameAvailability] = useState(null);

  // Initialize members default array to match numAdditionalMembers
  const defaultMembers = Array.from({ length: numAdditionalMembers }, (_, i) => ({
    name: formData.members?.[i]?.name || '',
    regNo: formData.members?.[i]?.regNo || '',
    phone: formData.members?.[i]?.phone || '',
    section: formData.members?.[i]?.section || '',
    branch: formData.members?.[i]?.branch || ''
  }));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm({
    defaultValues: {
      teamName: formData.teamName || '',
      leader: formData.leader || { name: '', regNo: '', phone: '', section: '', branch: '' },
      members: defaultMembers
    }
  });

  const { fields, append } = useFieldArray({
    control,
    name: 'members'
  });

  // Ensure all member forms are directly populated up to numAdditionalMembers
  useEffect(() => {
    if (fields.length < numAdditionalMembers) {
      for (let i = fields.length; i < numAdditionalMembers; i++) {
        append({ name: '', regNo: '', phone: '', section: '', branch: '' });
      }
    }
  }, [numAdditionalMembers, fields.length, append]);

  const watchedValues = watch();
  const watchedTeamName = watch('teamName');
  const watchedLeaderRegNo = watch('leader.regNo');

  useEffect(() => {
    const subscription = watch((value) => {
      setFormData(value);
    });
    return () => subscription.unsubscribe();
  }, [watch, setFormData]);

  // Automatic Debounced Team Name Availability Check
  useEffect(() => {
    if (!watchedTeamName || watchedTeamName.trim().length < 3) {
      setNameAvailability(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingName(true);
      try {
        const res = await axios.post('/api/check-duplicate', { teamName: watchedTeamName.trim() });
        if (res.data.isDuplicate) {
          setNameAvailability({ isAvailable: false, message: 'Team Name is already taken!' });
          setError('teamName', { type: 'manual', message: 'This Team Name is already taken.' });
        } else {
          setNameAvailability({ isAvailable: true, message: 'Team Name is available!' });
          clearErrors('teamName');
        }
      } catch (e) {
        setNameAvailability(null);
      } finally {
        setCheckingName(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedTeamName]);

  const onSubmit = async (data) => {
    if (!isRegistrationOpen) {
      toast.error(isLimitReached ? 'Registrations are CLOSED because team limit has been reached.' : 'Registrations are currently closed by the administrator.');
      return;
    }

    // Validate Leader Details
    if (!data.leader?.name?.trim() || !data.leader?.regNo?.trim() || !data.leader?.phone?.trim() || !data.leader?.section?.trim() || !data.leader?.branch?.trim()) {
      toast.error('Please complete all 5 required fields for Team Leader.');
      return;
    }

    // Auto-generate @klu.ac.in email for leader
    const leaderWithEmail = {
      ...data.leader,
      email: `${data.leader.regNo.trim()}@klu.ac.in`
    };

    // Filter out valid (filled) members and attach auto @klu.ac.in emails
    const rawMembers = data.members || [];
    const validMembers = [];

    for (let i = 0; i < rawMembers.length; i++) {
      const m = rawMembers[i];
      const hasAnyField = m.name?.trim() || m.regNo?.trim() || m.phone?.trim() || m.section?.trim() || m.branch?.trim();

      if (hasAnyField) {
        // If member form is partially filled, require all 5 fields
        if (!m.name?.trim() || !m.regNo?.trim() || !m.phone?.trim() || !m.section?.trim() || !m.branch?.trim()) {
          toast.error(`Please complete all 5 required fields for Member ${i + 2}.`);
          return;
        }
        validMembers.push({
          ...m,
          email: `${m.regNo.trim()}@klu.ac.in`
        });
      }
    }

    const totalTeamSize = 1 + validMembers.length;

    if (totalTeamSize < minMembers) {
      toast.error('Please fill in all required team member details to proceed.');
      return;
    }

    if (totalTeamSize > maxMembers) {
      toast.error('Team member limit exceeded.');
      return;
    }

    if (nameAvailability && !nameAvailability.isAvailable) {
      toast.error('Team Name is already taken. Please choose a different name.');
      return;
    }

    const status = await checkLiveRegistrationOpen();
    if (!status.isOpen) {
      toast.error(
        status.isLimit
          ? 'Registrations are CLOSED because the maximum team limit has been reached.'
          : 'Registrations are currently CLOSED by the event organizers.'
      );
      return;
    }

    const finalData = {
      ...data,
      leader: leaderWithEmail,
      members: validMembers
    };

    setFormData(finalData);

    const res = await reserveSlot(finalData);
    if (!res.success) {
      toast.error(res.message || 'Failed to reserve slot. Please check your details.');
      return;
    }

    toast.success('🎉 Slot reserved for 5:00 minutes! Proceeding to Payment...');
    setStep(3);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto px-4 py-6"
    >
      {/* Clean White Form Card */}
      <div className="bg-white border border-[#E6DFD5] rounded-2xl p-6 sm:p-10 shadow-md">
        
        {/* Closed Banner */}
        {!isRegistrationOpen && (
          <div className="mb-6 p-4 rounded-xl bg-[#800E13]/10 border border-[#800E13]/30 text-[#800E13] text-xs sm:text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#800E13] shrink-0" />
            <span>
              {isLimitReached
                ? 'Registrations are CLOSED. Event has reached maximum capacity.'
                : 'Registrations are currently CLOSED. Form buttons are disabled.'}
            </span>
          </div>
        )}

        {/* Simple Clean Header with Official Logo */}
        <div className="border-b border-[#E6DFD5] pb-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0F3A24]">
              Event Registration
            </h2>
            <p className="text-sm text-[#7A4F23] mt-1 font-bold">
              Complete your team registration details below.
            </p>
          </div>
          <img
            src="/farm-fusion-logo.png"
            alt="FarmFusion Logo"
            className="h-12 sm:h-16 object-contain"
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* 1. TOP SECTION: TEAM NAME WITH AUTOMATIC LIVE CHECK */}
          <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] space-y-2">
            <label className="block text-xs font-black text-[#0F3A24] uppercase tracking-wide">
              Team Name <span className="text-[#800E13]">*</span>
            </label>
            
            <div className="relative">
              <input
                type="text"
                disabled={!isRegistrationOpen}
                placeholder="e.g. AgriTech Warriors"
                {...register('teamName', { required: 'Team Name is required' })}
                className="w-full px-4 py-3 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />

              {checkingName && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-400 font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F3A24]" />
                  <span>Checking...</span>
                </div>
              )}
            </div>

            {/* Automatic Availability Indicator */}
            {nameAvailability && !checkingName && (
              <div className={`flex items-center gap-1.5 text-xs font-bold ${
                nameAvailability.isAvailable ? 'text-[#0F3A24]' : 'text-[#800E13]'
              }`}>
                {nameAvailability.isAvailable ? <CheckCircle2 className="w-4 h-4 text-[#0F3A24]" /> : <XCircle className="w-4 h-4" />}
                <span>{nameAvailability.message}</span>
              </div>
            )}
            
            {errors.teamName && <p className="text-[#800E13] text-xs font-bold">{errors.teamName.message}</p>}
          </div>

          {/* 2. TEAM LEADER DETAILS (MEMBER 1) */}
          <div className="p-5 rounded-xl bg-[#FAF7F2]/50 border border-[#E6DFD5] space-y-4">
            <h3 className="text-base font-extrabold text-[#0F3A24] uppercase tracking-wide border-b border-[#E6DFD5] pb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-[#7A4F23]" />
              <span>Team Leader Details (Member 1) *</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Leader Name */}
              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                  Full Name <span className="text-[#800E13]">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isRegistrationOpen}
                  placeholder="Team Leader Full Name"
                  {...register('leader.name')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Leader Registration Number & Live @klu.ac.in Email Badge */}
              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                  Registration Number <span className="text-[#800E13]">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isRegistrationOpen}
                  placeholder="e.g. 992400....."
                  {...register('leader.regNo')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                />
                {watchedLeaderRegNo && watchedLeaderRegNo.trim().length > 0 && (
                  <p className="text-[11px] font-extrabold text-[#7A4F23] mt-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#7A4F23] inline" />
                    <span>Email: {watchedLeaderRegNo.trim()}@klu.ac.in</span>
                  </p>
                )}
              </div>

              {/* Leader Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                  Phone Number <span className="text-[#800E13]">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  disabled={!isRegistrationOpen}
                  placeholder="10-digit Mobile Number"
                  {...register('leader.phone')}
                  onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Leader Section */}
              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                  Section <span className="text-[#800E13]">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isRegistrationOpen}
                  placeholder="e.g. S1 / Section A"
                  {...register('leader.section')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Leader Branch */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                  Branch / Department <span className="text-[#800E13]">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isRegistrationOpen}
                  placeholder="e.g. Computer Science Engineering"
                  {...register('leader.branch')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

            </div>
          </div>

          {/* 3. ALL ADDITIONAL MEMBER FORMS SHOWN DIRECTLY */}
          {fields.map((field, index) => {
            const memberNumber = index + 2;
            const isRequiredMember = memberNumber <= minMembers;
            const watchedMemberRegNo = watchedValues.members?.[index]?.regNo;

            return (
              <div key={field.id} className="p-5 rounded-xl bg-[#FAF7F2]/50 border border-[#E6DFD5] space-y-4">
                <div className="border-b border-[#E6DFD5] pb-2 flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-[#0F3A24] uppercase tracking-wide flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#7A4F23]" />
                    <span>Member {memberNumber} Details {isRequiredMember ? '*' : '(Optional)'}</span>
                  </h3>
                  <span className="text-xs font-bold text-[#7A4F23]">
                    {isRequiredMember ? 'Required' : 'Optional'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Member Name */}
                  <div>
                    <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                      Full Name {isRequiredMember && <span className="text-[#800E13]">*</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!isRegistrationOpen}
                      placeholder={`Member ${memberNumber} Full Name`}
                      {...register(`members.${index}.name`)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Member Registration Number & Live @klu.ac.in Email Badge */}
                  <div>
                    <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                      Registration Number {isRequiredMember && <span className="text-[#800E13]">*</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!isRegistrationOpen}
                      placeholder="e.g. 992400......"
                      {...register(`members.${index}.regNo`)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    {watchedMemberRegNo && watchedMemberRegNo.trim().length > 0 && (
                      <p className="text-[11px] font-extrabold text-[#7A4F23] mt-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#7A4F23] inline" />
                        <span>Email: {watchedMemberRegNo.trim()}@klu.ac.in</span>
                      </p>
                    )}
                  </div>

                  {/* Member Phone Number */}
                  <div>
                    <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                      Phone Number {isRequiredMember && <span className="text-[#800E13]">*</span>}
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      disabled={!isRegistrationOpen}
                      placeholder="10-digit Mobile Number"
                      {...register(`members.${index}.phone`)}
                      onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Member Section */}
                  <div>
                    <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                      Section {isRequiredMember && <span className="text-[#800E13]">*</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!isRegistrationOpen}
                      placeholder="e.g. S1 / Section A"
                      {...register(`members.${index}.section`)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {/* Member Branch */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                      Branch / Department {isRequiredMember && <span className="text-[#800E13]">*</span>}
                    </label>
                    <input
                      type="text"
                      disabled={!isRegistrationOpen}
                      placeholder="e.g. Computer Science Engineering"
                      {...register(`members.${index}.branch`)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-white text-[#0F3A24] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24] disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                </div>
              </div>
            );
          })}

          {/* Action Buttons */}
          <div className="pt-6 border-t border-[#E6DFD5] flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#D9CEBE] text-[#0F3A24] text-sm font-bold hover:bg-[#FAF7F2] transition cursor-pointer"
            >
              ← Back To Home
            </button>

            <button
              type="submit"
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer ${
                isRegistrationOpen
                  ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white'
                  : 'bg-[#800E13] hover:bg-[#600A0E] text-white'
              }`}
            >
              <span>
                {isRegistrationOpen 
                  ? 'Proceed to Payment' 
                  : isLimitReached 
                  ? 'Registrations Closed (Limit Reached)' 
                  : 'Registrations Closed'}
              </span>
              <ArrowRight className="w-4 h-4 text-[#D4A373]" />
            </button>
          </div>

        </form>

      </div>
    </motion.div>
  );
};
