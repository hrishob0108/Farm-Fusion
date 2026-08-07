import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EventProvider, useEvent } from './context/EventContext';
import { AuthProvider } from './context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { BackgroundEffects } from './components/common/BackgroundEffects';
import { Navbar } from './components/common/Navbar';
import { ScrollToTop } from './components/common/ScrollToTop';
import { FloatingContact } from './components/common/FloatingContact';

import { HeroHome } from './components/registration/HeroHome';
import { RegistrationForm } from './components/registration/RegistrationForm';
import { PaymentSection } from './components/registration/PaymentSection';
import { SuccessSection } from './components/registration/SuccessSection';
import { AdminPage } from './components/admin/AdminPage';

const queryClient = new QueryClient();

const MainContent = () => {
  const { step } = useEvent();

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden">
      <BackgroundEffects />
      <Navbar />

      <main className="flex-1 relative z-10 pt-20 py-6">
        {/* Single Route Step Transition for Attendees */}
        {step === 1 && <HeroHome />}
        {step === 2 && <RegistrationForm />}
        {step === 3 && <PaymentSection />}
        {step === 4 && <SuccessSection />}
      </main>

      <FloatingContact />
      <ScrollToTop />
    </div>
  );
};

export default function App() {
  const secretCode = (import.meta.env.VITE_SECRET_CODE || import.meta.env.secretcode || '').trim();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventProvider>
          <BrowserRouter>
            <Toaster position="top-right" reverseOrder={false} />
            <Routes>
              {/* Main Registration Flow */}
              <Route path="/" element={<MainContent />} />
              
              {/* Admin Portal Route: Secret Code from .env is MANDATORY */}
              {secretCode && (
                <Route path={`/hero/farmfusion/${secretCode}`} element={<AdminPage />} />
              )}
              
              {/* Catch-all fallback */}
              <Route path="*" element={<MainContent />} />
            </Routes>
          </BrowserRouter>
        </EventProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
