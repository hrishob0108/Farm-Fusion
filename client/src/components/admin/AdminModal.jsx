import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import { AdminDashboard } from './AdminDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, User, X, KeyRound } from 'lucide-react';

export const AdminModal = () => {
  const { isAdminOpen, setIsAdminOpen } = useEvent();
  const { isAuthenticated, login } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin1289');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isAdminOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await login(username, password);
    setIsLoggingIn(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F3A24]/60 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-7xl my-4 sm:my-8 relative"
        >
          {isAuthenticated ? (
            <AdminDashboard onClose={() => setIsAdminOpen(false)} />
          ) : (
            /* Admin Login Card */
            <div className="max-w-md mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-[#E6DFD5] shadow-xl text-[#0F3A24] relative">
              
              <button
                onClick={() => setIsAdminOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-[#0F3A24] rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#0F3A24] text-[#D4A373] flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-[#0F3A24]">Admin Access</h3>
                <p className="text-xs font-bold text-[#7A4F23] mt-1">Sign in with administrator credentials</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F3A24] uppercase mb-1">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#7A4F23] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#D9CEBE] bg-[#FAF7F2]/50 text-sm font-bold text-[#0F3A24] focus:outline-none focus:ring-2 focus:ring-[#0F3A24]/20 focus:border-[#0F3A24]"
                      required
                    />
                  </div>
                </div>

                {/* Default Credentials Hint Box */}
                <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E6DFD5] text-[11px] text-[#7A4F23] font-bold flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0F3A24] shrink-0" />
                  <span>Default Admin: <strong className="text-[#0F3A24]">admin</strong> / <strong className="text-[#0F3A24]">admin1289</strong></span>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 rounded-xl font-extrabold text-white bg-[#0F3A24] hover:bg-[#0A2B1A] shadow-md transition cursor-pointer"
                >
                  {isLoggingIn ? 'Authenticating...' : 'Sign In To Dashboard'}
                </button>
              </form>

            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
