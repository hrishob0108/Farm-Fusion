import { Reservation } from '../models/Reservation.js';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';

// POST /api/reservations/reserve - Reserve a 5-minute temporary slot
export const createReservation = async (req, res, next) => {
  try {
    const event = await Event.findOne().lean();
    if (event && event.registrationOpen === false) {
      return res.status(400).json({
        success: false,
        message: 'Registrations are currently CLOSED by the event organizers.'
      });
    }

    const maxTeams = event?.maxTeams || 50;
    const now = new Date();

    // Clean up expired reservations helper query
    const activeReservedCount = await Reservation.countDocuments({
      status: 'reserved',
      expiresAt: { $gt: now }
    });
    const confirmedCount = await Registration.countDocuments();
    const totalOccupied = confirmedCount + activeReservedCount;

    if (totalOccupied >= maxTeams) {
      return res.status(400).json({
        success: false,
        message: `Registration capacity limit of ${maxTeams} teams has been reached.`
      });
    }

    const { teamName } = req.body;
    let leader = req.body.leader;
    let members = req.body.members || [];

    if (typeof leader === 'string') {
      try { leader = JSON.parse(leader); } catch (e) { return res.status(400).json({ success: false, message: 'Invalid leader details format' }); }
    }
    if (typeof members === 'string') {
      try { members = JSON.parse(members); } catch (e) { members = []; }
    }

    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ success: false, message: 'Team Name is required' });
    }
    if (!leader || !leader.name || !leader.name.trim()) {
      return res.status(400).json({ success: false, message: 'Team Leader Name is required' });
    }

    // Phone validation
    const allPhones = [leader?.phone, ...members.map(m => m?.phone)].filter(Boolean);
    const invalidPhone = allPhones.find(p => typeof p !== 'string' || p.replace(/\D/g, '').length !== 10);
    if (invalidPhone) {
      return res.status(400).json({ success: false, message: 'All phone numbers must be exactly 10 digits.' });
    }

    // Registration Number validation (must contain only numbers)
    const allRegNoInputs = [leader?.regNo, ...members.map(m => m?.regNo)].filter(Boolean);
    const invalidRegNo = allRegNoInputs.find(r => typeof r !== 'string' || !/^\d+$/.test(r.trim()));
    if (invalidRegNo) {
      return res.status(400).json({ success: false, message: 'All Registration Numbers must contain only numbers.' });
    }

    // Residency validation for Leader
    if (!leader.residenceType || !['Hosteller', 'Day Scholar'].includes(leader.residenceType)) {
      return res.status(400).json({ success: false, message: 'Residency status (Hosteller or Day Scholar) is required for Team Leader.' });
    }
    if (leader.residenceType === 'Hosteller') {
      if (!leader.hostelName || !leader.hostelName.trim() || !leader.roomNumber || !leader.roomNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Hostel Name and Room Number are required for Team Leader when Hosteller is selected.' });
      }
    } else {
      leader.hostelName = '';
      leader.roomNumber = '';
    }

    // Residency validation for Members
    if (Array.isArray(members)) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (m && (m.name || m.regNo || m.phone || m.section || m.branch || m.residenceType)) {
          if (!m.residenceType || !['Hosteller', 'Day Scholar'].includes(m.residenceType)) {
            return res.status(400).json({ success: false, message: `Residency status (Hosteller or Day Scholar) is required for Member ${i + 2}.` });
          }
          if (m.residenceType === 'Hosteller') {
            if (!m.hostelName || !m.hostelName.trim() || !m.roomNumber || !m.roomNumber.trim()) {
              return res.status(400).json({ success: false, message: `Hostel Name and Room Number are required for Member ${i + 2} when Hosteller is selected.` });
            }
          } else {
            m.hostelName = '';
            m.roomNumber = '';
          }
        }
      }
    }

    // Auto-generate @klu.ac.in emails
    if (leader && leader.regNo) {
      leader.email = `${leader.regNo.trim()}@klu.ac.in`;
    }
    if (Array.isArray(members)) {
      members = members.map(m => ({
        ...m,
        email: m.regNo ? `${m.regNo.trim()}@klu.ac.in` : m.email
      }));
    }

    const trimmedTeamName = teamName.trim();

    // Check duplicate Team Name in confirmed registrations
    const existingConfirmedTeam = await Registration.findOne({ teamName: new RegExp(`^${trimmedTeamName}$`, 'i') });
    if (existingConfirmedTeam) {
      console.warn(`[Reservation 400] Team Name "${trimmedTeamName}" is already registered`);
      return res.status(400).json({ success: false, message: `Team Name "${trimmedTeamName}" is already registered.` });
    }

    // Duplicate check for Registration Numbers in confirmed registrations
    const allRegNos = [leader?.regNo, ...members.map(m => m?.regNo)]
      .filter(val => val && typeof val === 'string' && val.trim().length > 0);

    if (allRegNos.length > 0) {
      const existingConfirmedRegNo = await Registration.findOne({
        $or: [
          { 'leader.regNo': { $in: allRegNos } },
          { 'members.regNo': { $in: allRegNos } }
        ]
      });
      if (existingConfirmedRegNo) {
        console.warn(`[Reservation 400] One or more RegNos are already registered:`, allRegNos);
        return res.status(400).json({ success: false, message: 'One or more Registration Numbers are already registered.' });
      }
    }

    // Cancel any previous active temporary reservations for the same team name or leader regNo (allows re-submission by same user)
    await Reservation.updateMany(
      {
        status: 'reserved',
        $or: [
          { teamName: new RegExp(`^${trimmedTeamName}$`, 'i') },
          ...(leader?.regNo ? [{ 'leader.regNo': leader.regNo.trim() }] : [])
        ]
      },
      { $set: { status: 'cancelled' } }
    );

    // Create 5-minute reservation
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Exactly 5 Minutes

    const newReservation = new Reservation({
      reservationId,
      teamName: trimmedTeamName,
      leader,
      members,
      status: 'reserved',
      reservedAt: now,
      expiresAt
    });

    await newReservation.save();

    // Post-save Race Condition Check (Atomic concurrency verification)
    const confirmedCountAfter = await Registration.countDocuments();
    const availableSlots = Math.max(0, maxTeams - confirmedCountAfter);

    const activeReservations = await Reservation.find({
      status: 'reserved',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: 1, _id: 1 }).lean();

    const reservationIndex = activeReservations.findIndex(
      r => r._id.toString() === newReservation._id.toString()
    );

    if (reservationIndex === -1 || reservationIndex >= availableSlots) {
      console.warn(`[Reservation Concurrency Blocked] Capacity reached during simultaneous request. Cancelling reservation ${reservationId}`);
      await Reservation.deleteOne({ _id: newReservation._id });
      return res.status(400).json({
        success: false,
        message: `Registration capacity limit of ${maxTeams} teams has been reached.`
      });
    }

    console.log(`[Reservation Created] ID: ${reservationId} | Team: ${trimmedTeamName} | Expires: ${expiresAt.toISOString()}`);

    res.status(201).json({
      success: true,
      message: 'Slot temporarily reserved for 5 minutes!',
      reservationId,
      expiresAt,
      remainingSeconds: 300,
      reservation: newReservation
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reservations/status/:reservationId - Get live status of reservation
export const getReservationStatus = async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const reservation = await Reservation.findOne({ reservationId });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        status: 'expired',
        message: 'Reservation not found or expired'
      });
    }

    const now = new Date();
    if (reservation.status === 'reserved' && reservation.expiresAt <= now) {
      reservation.status = 'expired';
      await reservation.save();
      return res.json({
        success: false,
        status: 'expired',
        message: 'Your reservation has expired.'
      });
    }

    const remainingSeconds = Math.max(0, Math.floor((new Date(reservation.expiresAt) - now) / 1000));

    res.json({
      success: true,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      remainingSeconds,
      reservation
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/reservations/release - Cancel/release temporary reservation slot
export const releaseReservation = async (req, res, next) => {
  try {
    const { reservationId } = req.body;
    if (reservationId) {
      await Reservation.updateOne(
        { reservationId, status: 'reserved' },
        { $set: { status: 'cancelled' } }
      );
    }
    res.json({
      success: true,
      message: 'Reservation released successfully'
    });
  } catch (error) {
    next(error);
  }
};
