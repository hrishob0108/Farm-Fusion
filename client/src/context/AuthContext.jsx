import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('farm_fusion_admin_token'));
  const [adminUser, setAdminUser] = useState(() => {
    const savedUser = localStorage.getItem('farm_fusion_admin_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const res = await axios.post('/api/admin/login', { username, password });
      if (res.data && res.data.success) {
        const { token: jwtToken, admin } = res.data;
        setToken(jwtToken);
        setAdminUser(admin);
        localStorage.setItem('farm_fusion_admin_token', jwtToken);
        localStorage.setItem('farm_fusion_admin_user', JSON.stringify(admin));
        toast.success(`Welcome Admin: ${admin.username}`);
        return true;
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid admin credentials';
      toast.error(msg);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setAdminUser(null);
    localStorage.removeItem('farm_fusion_admin_token');
    localStorage.removeItem('farm_fusion_admin_user');
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{
      token,
      adminUser,
      isAuthenticated: !!token,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
