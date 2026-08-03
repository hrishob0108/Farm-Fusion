import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, User, ArrowLeft } from 'lucide-react';

export const AdminPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await login(username, password);
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#0F3A24] p-4 sm:p-6 md:p-8 flex flex-col justify-between">
      
      {/* Top Navigation Header */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between py-4 mb-6 border-b border-[#E6DFD5]">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-xs font-bold text-[#0F3A24] hover:text-[#7A4F23] transition"
        >
          <ArrowLeft className="w-4 h-4 text-[#7A4F23]" /> 
          <span>Back to Registration Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <img src="/farm-fusion-logo.png" alt="FarmFusion Logo" className="h-7 object-contain" />
          <span className="text-xs font-extrabold text-[#7A4F23] uppercase tracking-wider hidden sm:inline">Admin Portal</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full flex-1 flex items-center justify-center">
        {isAuthenticated ? (
          <AdminDashboard onClose={() => navigate('/')} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-[#E6DFD5] shadow-md text-[#0F3A24]"
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#0F3A24] text-[#D4A373] flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-[#0F3A24]">Admin Portal</h3>
              <p className="text-xs font-bold text-[#7A4F23] mt-1">Sign in to manage registrations & event settings</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#7A4F23] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-sm font-bold text-[#0F3A24] focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#7A4F23] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-sm font-bold text-[#0F3A24] focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl font-extrabold text-white bg-[#0F3A24] hover:bg-[#0A2B1A] shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isLoggingIn ? 'Authenticating...' : 'Sign In To Dashboard'}</span>
              </button>
            </form>
          </motion.div>
        )}
      </div>

      <div className="text-center text-xs font-bold text-[#7A4F23] mt-8">
        © 2026 FarmFusion • Admin Portal
      </div>
    </div>
  );
};
