import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const EventContext = createContext();

export const EventProvider = ({ children }) => {
  const [step, setStep] = useState(1); // 1: Home, 2: Registration, 3: Payment, 4: Success
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
      leader: { name: '', regNo: '', section: '', branch: '', phone: '', email: '' },
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

    return () => {
      isMounted = false;
    };
  }, []);

  const resetRegistrationForm = () => {
    localStorage.removeItem('farm_fusion_form_draft');
    setFormData({
      teamName: '',
      leader: { name: '', regNo: '', section: '', branch: '', phone: '', email: '' },
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
      formData,
      setFormData,
      isAdminOpen,
      setIsAdminOpen,
      submittedRegistration,
      setSubmittedRegistration,
      resetRegistrationForm,
      loadingEvent
    }}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => useContext(EventContext);
