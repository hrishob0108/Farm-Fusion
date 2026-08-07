import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import { exportToCSV, exportToJSON, exportToPDF } from '../../services/exportUtils';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle2, Clock, XCircle, Search,
  FileSpreadsheet, FileText, FileCode, Download, RefreshCw, Eye, X, LogOut,
  Sliders, Activity, Check, Power, Mail, Phone, QrCode, MessageSquare, Link as LinkIcon
} from 'lucide-react';

export const AdminDashboard = ({ onClose }) => {
  const { logout, adminUser } = useAuth();
  const { eventData, fetchEventDetails } = useEvent();

  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' | 'settings'
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Selected screenshot preview modal
  const [viewScreenshot, setViewScreenshot] = useState(null);

  // Event Settings Form State
  const [settingsForm, setSettingsForm] = useState(eventData || {});
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [qrFile, setQrFile] = useState(null);

  // Populate settingsForm ONCE on initial load without overwriting admin's active typing on background polling
  useEffect(() => {
    if (!settingsInitialized && eventData && Object.keys(eventData).length > 0) {
      setSettingsForm(eventData);
      setSettingsInitialized(true);
    }
  }, [eventData, settingsInitialized]);

  // Debounce search input by 300ms to eliminate typing lag and avoid excessive API requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load Registrations Data strictly from Backend
  const loadData = async (signal) => {
    try {
      setLoading(true);
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
      setLoading(false);
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
      toast.success('Event settings refreshed!');
    } catch (error) {
      toast.error('Failed to refresh event settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [debouncedSearchTerm, statusFilter]);

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

  // Update Registration Payment Status Handler
  const handleUpdateStatus = async (id, paymentStatus, rejectionReason = '') => {
    try {
      const res = await axios.put('/api/admin/payment-status', { id, paymentStatus, rejectionReason });
      if (res.data.success) {
        toast.success(`Payment status updated to ${paymentStatus}. Email notification dispatched!`);
        loadData();
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
        loadData();
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
    const newStatus = !settingsForm.registrationOpen;
    setSettingsForm(prev => ({ ...prev, registrationOpen: newStatus }));

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
        fetchEventDetails(); // Instantly update global context state
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
      const payload = new FormData();
      payload.append('eventName', settingsForm.eventName || 'FarmFusion');
      payload.append('tagline', settingsForm.tagline || 'Where AI Meets Agriculture');
      payload.append('eventDate', settingsForm.eventDate || new Date().toISOString());
      payload.append('registrationOpen', settingsForm.registrationOpen !== false);
      payload.append('minMembers', Number(settingsForm.minMembers) || 2);
      payload.append('maxMembers', Number(settingsForm.maxMembers) || 4);
      payload.append('maxTeams', Number(settingsForm.maxTeams) || 50);

      const paymentObj = {
        upiId: settingsForm.payment?.upiId || 'farmfusionai@okaxis',
        amount: Number(settingsForm.payment?.amount) || 499,
        accountHolder: settingsForm.payment?.accountHolder || 'FarmFusion Org',
        qrImage: settingsForm.payment?.qrImage || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis'
      };
      payload.append('payment', JSON.stringify(paymentObj));

      const whatsappObj = {
        group: settingsForm.whatsapp?.group || '',
        discussion: settingsForm.whatsapp?.discussion || ''
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
        fetchEventDetails();
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
        <div className="p-3.5 rounded-xl bg-white border border-[#E6DFD5] shadow-2xs text-left">
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Reservations
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
                  <th className="p-4">Members Count</th>
                  <th className="p-4">Txn ID / Receipt</th>
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
                      <td className="p-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#D9CEBE] text-[#0F3A24] text-[11px] font-extrabold">
                          {(reg.members?.length || 0) + 1} Total
                        </span>
                        <div className="text-[10px] text-[#7A4F23] font-bold mt-1 max-w-[200px] truncate" title={reg.members?.map(m => `${m.name} (${m.residenceType === 'Hosteller' ? `${m.hostelName} R#${m.roomNumber}` : 'Day Scholar'})`).join(', ')}>
                          {reg.members?.map(m => `${m.name} [${m.residenceType === 'Hosteller' ? `${m.hostelName || 'Hostel'} - ${m.roomNumber}` : 'Day Scholar'}]`).join(', ') || 'Leader Only'}
                        </div>
                      </td>

                      {/* Txn ID / Receipt */}
                      <td className="p-4">
                        <p className="font-mono text-xs font-extrabold text-[#0F3A24]">{reg.transactionId}</p>
                        {reg.paymentScreenshot && (
                          <button
                            onClick={() => setViewScreenshot(reg.paymentScreenshot)}
                            className="mt-1 flex items-center gap-1 text-[11px] text-[#0F3A24] hover:underline font-extrabold cursor-pointer"
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(reg._id, 'Verified')}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                            title="Verify Payment & Send Email to Team"
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleResendEmail(reg._id, reg.teamName)}
                            className="p-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                            title="Resend Verification Email to Team Leader & Teammates"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleUpdateStatus(reg._id, 'Rejected')}
                            className="p-1.5 rounded-lg bg-[#800E13]/10 text-[#800E13] hover:bg-[#800E13]/20 border border-[#800E13]/30 transition cursor-pointer"
                            title="Reject Payment"
                          >
                            <X className="w-4 h-4" />
                          </button>
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

      {/* TAB 2: EVENT SETTINGS */}
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
          <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h5 className="text-sm font-black text-[#0F3A24] flex items-center gap-2">
                <Power className={`w-4 h-4 ${settingsForm.registrationOpen ? 'text-[#0F3A24]' : 'text-[#800E13]'}`} />
                <span>Registration Portal Status</span>
              </h5>
              <p className="text-xs text-slate-600 font-medium mt-1">
                {settingsForm.registrationOpen
                  ? 'Currently OPEN: Attendees can fill form & register.'
                  : 'Currently CLOSED: All registration buttons on site are disabled and unclickable.'}
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleToggleRegistrationOpen}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-sm transition cursor-pointer flex items-center gap-2 ${
                settingsForm.registrationOpen
                  ? 'bg-[#0F3A24] hover:bg-[#0A2B1A] text-white'
                  : 'bg-[#800E13] hover:bg-[#600A0E] text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{settingsForm.registrationOpen ? 'Status: OPEN (ON)' : 'Status: CLOSED (OFF)'}</span>
            </button>
          </div>

          {/* Event Basic Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Event Name</label>
              <input
                type="text"
                value={settingsForm.eventName || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, eventName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Tagline</label>
              <input
                type="text"
                value={settingsForm.tagline || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Countdown Date</label>
              <input
                type="datetime-local"
                value={settingsForm.eventDate ? new Date(settingsForm.eventDate).toISOString().slice(0, 16) : ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, eventDate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Max Teams Limit</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.maxTeams !== undefined ? settingsForm.maxTeams : 50}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxTeams: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Min Team Size (Members)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.minMembers !== undefined ? settingsForm.minMembers : 2}
                onChange={(e) => setSettingsForm({ ...settingsForm, minMembers: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Max Team Size (Members)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.maxMembers !== undefined ? settingsForm.maxMembers : 4}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxMembers: e.target.value.replace(/\D/g, '') })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">UPI ID</label>
              <input
                type="text"
                value={settingsForm.payment?.upiId || ''}
                onChange={(e) => setSettingsForm({
                  ...settingsForm,
                  payment: { ...(settingsForm.payment || {}), upiId: e.target.value }
                })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Payment Amount (₹)</label>
              <input
                type="text"
                inputMode="numeric"
                value={settingsForm.payment?.amount !== undefined ? settingsForm.payment.amount : 499}
                onChange={(e) => setSettingsForm({
                  ...settingsForm,
                  payment: { ...(settingsForm.payment || {}), amount: e.target.value.replace(/\D/g, '') }
                })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-[#0F3A24] text-xs font-bold focus:outline-none focus:border-[#0F3A24]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Account Holder Name</label>
              <input
                type="text"
                value={settingsForm.payment?.accountHolder || ''}
                onChange={(e) => setSettingsForm({
                  ...settingsForm,
                  payment: { ...(settingsForm.payment || {}), accountHolder: e.target.value }
                })}
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
                    src={qrFile ? URL.createObjectURL(qrFile) : (settingsForm.payment?.qrImage || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis')}
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
                    onChange={(e) => setQrFile(e.target.files[0])}
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
      {viewScreenshot && (
        <div className="fixed inset-0 z-50 bg-[#0F3A24]/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white p-4 sm:p-6 rounded-2xl border border-[#E6DFD5] shadow-2xl">
            <button
              onClick={() => setViewScreenshot(null)}
              className="absolute top-3 right-3 p-2 bg-[#FAF7F2] rounded-full text-[#0F3A24] hover:bg-[#EFE9DF] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-sm font-black text-[#0F3A24] mb-3">Payment Receipt Screenshot</h4>
            <img src={viewScreenshot} alt="Payment Receipt" className="w-full max-h-[70vh] object-contain rounded-xl border border-[#E6DFD5]" />
          </div>
        </div>
      )}

    </div>
  );
};
