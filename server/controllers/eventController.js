import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Reservation } from '../models/Reservation.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

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
          qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis'
        },
        whatsapp: {
          group: '',
          discussion: '',
          channel: ''
        }
      });
    }

    const confirmedCount = await Registration.countDocuments();
    const activeReservedCount = await Reservation.countDocuments({
      status: 'reserved',
      expiresAt: { $gt: new Date() }
    });
    const registeredCount = confirmedCount + activeReservedCount;
    const maxTeams = event.maxTeams || 50;
    const progressPercent = Math.min(Math.round((registeredCount / maxTeams) * 100), 100);

    let currentQrImage = event.payment?.qrImage;
    if (!currentQrImage || currentQrImage.startsWith('/uploads')) {
      currentQrImage = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis';
    }

    const paymentObj = {
      upiId: event.payment?.upiId || 'farmfusionai@okaxis',
      amount: event.payment?.amount !== undefined ? event.payment.amount : 499,
      accountHolder: event.payment?.accountHolder || 'FarmFusion Org',
      qrImage: currentQrImage
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
      isPortalOpen: event.registrationOpen !== false,
      registrationOpen: event.registrationOpen !== false && registeredCount < maxTeams,
      registrationProgress: progressPercent,
      minMembers: event.minMembers || 2,
      maxMembers: event.maxMembers || 4,
      maxTeams: maxTeams,
      registeredCount: registeredCount,
      confirmedCount: confirmedCount,
      activeReservedCount: activeReservedCount,
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
        qrImage: event.payment?.qrImage || 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=farmfusionai@okaxis'
      };

      if (req.file) {
        console.log('[Admin Event] Uploading new QR image to Cloudinary...');
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
        event.payment.qrImage = cloudinaryResult?.secure_url || cloudinaryResult?.url;
        console.log('[Admin Event] Cloudinary QR URL generated:', event.payment.qrImage);
      } else if (parsedPayment.qrImage && !parsedPayment.qrImage.startsWith('/uploads')) {
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
