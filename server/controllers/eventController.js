import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';

// GET /api/event - Fetches live event configuration strictly from MongoDB
export const getEventDetails = async (req, res, next) => {
  try {
    let event = await Event.findOne();

    if (!event) {
      event = await Event.create({
        eventName: 'FarmFusion',
        tagline: 'Where AI Meets Agriculture',
        eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        registrationOpen: true,
        minMembers: 2,
        maxMembers: 4,
        maxTeams: 50,
        payment: {
          upiId: 'farmfusionai@okaxis',
          amount: 499,
          accountHolder: 'FarmFusion Org',
          qrImage: '/uploads/default-qr.png'
        },
        whatsapp: {
          group: '',
          discussion: '',
          channel: ''
        }
      });
    }

    const registeredCount = await Registration.countDocuments();
    const maxTeams = event.maxTeams || 50;
    const progressPercent = Math.min(Math.round((registeredCount / maxTeams) * 100), 100);

    const paymentObj = {
      upiId: event.payment?.upiId || 'farmfusionai@okaxis',
      amount: event.payment?.amount !== undefined ? event.payment.amount : 499,
      accountHolder: event.payment?.accountHolder || 'FarmFusion Org',
      qrImage: event.payment?.qrImage || '/uploads/default-qr.png'
    };

    const whatsappObj = {
      group: event.whatsapp?.group || '',
      discussion: event.whatsapp?.discussion || '',
      channel: event.whatsapp?.channel || ''
    };

    res.json({
      eventName: event.eventName,
      tagline: event.tagline,
      eventDate: event.eventDate,
      registrationOpen: event.registrationOpen && registeredCount < maxTeams,
      registrationProgress: progressPercent,
      minMembers: event.minMembers || 2,
      maxMembers: event.maxMembers || 4,
      maxTeams: maxTeams,
      registeredCount: registeredCount,
      payment: paymentObj,
      whatsapp: whatsappObj
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/event - Updates live event configuration strictly in MongoDB
export const updateEventDetails = async (req, res, next) => {
  try {
    let event = await Event.findOne();
    if (!event) {
      event = new Event({});
    }

    const { eventName, tagline, eventDate, registrationOpen, minMembers, maxMembers, maxTeams } = req.body;

    if (eventName) event.eventName = eventName;
    if (tagline !== undefined) event.tagline = tagline;
    if (eventDate) event.eventDate = new Date(eventDate);
    if (registrationOpen !== undefined) {
      event.registrationOpen = registrationOpen === true || registrationOpen === 'true';
    }
    if (minMembers !== undefined) event.minMembers = Number(minMembers);
    if (maxMembers !== undefined) event.maxMembers = Number(maxMembers);
    if (maxTeams !== undefined) event.maxTeams = Number(maxTeams);

    // Parse payment object if sent as JSON string (FormData) or object
    let parsedPayment = req.body.payment;
    if (typeof parsedPayment === 'string') {
      try { parsedPayment = JSON.parse(parsedPayment); } catch (e) { parsedPayment = {}; }
    }

    // Parse whatsapp object if sent as JSON string or object
    let parsedWhatsapp = req.body.whatsapp;
    if (typeof parsedWhatsapp === 'string') {
      try { parsedWhatsapp = JSON.parse(parsedWhatsapp); } catch (e) { parsedWhatsapp = {}; }
    }

    if (parsedPayment) {
      event.payment = {
        upiId: parsedPayment.upiId !== undefined ? parsedPayment.upiId : (event.payment?.upiId || 'farmfusionai@okaxis'),
        amount: parsedPayment.amount !== undefined ? Number(parsedPayment.amount) : (event.payment?.amount || 499),
        accountHolder: parsedPayment.accountHolder !== undefined ? parsedPayment.accountHolder : (event.payment?.accountHolder || 'FarmFusion Org'),
        qrImage: event.payment?.qrImage || '/uploads/default-qr.png'
      };

      if (req.file) {
        event.payment.qrImage = `/uploads/${req.file.filename}`;
      } else if (parsedPayment.qrImage) {
        event.payment.qrImage = parsedPayment.qrImage;
      }

      event.markModified('payment');
    }

    if (parsedWhatsapp) {
      event.whatsapp = {
        group: parsedWhatsapp.group !== undefined ? parsedWhatsapp.group : (event.whatsapp?.group || ''),
        discussion: parsedWhatsapp.discussion !== undefined ? parsedWhatsapp.discussion : (event.whatsapp?.discussion || ''),
        channel: parsedWhatsapp.channel !== undefined ? parsedWhatsapp.channel : (event.whatsapp?.channel || '')
      };
      event.markModified('whatsapp');
    }

    const savedEvent = await event.save();
    console.log('[Admin Update] Event payment settings saved in MongoDB:', savedEvent.payment);

    res.json({
      success: true,
      message: 'Event settings updated successfully in database',
      event: savedEvent
    });
  } catch (error) {
    next(error);
  }
};
