import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import { exportToCSV, exportToJSON, exportToPDF } from '../../services/exportUtils';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle2, Clock, XCircle, Search, AlertTriangle,
  FileSpreadsheet, FileText, FileCode, Download, RefreshCw, Eye, X, LogOut,
  Sliders, Activity, Check, Power, Mail, Phone, QrCode, MessageSquare, Link as LinkIcon
} from 'lucide-react';

export const AdminDashboard = ({ onClose }) => {
  const { logout, adminUser } = useAuth();
  const { eventData, fetchEventDetails, setEventData } = useEvent();

  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' | 'reservations' | 'settings'
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reservations State
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationStatusFilter, setReservationStatusFilter] = useState('All');
  const [selectedReservationModal, setSelectedReservationModal] = useState(null); // Reservation details modal

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Selected screenshot preview modal
  const [viewScreenshot, setViewScreenshot] = useState(null);

  // Confirmation Modal State for Verify / Reject / Resend Email actions
  const [pendingAction, setPendingAction] = useState(null); // { type: 'verify' | 'reject' | 'resend', reg: Object }
  const [selectedReasonChip, setSelectedReasonChip] = useState('');
  const [customReasonNote, setCustomReasonNote] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const REJECTION_PRESETS = [
    'Invalid UTR / Transaction ID',
    'Payment Screenshot Unclear or Missing',
    'Incorrect Payment Amount',
    'Duplicate Registration Submission',
    'Other / Custom Reason'
  ];

  const openConfirmModal = (type, reg) => {
    setPendingAction({ type, reg });
    setSelectedReasonChip('');
    setCustomReasonNote('');
  };

  const closeConfirmModal = () => {
    if (isActionSubmitting) return;
    setPendingAction(null);
    setSelectedReasonChip('');
    setCustomReasonNote('');
  };

  const handleConfirmActionSubmit = async () => {
    if (!pendingAction || !pendingAction.reg) return;
    const { type, reg } = pendingAction;
    setIsActionSubmitting(true);

    try {
      if (type === 'verify') {
        await handleUpdateStatus(reg._id, 'Verified');
      } else if (type === 'reject') {
        let finalReason = selectedReasonChip;
        if (selectedReasonChip === 'Other / Custom Reason' || !selectedReasonChip) {
          finalReason = customReasonNote.trim() || 'Payment details could not be verified.';
        } else if (customReasonNote.trim()) {
          finalReason = `${selectedReasonChip} - ${customReasonNote.trim()}`;
        }
        await handleUpdateStatus(reg._id, 'Rejected', finalReason);
      } else if (type === 'resend') {
        await handleResendEmail(reg._id, reg.teamName);
      }
      setPendingAction(null);
    } catch (err) {
      console.error('Confirmation action error:', err);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Event Settings Form State
  const [settingsForm, setSettingsForm] = useState(eventData || {});
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [qrFile, setQrFile] = useState(null);

  // Fetch fresh event details directly from MongoDB on mount to populate settings form with real DB values
  useEffect(() => {
    let isMounted = true;
    const fetchLiveEventSettings = async () => {
      try {
        const res = await axios.get('/api/event');
        if (isMounted && res.data) {
          setEventData(res.data);
          setSettingsForm(res.data);
          setIsFormDirty(false);
        }
      } catch (err) {
        console.warn('[AdminDashboard] Live settings fetch error:', err.message);
      }
    };

    fetchLiveEventSettings();
    return () => { isMounted = false; };
  }, []);

  // Synchronize settingsForm with eventData from EventContext whenever new data arrives from backend
  useEffect(() => {
    if (eventData && Object.keys(eventData).length > 0 && !isFormDirty) {
      setSettingsForm(eventData);
    }
  }, [eventData, isFormDirty]);

  // Debounce search input by 300ms to eliminate typing lag and avoid excessive API requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Registrations Data strictly from Backend (with silent background polling support)
  const loadData = async (signal, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const regRes = await axios.get('/api/admin/registrations', {
        params: { search: debouncedSearchTerm, status: statusFilter },
        signal: signal instanceof AbortSignal ? signal : undefined
      });
      if (regRes.data?.registrations) {
        setRegistrations(regRes.data.registrations);
      }
    } catch (error) {
      if (!axios.isCancel(error) && error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.warn('[AdminDashboard] Registration fetch fallback active:', error.message);
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Load Reservations Data from Backend
  const loadReservationsData = async (signal, isSilent = false) => {
    try {
      if (!isSilent) setLoadingReservations(true);
      const res = await axios.get('/api/admin/reservations', {
        params: { search: debouncedSearchTerm, status: reservationStatusFilter },
        signal: signal instanceof AbortSignal ? signal : undefined
      });
      if (res.data?.reservations) {
        setReservations(res.data.reservations);
      }
    } catch (error) {
      if (!axios.isCancel(error) && error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.warn('[AdminDashboard] Reservation fetch error:', error.message);
      }
    } finally {
      if (!isSilent) setLoadingReservations(false);
    }
  };

  // Manual Refresh Handler (Fetches fresh event details + registrations ON DEMAND when Refresh button is clicked)
  const handleRefreshSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/event');
      if (res.data) {
        setEventData(res.data);
        setSettingsForm(res.data);
      }
      await loadData();
      await loadReservationsData();
      toast.success('Event settings refreshed!');
    } catch (error) {
      toast.error('Failed to refresh event settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'reservations') {
      loadReservationsData(controller.signal, false);
    } else {
      loadData(controller.signal, false);
    }

    // Silent background auto-refresh every 10 seconds for live updates
    const interval = setInterval(() => {
      if (activeTab === 'reservations') {
        loadReservationsData(undefined, true);
      } else {
        loadData(undefined, true);
      }
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [debouncedSearchTerm, statusFilter, reservationStatusFilter, activeTab]);

  // Real-time instant client-side filtering over loaded records
  const filteredRegistrations = React.useMemo(() => {
    if (!searchTerm.trim()) return registrations;

    const term = searchTerm.toLowerCase().trim();
    return registrations.filter(reg => {
      const teamName = reg.teamName?.toLowerCase() || '';
      const leaderName = reg.leader?.name?.toLowerCase() || '';
      const regNo = reg.leader?.regNo?.toLowerCase() || '';
      const email = reg.leader?.email?.toLowerCase() || '';
      const txnId = reg.transactionId?.toLowerCase() || '';
      const phone = reg.leader?.phone?.toLowerCase() || '';

      return (
        teamName.includes(term) ||
        leaderName.includes(term) ||
        regNo.includes(term) ||
        email.includes(term) ||
        txnId.includes(term) ||
        phone.includes(term)
      );
    });
  }, [registrations, searchTerm]);

  // Client-side filtering for Reservations
  const filteredReservations = React.useMemo(() => {
    let result = reservations;
    if (reservationStatusFilter !== 'All') {
      result = result.filter(r => r.status === reservationStatusFilter);
    }
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter(res => {
      const teamName = res.teamName?.toLowerCase() || '';
      const leaderName = res.leader?.name?.toLowerCase() || '';
      const regNo = res.leader?.regNo?.toLowerCase() || '';
      const email = res.leader?.email?.toLowerCase() || '';
      const txnId = res.transactionId?.toLowerCase() || '';
      const resId = res.reservationId?.toLowerCase() || '';
      const phone = res.leader?.phone?.toLowerCase() || '';

      return (
        teamName.includes(term) ||
        leaderName.includes(term) ||
        regNo.includes(term) ||
        email.includes(term) ||
        txnId.includes(term) ||
        resId.includes(term) ||
        phone.includes(term)
      );
    });
  }, [reservations, searchTerm, reservationStatusFilter]);

  // Update Registration Payment Status Handler
  const handleUpdateStatus = async (id, paymentStatus, rejectionReason = '') => {
    try {
      const res = await axios.put('/api/admin/payment-status', { id, paymentStatus, rejectionReason });
      if (res.data.success) {
        toast.success(`Payment status updated to ${paymentStatus}. Email notification dispatched!`);
        loadData(undefined, true);
      }
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

  // Manually Resend Verification Email to Team Leader & Teammates
  const handleResendEmail = async (id, teamName) => {
    const loadingToast = toast.loading(`Sending verification email to Team ${teamName}...`);
    try {
      const res = await axios.post('/api/admin/resend-email', { id });
      toast.dismiss(loadingToast);
      if (res.data.success) {
        toast.success(`Verification email successfully sent to Team "${teamName}" leader & teammates!`);
        loadData(undefined, true);
      } else {
        toast.error(res.data.message || 'Failed to send email');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.message || 'Failed to send verification email');
    }
  };

  // Dedicated Instant 1-Click Toggle for Registration Open / Close Status in MongoDB
  const handleToggleRegistrationOpen = async () => {
    const currentStatus = settingsForm.isPortalOpen !== undefined ? settingsForm.isPortalOpen : (settingsForm.registrationOpen !== false);
    const newStatus = !currentStatus;
    setSettingsForm(prev => ({ ...prev, isPortalOpen: newStatus, registrationOpen: newStatus }));

    const loadingToast = toast.loading(`Updating MongoDB status to ${newStatus ? 'OPEN' : 'CLOSED'}...`);

    try {
      const payload = new FormData();
      payload.append('registrationOpen', newStatus);

      const res = await axios.put('/api/admin/event', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.dismiss(loadingToast);
        toast.success(`Registration status updated in DB: ${newStatus ? 'OPEN' : 'CLOSED'}`);
        const fresh = await axios.get('/api/event');
        if (fresh.data) {
          setEventData(fresh.data);
          setSettingsForm(fresh.data);
          setIsFormDirty(false);
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to update registration status in DB');
    }
  };

  // Update Event Settings Handler
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading('Saving event settings to DB...');

    try {
      const currentPortalOpen = settingsForm.isPortalOpen !== undefined ? settingsForm.isPortalOpen : (settingsForm.registrationOpen !== false);

      const payload = new FormData();
      payload.append('eventName', settingsForm.eventName || 'FarmFusion');
      payload.append('tagline', settingsForm.tagline !== undefined ? settingsForm.tagline : 'Where AI Meets Agriculture');
      payload.append('eventDate', settingsForm.eventDate || new Date().toISOString());
      payload.append('registrationOpen', currentPortalOpen);
      payload.append('minMembers', Number(settingsForm.minMembers) || 2);
      payload.append('maxMembers', Number(settingsForm.maxMembers) || 4);
      payload.append('maxTeams', Number(settingsForm.maxTeams) || 50);

      const paymentObj = {
        upiId: settingsForm.payment?.upiId !== undefined ? settingsForm.payment.upiId : '',
        amount: settingsForm.payment?.amount !== undefined ? Number(settingsForm.payment.amount) : 0,
        accountHolder: settingsForm.payment?.accountHolder !== undefined ? settingsForm.payment.accountHolder : '',
        qrImage: settingsForm.payment?.qrImage || ''
      };
      payload.append('payment', JSON.stringify(paymentObj));

      const whatsappObj = {
        group: settingsForm.whatsapp?.group || '',
        discussion: settingsForm.whatsapp?.discussion || '',
        channel: settingsForm.whatsapp?.channel || ''
      };
      payload.append('whatsapp', JSON.stringify(whatsappObj));

      if (qrFile) {
        payload.append('qrImage', qrFile);
      }

      const res = await axios.put('/api/admin/event', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        toast.dismiss(loadingToast);
        toast.success('Payment, WhatsApp & Event settings updated in MongoDB!');
        const fresh = await axios.get('/api/event');
        if (fresh.data) {
          setEventData(fresh.data);
          setSettingsForm(fresh.data);
          setIsFormDirty(false);
        }
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto bg-white text-[#0F3A24] rounded-2xl overflow-hidden shadow-xl border border-[#E6DFD5]">
      
      {/* Admin Header */}
      <div className="px-4 sm:px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DFD5] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F3A24] text-[#D4A373] flex items-center justify-center font-bold shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-[#0F3A24]">FarmFusion Admin Portal</h3>
            <p className="text-xs font-bold text-[#7A4F23]">Logged in as: <span className="text-[#0F3A24]">{adminUser?.username || 'admin'}</span></p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleRefreshSettings}
            className="p-2 sm:px-3 sm:py-2 rounded-lg bg-white border border-[#D9CEBE] text-[#0F3A24] hover:bg-[#FAF7F2] transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Refresh Settings & Data"
          >
            <RefreshCw className={`w-4 h-4 text-[#7A4F23] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#800E13]/10 text-[#800E13] border border-[#800E13]/30 hover:bg-[#800E13]/20 text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white border border-[#D9CEBE] text-[#0F3A24] hover:bg-[#FAF7F2] transition cursor-pointer"
            title="Close Admin Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Live Analytics & Team Count Banner (Visible to Admin Only) */}
      <div className="px-4 sm:px-6 py-4 bg-[#FAF7F2]/60 border-b border-[#E6DFD5] grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Registered / Occupied Capacity */}
        <div className="p-3.5 rounded-xl bg-white border border-[#E6DFD5] shadow-2xs text-left">
          <p className="text-[10px] font-black text-[#7A4F23] uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#0F3A24]" /> Total Capacity
          </p>
          <p className="text-lg sm:text-xl font-black text-[#0F3A24] mt-0.5">
            {eventData.registeredCount || 0} / {eventData.maxTeams || 50} <span className="text-xs font-bold text-slate-500">Teams</span>
          </p>
          <p className="text-[10px] font-bold text-[#7A4F23] mt-0.5">
            {eventData.registrationProgress || 0}% Occupied
          </p>
        </div>

        {/* Confirmed Registrations */}
        <div className="p-3.5 rounded-xl bg-white border border-[#E6DFD5] shadow-2xs text-left">
          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed
          </p>
          <p className="text-lg sm:text-xl font-black text-emerald-900 mt-0.5">
            {eventData.confirmedCount !== undefined ? eventData.confirmedCount : registrations.filter(r => r.paymentStatus === 'Verified').length} <span className="text-xs font-bold text-slate-500">Teams</span>
          </p>
          <p className="text-[10px] font-bold text-emerald-700 mt-0.5">Verified Payments</p>
        </div>

        {/* Active 5-Min Temporary Reservations */}
        <div
          onClick={() => setActiveTab('reservations')}
          className="p-3.5 rounded-xl bg-white border border-[#E6DFD5] hover:border-amber-400 shadow-2xs text-left cursor-pointer transition"
          title="Click to view Reservations Table"
        >
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Reservations
            </span>
            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">View &rarr;</span>
          </p>
          <p className="text-lg sm:text-xl font-black text-amber-900 mt-0.5">
            {eventData.activeReservedCount || 0} <span className="text-xs font-bold text-slate-500">Holding</span>
          </p>
          <p className="text-[10px] font-bold text-amber-700 mt-0.5">Active 5-Min Slots</p>
        </div>

        {/* Available Remaining Slots */}
        <div className="p-3.5 rounded-xl bg-white border border-[#E6DFD5] shadow-2xs text-left">
          <p className="text-[10px] font-black text-[#0F3A24] uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#0F3A24]" /> Available Slots
          </p>
          <p className="text-lg sm:text-xl font-black text-[#0F3A24] mt-0.5">
            {Math.max(0, (eventData.maxTeams || 50) - (eventData.registeredCount || 0))} <span className="text-xs font-bold text-slate-500">Left</span>
          </p>
          <p className="text-[10px] font-bold text-[#7A4F23] mt-0.5">Open for Booking</p>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-[#E6DFD5] flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'registrations', label: 'Registrations Table', icon: Users },
          { id: 'reservations', label: 'Reservations Table', icon: Clock },
          { id: 'settings', label: 'Event Settings', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0F3A24] text-white shadow-sm'
                  : 'bg-[#FAF7F2] text-[#7A4F23] border border-[#E6DFD5] hover:bg-[#EFE9DF]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REGISTRATIONS TABLE */}
      {activeTab === 'registrations' && (
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* Controls Bar: Search, Status Filter & Export buttons */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 text-[#7A4F23] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Team, Leader, Reg No, Email, Txn ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9CEBE] text-xs font-bold text-[#0F3A24] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-[#0F3A24] hover:bg-slate-200/60 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter & Export Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9CEBE] text-xs font-bold text-[#0F3A24] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </select>

              <button
                onClick={() => exportToCSV(filteredRegistrations)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#FAF7F2] text-[#0F3A24] border border-[#D9CEBE] hover:bg-[#EFE9DF] text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#0F3A24]" /> CSV
              </button>

              <button
                onClick={() => exportToJSON(filteredRegistrations)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#FAF7F2] text-[#7A4F23] border border-[#D9CEBE] hover:bg-[#EFE9DF] text-xs font-bold transition cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-[#7A4F23]" /> JSON
              </button>

              <button
                onClick={() => exportToPDF(filteredRegistrations)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#FAF7F2] text-[#0F3A24] border border-[#D9CEBE] hover:bg-[#EFE9DF] text-xs font-bold transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[#0F3A24]" /> PDF
              </button>

            </div>

          </div>

          {/* Registrations Table Container */}
          <div className="overflow-x-auto rounded-xl border border-[#E6DFD5] bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] text-[#0F3A24] font-black border-b border-[#E6DFD5] uppercase tracking-wider">
                  <th className="p-4">Team & Leader</th>
                  <th className="p-4">Reg No / Email / Phone</th>
                  <th className="p-4">Section / Branch</th>
                  <th className="py-4 pl-3 pr-0 w-28 whitespace-nowrap">Members Count</th>
                  <th className="py-4 pl-1 pr-3 w-36 whitespace-nowrap">Txn ID / Receipt</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFD5] text-[#0F3A24]">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#7A4F23] font-bold">
                      {searchTerm ? `No registrations match "${searchTerm}"` : 'No team registrations found.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map(reg => (
                    <tr key={reg._id} className="hover:bg-[#FAF7F2]/60 transition">
                      
                      {/* Team & Leader */}
                      <td className="p-4">
                        <p className="font-extrabold text-[#0F3A24] text-sm">{reg.teamName}</p>
                        <p className="text-[#7A4F23] font-bold mt-0.5">{reg.leader?.name}</p>
                      </td>

                      {/* Reg No / Email / Phone */}
                      <td className="p-4">
                        <p className="font-mono text-[#0F3A24] font-extrabold">{reg.leader?.regNo || 'N/A'}</p>
                        <p className="text-[11px] text-[#7A4F23] font-bold flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#7A4F23] inline shrink-0" />
                          <span>{reg.leader?.email || (reg.leader?.regNo ? `${reg.leader.regNo}@klu.ac.in` : 'N/A')}</span>
                        </p>
                        <p className="text-slate-600 text-[11px] font-medium flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500 inline shrink-0" />
                          <span>{reg.leader?.phone}</span>
                        </p>
                      </td>

                      {/* Section / Branch / Residency */}
                      <td className="p-4">
                        <p className="font-bold text-[#0F3A24]">{reg.leader?.section || 'N/A'}</p>
                        <p className="text-slate-600 text-[11px] font-medium">{reg.leader?.branch || 'N/A'}</p>
                        <p className="text-[11px] font-bold text-[#7A4F23] mt-0.5">
                          {reg.leader?.residenceType === 'Hosteller' 
                            ? `Hosteller (${reg.leader.hostelName || 'Hostel'} - Room ${reg.leader.roomNumber || ''})` 
                            : (reg.leader?.residenceType || 'Day Scholar')}
                        </p>
                      </td>

                      {/* Members */}
                      <td className="py-4 pl-3 pr-0 w-28 align-top">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#D9CEBE] text-[#0F3A24] text-[11px] font-extrabold whitespace-nowrap">
                          {(reg.members?.length || 0) + 1} Total
                        </span>
                        <div className="text-[10px] text-[#7A4F23] font-bold mt-1 max-w-[130px] truncate" title={reg.members?.map(m => `${m.name} (${m.residenceType === 'Hosteller' ? `${m.hostelName} R#${m.roomNumber}` : 'Day Scholar'})`).join(', ')}>
                          {reg.members?.map(m => `${m.name} [${m.residenceType === 'Hosteller' ? `${m.hostelName || 'Hostel'} - ${m.roomNumber}` : 'Day Scholar'}]`).join(', ') || 'Leader Only'}
                        </div>
                      </td>

                      {/* Txn ID / Receipt */}
                      <td className="py-4 pl-1 pr-3 w-36 align-top">
                        <p className="font-mono text-xs font-extrabold text-[#0F3A24] whitespace-nowrap">{reg.transactionId}</p>
                        {reg.paymentScreenshot && (
                          <button
                            onClick={() => setViewScreenshot(reg.paymentScreenshot)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-[#0F3A24] hover:underline font-extrabold cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#7A4F23]" /> View Receipt
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          reg.paymentStatus === 'Verified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                          reg.paymentStatus === 'Rejected' ? 'bg-[#800E13]/10 text-[#800E13] border border-[#800E13]/30' :
                          reg.paymentStatus === 'Resubmit Requested' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                          'bg-sky-50 text-sky-800 border border-sky-300'
                        }`}>
                          {reg.paymentStatus === 'Verified' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {reg.paymentStatus === 'Pending' && <Clock className="w-3 h-3 text-sky-600" />}
                          {reg.paymentStatus === 'Rejected' && <XCircle className="w-3 h-3 text-[#800E13]" />}
                          {reg.paymentStatus}
                        </span>

                        {reg.emailSent && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title={`Email sent on ${new Date(reg.emailSentAt).toLocaleString()}`}>
                              <Mail className="w-3 h-3 text-emerald-600" /> Email Sent
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          {reg.paymentStatus !== 'Verified' && (
                            <button
                              onClick={() => openConfirmModal('verify', reg)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="Verify Payment & Send Ticket Email"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Verify</span>
                            </button>
                          )}

                          <button
                            onClick={() => openConfirmModal('resend', reg)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 text-xs font-extrabold transition cursor-pointer flex items-center gap-1 shrink-0"
                            title="Send or Resend Email Notification to Team"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{reg.paymentStatus === 'Verified' ? 'Resend' : 'Mail'}</span>
                          </button>

                          {reg.paymentStatus !== 'Rejected' && (
                            <button
                              onClick={() => openConfirmModal('reject', reg)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#800E13]/10 hover:bg-[#800E13]/20 text-[#800E13] border border-[#800E13]/30 text-xs font-extrabold transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="Reject Registration"
                            >
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Reject</span>
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 2: RESERVATIONS TABLE */}
      {activeTab === 'reservations' && (
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* Controls Bar: Search, Status Filter & Export button */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 text-[#7A4F23] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Team, Leader, Reg No, Txn ID, Res ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9CEBE] text-xs font-bold text-[#0F3A24] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-[#0F3A24] hover:bg-slate-200/60 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter & Export Button */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
              
              <select
                value={reservationStatusFilter}
                onChange={(e) => setReservationStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-[#FAF7F2] border border-[#D9CEBE] text-xs font-bold text-[#0F3A24] cursor-pointer"
              >
                <option value="All">All Reservation Statuses</option>
                <option value="reserved">Reserved (Active 5-Min)</option>
                <option value="confirmed">Confirmed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                onClick={() => exportToCSV(filteredReservations)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#FAF7F2] text-[#0F3A24] border border-[#D9CEBE] hover:bg-[#EFE9DF] text-xs font-bold transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#0F3A24]" /> Export CSV
              </button>

            </div>

          </div>

          {/* Reservations Table Container */}
          <div className="overflow-x-auto rounded-xl border border-[#E6DFD5] bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] text-[#0F3A24] font-black border-b border-[#E6DFD5] uppercase tracking-wider">
                  <th className="p-4">Reservation ID</th>
                  <th className="p-4">Team & Leader</th>
                  <th className="p-4">Reg No / Contact</th>
                  <th className="p-4">Transaction ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reserved / Expires</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFD5] text-[#0F3A24]">
                {loadingReservations ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#7A4F23] font-bold">
                      Loading reservations data...
                    </td>
                  </tr>
                ) : filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-[#7A4F23] font-bold">
                      {searchTerm ? `No reservations match "${searchTerm}"` : 'No reservation records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map(resItem => (
                    <tr key={resItem._id} className="hover:bg-[#FAF7F2]/60 transition">
                      
                      {/* Reservation ID */}
                      <td className="p-4">
                        <span className="font-mono text-xs font-bold text-[#0F3A24] bg-[#FAF7F2] px-2 py-0.5 rounded border border-[#D9CEBE]">
                          {resItem.reservationId}
                        </span>
                      </td>

                      {/* Team & Leader */}
                      <td className="p-4">
                        <p className="font-extrabold text-[#0F3A24] text-sm">{resItem.teamName}</p>
                        <p className="text-[#7A4F23] font-bold mt-0.5">{resItem.leader?.name}</p>
                      </td>

                      {/* Reg No / Contact */}
                      <td className="p-4">
                        <p className="font-mono text-[#0F3A24] font-extrabold">{resItem.leader?.regNo || 'N/A'}</p>
                        <p className="text-[11px] text-[#7A4F23] font-bold flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-[#7A4F23]" />
                          <span>{resItem.leader?.phone || 'N/A'}</span>
                        </p>
                      </td>

                      {/* Transaction ID */}
                      <td className="p-4">
                        <span className="font-mono text-xs font-extrabold text-[#0F3A24] bg-[#FAF7F2] px-2.5 py-1 rounded-lg border border-[#D9CEBE] inline-block whitespace-nowrap">
                          {resItem.transactionId || 'N/A'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          resItem.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                          resItem.status === 'reserved' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                          resItem.status === 'cancelled' ? 'bg-rose-50 text-rose-800 border border-rose-300' :
                          'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {resItem.status === 'confirmed' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {resItem.status === 'reserved' && <Clock className="w-3 h-3 text-amber-600 animate-pulse" />}
                          {resItem.status === 'cancelled' && <XCircle className="w-3 h-3 text-rose-600" />}
                          {resItem.status === 'expired' && <AlertTriangle className="w-3 h-3 text-slate-500" />}
                          <span className="capitalize">{resItem.status}</span>
                        </span>
                      </td>

                      {/* Reserved / Expires At */}
                      <td className="p-4 text-[11px] font-bold text-slate-600">
                        <p>Reserved: {resItem.reservedAt ? new Date(resItem.reservedAt).toLocaleTimeString() : 'N/A'}</p>
                        <p className="text-amber-800 mt-0.5">Expires: {resItem.expiresAt ? new Date(resItem.expiresAt).toLocaleTimeString() : 'N/A'}</p>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedReservationModal(resItem)}
                          className="px-3 py-1.5 rounded-lg bg-[#0F3A24] text-white hover:bg-[#0A2B1A] text-xs font-extrabold shadow-2xs transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Modal
                        </button>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: EVENT SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-2">
            <h4 className="text-lg font-black text-[#0F3A24]">
              Configure Live Event & Team Limits Settings
            </h4>
            <button
              type="button"
              onClick={handleRefreshSettings}
              className="px-3 py-1 rounded-lg bg-[#FAF7F2] border border-[#D9CEBE] text-[#0F3A24] hover:bg-[#EFE9DF] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              title="Refresh Event Settings from Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#7A4F23] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Settings</span>
            </button>
          </div>

          {/* Dedicated Instant 1-Click Registration Status Switch for MongoDB */}
          {(() => {
            const isPortalOpen = settingsForm.isPortalOpen !== undefined ? settingsForm.isPortalOpen : (settingsForm.registrationOpen !== false);
            return (
              <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h5 className="text-sm font-black text-[#0F3A24] flex items-center gap-2">
                    <Power className={`w-4 h-4 ${isPortalOpen ? 'text-[#0F3A24]' : 'text-[#800E13]'}`} />
                    <span>Registration Portal Status</span>
                  </h5>
                  <p className="text-xs text-slate-600 font-medium mt-1">
                    {isPortalOpen
                      ? 'Currently OPEN: Attendees can fill form & register.'
                      : 'Currently CLOSED: All registration buttons on site are disabled and unclickable.'}
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={handleToggleRegistrationOpen}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-sm transition cursor-pointer flex items-center gap-2 ${
                    isPortalOpen
                      ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white'
                      : 'bg-[#800E13] hover:bg-[#600A0E] text-white'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{isPortalOpen ? 'Status: OPEN (ON)' : 'Status: CLOSED (OFF)'}</span>
                </button>
              </div>
            );
          })()}

          {/* Event Basic Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Event Name</label>
              <input
                type="text"
                value={settingsForm.eventName || ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, eventName: e.target.value }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Tagline</label>
              <input
                type="text"
                value={settingsForm.tagline || ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, tagline: e.target.value }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Countdown Date</label>
              <input
                type="datetime-local"
                value={settingsForm.eventDate ? new Date(settingsForm.eventDate).toISOString().slice(0, 16) : ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, eventDate: e.target.value }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Max Teams Limit</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.maxTeams !== undefined ? settingsForm.maxTeams : ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, maxTeams: e.target.value.replace(/\D/g, '') }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Min Team Size (Members)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.minMembers !== undefined ? settingsForm.minMembers : ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, minMembers: e.target.value.replace(/\D/g, '') }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Max Team Size (Members)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.maxMembers !== undefined ? settingsForm.maxMembers : ''}
                onChange={(e) => { setIsFormDirty(true); setSettingsForm({ ...settingsForm, maxMembers: e.target.value.replace(/\D/g, '') }); }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">UPI ID</label>
              <input
                type="text"
                value={settingsForm.payment?.upiId || ''}
                onChange={(e) => {
                  setIsFormDirty(true);
                  setSettingsForm({
                    ...settingsForm,
                    payment: { ...(settingsForm.payment || {}), upiId: e.target.value }
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Payment Amount (₹)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.payment?.amount !== undefined && settingsForm.payment.amount !== null ? settingsForm.payment.amount : ''}
                onChange={(e) => {
                  setIsFormDirty(true);
                  setSettingsForm({
                    ...settingsForm,
                    payment: { ...(settingsForm.payment || {}), amount: e.target.value.replace(/\D/g, '') }
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Account Holder Name</label>
              <input
                type="text"
                value={settingsForm.payment?.accountHolder || ''}
                onChange={(e) => {
                  setIsFormDirty(true);
                  setSettingsForm({
                    ...settingsForm,
                    payment: { ...(settingsForm.payment || {}), accountHolder: e.target.value }
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            {/* Payment QR Code Preview & File Upload Box */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-[#0F3A24] uppercase">
                Payment QR Code Image Preview & Upload
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5]">
                {/* Live QR Image Box */}
                <div className="w-32 h-32 p-2 bg-white rounded-xl border border-[#D9CEBE] shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src={
                      qrFile
                        ? URL.createObjectURL(qrFile)
                        : (settingsForm.payment?.qrImage
                            ? settingsForm.payment.qrImage
                            : (settingsForm.payment?.upiId
                                ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(settingsForm.payment.upiId)}`
                                : ''))
                    }
                    alt="Payment QR Code Preview"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-extrabold text-[#0F3A24]">
                    <QrCode className="w-4 h-4 text-[#7A4F23]" />
                    <span>{qrFile ? `New File Selected: ${qrFile.name}` : 'Current Payment QR Code Image'}</span>
                  </div>
                  
                  <p className="text-[11px] text-[#7A4F23] font-bold">
                    This QR code is displayed to attendees on the Payment & Verification screen.
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { setIsFormDirty(true); setQrFile(e.target.files[0]); }}
                    className="w-full text-xs text-[#0F3A24] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#0F3A24] file:text-white hover:file:bg-[#0A2B1A] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Official WhatsApp Links Section: Community & Discussion */}
            <div className="sm:col-span-2 space-y-3 border-t border-[#E6DFD5] pt-4">
              <h5 className="text-sm font-black text-[#0F3A24] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#7A4F23]" />
                <span>Configure WhatsApp Community & Discussion Links</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                    WhatsApp Community Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={settingsForm.whatsapp?.group || ''}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      whatsapp: { ...(settingsForm.whatsapp || {}), group: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-medium focus:outline-none focus:border-[#0F3A24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">
                    Discussion Group Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={settingsForm.whatsapp?.discussion || ''}
                    onChange={(e) => setSettingsForm({
                      ...settingsForm,
                      whatsapp: { ...(settingsForm.whatsapp || {}), discussion: e.target.value }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-medium focus:outline-none focus:border-[#0F3A24]"
                  />
                </div>
              </div>
            </div>

          </div>

          <button
            type="submit"
            className="px-8 py-3 rounded-xl bg-[#0F3A24] hover:bg-[#0A2B1A] text-white text-xs font-extrabold shadow-md cursor-pointer transition"
          >
            Save Live Event Settings
          </button>
        </form>
      )}

      {/* Screenshot Preview Modal */}
      <AnimatePresence>
        {viewScreenshot && (
          <div className="fixed inset-0 z-50 bg-[#0F3A24]/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-2xl w-full bg-white p-4 sm:p-6 rounded-2xl border border-[#E6DFD5] shadow-2xl"
            >
              <button
                onClick={() => setViewScreenshot(null)}
                className="absolute top-3 right-3 p-2 bg-[#FAF7F2] rounded-full text-[#0F3A24] hover:bg-[#EFE9DF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h4 className="text-sm font-black text-[#0F3A24] mb-3">Payment Receipt Screenshot</h4>
              <img src={viewScreenshot} alt="Payment Receipt" className="w-full max-h-[70vh] object-contain rounded-xl border border-[#E6DFD5]" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User-Friendly Action Confirmation Modal (Verify / Reject / Resend Email) */}
      <AnimatePresence>
        {pendingAction && pendingAction.reg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F3A24]/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-white rounded-2xl border border-[#E6DFD5] shadow-2xl overflow-hidden relative text-[#0F3A24] my-8"
            >
              {/* Header */}
              <div className={`px-6 py-4 border-b flex items-center justify-between ${
                pendingAction.type === 'verify' ? 'bg-emerald-50/90 border-emerald-200' :
                pendingAction.type === 'reject' ? 'bg-[#800E13]/5 border-[#800E13]/15' :
                'bg-sky-50/90 border-sky-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                    pendingAction.type === 'verify' ? 'bg-emerald-600 text-white' :
                    pendingAction.type === 'reject' ? 'bg-[#800E13] text-white' :
                    'bg-sky-600 text-white'
                  }`}>
                    {pendingAction.type === 'verify' && <CheckCircle2 className="w-5 h-5" />}
                    {pendingAction.type === 'reject' && <AlertTriangle className="w-5 h-5" />}
                    {pendingAction.type === 'resend' && <Mail className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#0F3A24]">
                      {pendingAction.type === 'verify' && 'Confirm Payment Verification'}
                      {pendingAction.type === 'reject' && 'Confirm Registration Rejection'}
                      {pendingAction.type === 'resend' && 'Resend Verification Email'}
                    </h4>
                    <p className="text-xs font-bold text-[#7A4F23]">
                      Team: <span className="text-[#0F3A24] font-black">{pendingAction.reg.teamName}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeConfirmModal}
                  disabled={isActionSubmitting}
                  className="p-1.5 rounded-full text-slate-400 hover:text-[#0F3A24] hover:bg-white/80 transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                
                {/* Registration Details Summary Card */}
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] text-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Leader:</span>
                    <span className="font-extrabold text-[#0F3A24]">{pendingAction.reg.leader?.name} ({pendingAction.reg.leader?.regNo})</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Transaction ID:</span>
                    <span className="font-mono font-extrabold text-[#0F3A24] bg-white px-2 py-0.5 rounded border border-[#D9CEBE]">
                      {pendingAction.reg.transactionId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#7A4F23]">Team Size:</span>
                    <span className="font-extrabold text-[#0F3A24]">{(pendingAction.reg.members?.length || 0) + 1} Members</span>
                  </div>

                  {/* Payment Screenshot Thumbnail Preview if available */}
                  {pendingAction.reg.paymentScreenshot && (
                    <div className="pt-2 border-t border-[#E6DFD5] flex items-center justify-between">
                      <span className="font-bold text-[#7A4F23]">Receipt Screenshot:</span>
                      <button
                        type="button"
                        onClick={() => setViewScreenshot(pendingAction.reg.paymentScreenshot)}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#0F3A24] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#7A4F23]" /> View Receipt
                      </button>
                    </div>
                  )}
                </div>

                {/* Verification Info Alert */}
                {pendingAction.type === 'verify' && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Are you sure you want to verify this payment?</p>
                      <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed font-medium">
                        Verifying will update status to <span className="font-extrabold">Verified</span> and automatically dispatch the official event ticket & QR code email to <span className="font-extrabold">{pendingAction.reg.leader?.email}</span> and teammates.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rejection Info Alert & Reason Controls */}
                {pendingAction.type === 'reject' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Please select or enter a rejection reason:</p>
                        <p className="mt-0.5 text-[11px] text-amber-800 font-medium">
                          This reason will be included in the automated rejection notification email sent to the team.
                        </p>
                      </div>
                    </div>

                    {/* Quick Reason Chips */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#7A4F23] mb-1.5">
                        Quick Preset Reasons:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {REJECTION_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setSelectedReasonChip(preset);
                              if (preset !== 'Other / Custom Reason' && !customReasonNote) {
                                setCustomReasonNote('');
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                              selectedReasonChip === preset
                                ? 'bg-[#800E13] text-white border-[#800E13] shadow-2xs'
                                : 'bg-[#FAF7F2] text-[#0F3A24] border-[#D9CEBE] hover:bg-[#EFE9DF]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom / Additional Reason Text */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[#7A4F23] mb-1">
                        Custom Note / Specific Reason (Optional):
                      </label>
                      <textarea
                        rows={3}
                        value={customReasonNote}
                        onChange={(e) => setCustomReasonNote(e.target.value)}
                        placeholder="e.g. Transaction ID mismatch. Please re-check your UPI payment reference number and contact support."
                        className="w-full p-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-xs font-medium text-[#0F3A24] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#800E13]/20 focus:border-[#800E13]"
                      />
                    </div>
                  </div>
                )}

                {/* Resend Info Alert */}
                {pendingAction.type === 'resend' && (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Resend ticket email to team?</p>
                      <p className="mt-1 text-[11px] text-sky-800 leading-relaxed font-medium">
                        This will re-dispatch the confirmation ticket email and WhatsApp links to Team <span className="font-extrabold">"{pendingAction.reg.teamName}"</span>.
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#E6DFD5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  disabled={isActionSubmitting}
                  className="px-4 py-2 rounded-xl border border-[#D9CEBE] bg-white text-[#0F3A24] hover:bg-[#FAF7F2] text-xs font-extrabold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmActionSubmit}
                  disabled={isActionSubmitting}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-extrabold shadow-md transition cursor-pointer flex items-center gap-2 ${
                    pendingAction.type === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    pendingAction.type === 'reject' ? 'bg-[#800E13] hover:bg-[#600A0E]' :
                    'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {isActionSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      {pendingAction.type === 'verify' && <CheckCircle2 className="w-4 h-4" />}
                      {pendingAction.type === 'reject' && <XCircle className="w-4 h-4" />}
                      {pendingAction.type === 'resend' && <Mail className="w-4 h-4" />}
                      <span>
                        {pendingAction.type === 'verify' && 'Confirm & Verify Payment'}
                        {pendingAction.type === 'reject' && 'Confirm & Reject'}
                        {pendingAction.type === 'resend' && 'Confirm & Send Email'}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reservation Details Modal (with Transaction ID) */}
      <AnimatePresence>
        {selectedReservationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F3A24]/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-white rounded-2xl border border-[#E6DFD5] shadow-2xl overflow-hidden relative text-[#0F3A24] my-8"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DFD5] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <h4 className="text-base font-black text-[#0F3A24]">
                    Reservation Details
                  </h4>
                </div>

                <button
                  onClick={() => setSelectedReservationModal(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-[#0F3A24] hover:bg-white transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                
                {/* Highlighted Transaction ID Banner */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                  <p className="font-extrabold uppercase text-amber-900 text-[10px] tracking-wider">Transaction ID Reference:</p>
                  <p className="font-mono text-sm font-black text-[#0F3A24] bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs select-all inline-block">
                    {selectedReservationModal.transactionId || 'N/A (Not Provided)'}
                  </p>
                </div>

                {/* Reservation Summary */}
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] text-xs space-y-2.5">
                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Reservation ID:</span>
                    <span className="font-mono font-extrabold text-[#0F3A24] bg-white px-2 py-0.5 rounded border border-[#D9CEBE]">
                      {selectedReservationModal.reservationId}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Team Name:</span>
                    <span className="font-extrabold text-sm text-[#0F3A24]">{selectedReservationModal.teamName}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Status:</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold capitalize ${
                      selectedReservationModal.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                      selectedReservationModal.status === 'reserved' ? 'bg-amber-50 text-amber-800 border border-amber-300' :
                      selectedReservationModal.status === 'cancelled' ? 'bg-rose-50 text-rose-800 border border-rose-300' :
                      'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {selectedReservationModal.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Leader Name:</span>
                    <span className="font-extrabold text-[#0F3A24]">{selectedReservationModal.leader?.name}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Leader Reg No:</span>
                    <span className="font-mono font-extrabold text-[#0F3A24]">{selectedReservationModal.leader?.regNo}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Phone Number:</span>
                    <span className="font-extrabold text-[#0F3A24]">{selectedReservationModal.leader?.phone}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Section / Branch:</span>
                    <span className="font-extrabold text-[#0F3A24]">{selectedReservationModal.leader?.section} - {selectedReservationModal.leader?.branch}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#7A4F23]">Residence Type:</span>
                    <span className="font-extrabold text-[#0F3A24]">
                      {selectedReservationModal.leader?.residenceType === 'Hosteller'
                        ? `Hosteller (${selectedReservationModal.leader.hostelName || 'Hostel'} - Room ${selectedReservationModal.leader.roomNumber})`
                        : 'Day Scholar'}
                    </span>
                  </div>

                  {/* Teammates List */}
                  {Array.isArray(selectedReservationModal.members) && selectedReservationModal.members.length > 0 && (
                    <div className="pt-2">
                      <span className="font-bold text-[#7A4F23] block mb-1.5">Teammates:</span>
                      <div className="space-y-1.5">
                        {selectedReservationModal.members.map((m, idx) => (
                          <div key={idx} className="p-2 bg-white rounded-lg border border-[#D9CEBE] text-[11px] flex justify-between">
                            <span className="font-bold text-[#0F3A24]">{m.name} ({m.regNo})</span>
                            <span className="text-slate-600 font-medium">{m.phone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center text-[10px] font-bold text-slate-500">
                    <span>Reserved: {selectedReservationModal.reservedAt ? new Date(selectedReservationModal.reservedAt).toLocaleString() : 'N/A'}</span>
                    <span>Expires: {selectedReservationModal.expiresAt ? new Date(selectedReservationModal.expiresAt).toLocaleString() : 'N/A'}</span>
                  </div>

                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-[#FAF7F2] border-t border-[#E6DFD5] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedReservationModal(null)}
                  className="px-5 py-2 rounded-xl bg-[#0F3A24] hover:bg-[#0A2B1A] text-white text-xs font-extrabold shadow-sm transition cursor-pointer"
                >
                  Close Modal
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
