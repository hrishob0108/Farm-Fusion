import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const EventContext = createContext();

export const EventProvider = ({ children }) => {
  // Active Reservation State (Persisted in LocalStorage)
  const [activeReservation, setActiveReservation] = useState(() => {
    const saved = localStorage.getItem('farm_fusion_active_reservation');
    if (saved) {
      try { return JSON.parse(saved); } catch (_e) {}
    }
    return null;
  });

  const [step, setStep] = useState(() => {
    const savedRes = localStorage.getItem('farm_fusion_active_reservation');
    if (savedRes) {
      try {
        const parsed = JSON.parse(savedRes);
        if (parsed?.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          return 3; // Auto-resume on Payment Page on page reload!
        }
      } catch (_e) {}
    }
    return 1;
  });

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [submittedRegistration, setSubmittedRegistration] = useState(null);

  // Default Event Fallback State
  const [eventData, setEventData] = useState(() => ({
    eventName: 'FarmFusion',
    tagline: 'Where AI Meets Agriculture',
    eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    registrationOpen: true,
    registrationProgress: 68,
    minMembers: 2,
    maxMembers: 4,
    maxTeams: 50,
    payment: {
      upiId: 'farmfusionai@okaxis',
      amount: 499,
      accountHolder: 'FarmFusion Org',
      qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis'
    },
    whatsapp: {
      group: 'https://chat.whatsapp.com/sample-official-group',
      discussion: 'https://chat.whatsapp.com/sample-discussion-group',
      channel: 'https://whatsapp.com/channel/sample-channel'
    }
  }));

  // Draft Registration Form Data (Saved in LocalStorage)
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('farm_fusion_form_draft');
    if (saved) {
      try { return JSON.parse(saved); } catch (_e) {}
    }
    return {
      teamName: '',
      leader: { name: '', regNo: '', section: '', branch: '', phone: '', email: '', residenceType: '', hostelName: '', roomNumber: '' },
      members: [],
      transactionId: '',
      paymentScreenshot: null
    };
  });

  // Ensure root HTML class is clean light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Persist Form Draft in LocalStorage
  useEffect(() => {
    localStorage.setItem('farm_fusion_form_draft', JSON.stringify(formData));
  }, [formData]);

  // Fetch Event Details from Backend
  const fetchEventDetails = async () => {
    try {
      const res = await axios.get('/api/event');
      if (res.data) {
        setEventData(res.data);
      }
    } catch (error) {
      console.warn('[EventContext] Using default event details due to API delay:', error.message);
    } finally {
      setLoadingEvent(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchLiveEvent = () => {
      axios.get('/api/event')
        .then((res) => {
          if (isMounted && res.data) {
            setEventData(res.data);
          }
        })
        .catch((error) => {
          console.warn('[EventContext] Using default event details due to API delay:', error.message);
        })
        .finally(() => {
          if (isMounted) setLoadingEvent(false);
        });
    };

    fetchLiveEvent();
    const interval = setInterval(fetchLiveEvent, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // On-Demand Real-Time Registration Status Check from MongoDB
  const checkLiveRegistrationOpen = async () => {
    const hasReservation = Boolean(activeReservation?.reservationId || localStorage.getItem('farm_fusion_active_reservation'));
    try {
      const res = await axios.get('/api/event', { timeout: 4000 });
      if (res.data) {
        setEventData(res.data);
        const isPortalOpen = res.data.isPortalOpen !== false;
        const isLimit = (res.data.registeredCount || 0) >= (res.data.maxTeams || 50);
        const isOpen = isPortalOpen && (!isLimit || hasReservation);
        return { isOpen, isLimit: isLimit && !hasReservation, isPortalOpen, data: res.data };
      }
    } catch (error) {
      console.warn('[EventContext] Live status check warning:', error.message);
    }
    const isPortalOpen = eventData.isPortalOpen !== false;
    const isLimit = (eventData.registeredCount || 0) >= (eventData.maxTeams || 50);
    const isOpen = isPortalOpen && (!isLimit || hasReservation);
    return { isOpen, isLimit: isLimit && !hasReservation, isPortalOpen, data: eventData };
  };

  // Active Reservation State Persistence
  useEffect(() => {
    if (activeReservation) {
      localStorage.setItem('farm_fusion_active_reservation', JSON.stringify(activeReservation));
    } else {
      localStorage.removeItem('farm_fusion_active_reservation');
    }
  }, [activeReservation]);

  // Verify active reservation status on mount / page reload & sync remaining time
  useEffect(() => {
    const verifyOnMount = async () => {
      const savedRes = localStorage.getItem('farm_fusion_active_reservation');
      if (!savedRes) return;
      try {
        const parsed = JSON.parse(savedRes);
        if (parsed?.reservationId) {
          const res = await axios.get(`/api/reservations/status/${parsed.reservationId}`);
          if (res.data.success && res.data.status === 'reserved' && res.data.remainingSeconds > 0) {
            setActiveReservation({
              ...parsed,
              expiresAt: res.data.expiresAt,
              remainingSeconds: res.data.remainingSeconds
            });
            setStep(3); // Stay on Payment Page
          } else {
            setActiveReservation(null);
            localStorage.removeItem('farm_fusion_active_reservation');
            setStep(1);
          }
        }
      } catch (e) {
        try {
          const parsed = JSON.parse(savedRes);
          if (parsed?.expiresAt && new Date(parsed.expiresAt) > new Date()) {
            setStep(3);
          } else {
            setActiveReservation(null);
            localStorage.removeItem('farm_fusion_active_reservation');
            setStep(1);
          }
        } catch (_e) {
          setActiveReservation(null);
          localStorage.removeItem('farm_fusion_active_reservation');
          setStep(1);
        }
      }
    };
    verifyOnMount();
  }, []);

  // Reserve a 5-minute temporary slot
  const reserveSlot = async (payloadData) => {
    try {
      const res = await axios.post('/api/reservations/reserve', payloadData);
      if (res.data.success) {
        const resInfo = {
          reservationId: res.data.reservationId,
          expiresAt: res.data.expiresAt,
          remainingSeconds: res.data.remainingSeconds || 300,
          teamName: payloadData.teamName
        };
        setActiveReservation(resInfo);
        fetchEventDetails(); // Instantly update global count
        return { success: true, data: resInfo };
      }
      return { success: false, message: res.data.message || 'Failed to reserve slot' };
    } catch (error) {
      const msg = error.response?.data?.message || 'Slot reservation failed';
      return { success: false, message: msg };
    }
  };

  // Release current active reservation slot
  const releaseSlot = async () => {
    if (activeReservation?.reservationId) {
      try {
        await axios.post('/api/reservations/release', { reservationId: activeReservation.reservationId });
      } catch (e) {}
    }
    setActiveReservation(null);
    localStorage.removeItem('farm_fusion_active_reservation');
    fetchEventDetails();
  };

  // Check reservation validity from backend
  const checkReservationStatus = async () => {
    if (!activeReservation?.reservationId) return { valid: false };
    try {
      const res = await axios.get(`/api/reservations/status/${activeReservation.reservationId}`);
      if (res.data.success && res.data.status === 'reserved') {
        const remaining = res.data.remainingSeconds;
        if (remaining <= 0) {
          releaseSlot();
          return { valid: false, message: 'Reservation has expired' };
        }
        return { valid: true, remainingSeconds: remaining, expiresAt: res.data.expiresAt };
      } else {
        releaseSlot();
        return { valid: false, message: res.data.message || 'Reservation expired' };
      }
    } catch (e) {
      releaseSlot();
      return { valid: false, message: 'Reservation invalid' };
    }
  };

  const resetRegistrationForm = () => {
    releaseSlot();
    localStorage.removeItem('farm_fusion_form_draft');
    setFormData({
      teamName: '',
      leader: { name: '', regNo: '', section: '', branch: '', phone: '', email: '', residenceType: '', hostelName: '', roomNumber: '' },
      members: [],
      transactionId: '',
      paymentScreenshot: null
    });
    setStep(1);
  };

  return (
    <EventContext.Provider value={{
      step,
      setStep,
      eventData,
      setEventData,
      fetchEventDetails,
      checkLiveRegistrationOpen,
      formData,
      setFormData,
      isAdminOpen,
      setIsAdminOpen,
      submittedRegistration,
      setSubmittedRegistration,
      resetRegistrationForm,
      loadingEvent,
      activeReservation,
      setActiveReservation,
      reserveSlot,
      releaseSlot,
      checkReservationStatus
    }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => useContext(EventContext);
