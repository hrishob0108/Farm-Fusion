import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

// POST /api/register - Creates team registration strictly in MongoDB
export const createRegistration = async (req, res, next) => {
  try {
    // Strict Backend Registration Status Check
    const event = await Event.findOne().lean();
    if (event && event.registrationOpen === false) {
      console.warn('[Registration Error] Attempted registration while portal is CLOSED');
      return res.status(400).json({
        success: false,
        message: 'Registrations are currently CLOSED by the event organizers.'
      });
    }

    const totalRegisteredCount = await Registration.countDocuments();
    const maxTeams = event?.maxTeams || 50;
    if (totalRegisteredCount >= maxTeams) {
      console.warn(`[Registration Error] Registration capacity reached (${totalRegisteredCount}/${maxTeams})`);
      return res.status(400).json({
        success: false,
        message: `Registration capacity limit of ${maxTeams} teams has been reached.`
      });
    }

    if (req.fileValidationError) {
      console.warn('[Registration Error] File validation:', req.fileValidationError);
      return res.status(400).json({ success: false, message: req.fileValidationError });
    }

    if (!req.file) {
      console.warn('[Registration Error] Missing screenshot file');
      return res.status(400).json({ success: false, message: 'Payment screenshot image/file is required' });
    }

    const { teamName, transactionId } = req.body;
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
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    // Auto-generate @klu.ac.in email from regNo
    if (leader && leader.regNo) {
      leader.email = `${leader.regNo.trim()}@klu.ac.in`;
    }
    if (Array.isArray(members)) {
      members = members.map(m => ({
        ...m,
        email: m.regNo ? `${m.regNo.trim()}@klu.ac.in` : m.email
      }));
    }

    // Duplicate check for Transaction ID
    const existingTxn = await Registration.findOne({ transactionId: new RegExp(`^${transactionId.trim()}$`, 'i') });
    if (existingTxn) {
      console.warn(`[Registration Error] Duplicate Transaction ID: ${transactionId}`);
      return res.status(400).json({ success: false, message: `Transaction ID "${transactionId}" has already been submitted.` });
    }

    // Filter out empty or whitespace-only registration numbers
    const allRegNos = [leader?.regNo, ...members.map(m => m?.regNo)]
      .filter(val => val && typeof val === 'string' && val.trim().length > 0);

    // Duplicate check for Team Name
    const existingTeam = await Registration.findOne({ teamName: new RegExp(`^${teamName.trim()}$`, 'i') });
    if (existingTeam) {
      console.warn(`[Registration Error] Duplicate Team Name: ${teamName}`);
      return res.status(400).json({ success: false, message: `Team Name "${teamName}" is already registered.` });
    }

    // Duplicate check for Non-Empty Registration Numbers
    if (allRegNos.length > 0) {
      const existingRegNo = await Registration.findOne({
        $or: [
          { 'leader.regNo': { $in: allRegNos } },
          { 'members.regNo': { $in: allRegNos } }
        ]
      });

      if (existingRegNo) {
        console.warn(`[Registration Error] Duplicate RegNo found among:`, allRegNos);
        return res.status(400).json({ success: false, message: 'One or more Registration Numbers are already registered.' });
      }
    }

    // Upload Payment Screenshot directly to Cloudinary
    console.log('[Registration] Uploading payment screenshot to Cloudinary...');
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
    const paymentScreenshot = cloudinaryResult?.secure_url || cloudinaryResult?.url;
    console.log('[Registration] Cloudinary URL generated:', paymentScreenshot);

    // Save to MongoDB
    const registration = new Registration({
      teamName: teamName.trim(),
      leader,
      members,
      transactionId: transactionId.trim(),
      paymentScreenshot,
      paymentStatus: 'Pending'
    });

    const createdRecord = await registration.save();

    // Increment registration count in Event model
    try {
      const updatedTotalCount = await Registration.countDocuments();
      const currentEvent = await Event.findOne();
      if (currentEvent) {
        const capacity = currentEvent.maxTeams || 50;
        currentEvent.registrationProgress = Math.min(Math.round((updatedTotalCount / capacity) * 100), 100);
        await currentEvent.save();
      }
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully!',
      registration: createdRecord
    });
  } catch (error) {
    console.error('[Registration Catch Error]:', error);
    next(error);
  }
};

// GET /api/admin/registrations - Fetches registrations list strictly from MongoDB
export const getRegistrations = async (req, res, next) => {
  try {
    const { search = '', status = 'All' } = req.query;

    let query = {};
    if (status && status !== 'All') {
      query.paymentStatus = status;
    }
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { teamName: regex },
        { 'leader.name': regex },
        { 'leader.regNo': regex },
        { 'leader.email': regex },
        { transactionId: regex }
      ];
    }

    const items = await Registration.find(query).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      total: items.length,
      registrations: items
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/payment-status - Updates registration payment status strictly in MongoDB
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id, paymentStatus, rejectionReason } = req.body;

    if (!id || !paymentStatus) {
      return res.status(400).json({ success: false, message: 'Registration ID and paymentStatus are required' });
    }

    const updatedRecord = await Registration.findByIdAndUpdate(
      id,
      { paymentStatus, rejectionReason: rejectionReason || '' },
      { new: true }
    );

    if (!updatedRecord) {
      return res.status(404).json({ success: false, message: 'Registration record not found in database' });
    }

    res.json({
      success: true,
      message: `Payment status updated to "${paymentStatus}"`,
      registration: updatedRecord
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/registration/:id - Deletes registration record strictly from MongoDB
export const deleteRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Registration.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Registration record not found' });
    }

    res.json({
      success: true,
      message: 'Registration deleted successfully from database'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/check-duplicate - Checks for duplicates strictly in MongoDB
export const checkDuplicate = async (req, res, next) => {
  try {
    const { teamName, transactionId, regNos = [] } = req.body;
    let duplicateField = null;

    if (transactionId && transactionId.trim().length >= 4) {
      const txnMatch = await Registration.findOne({ transactionId: new RegExp(`^${transactionId.trim()}$`, 'i') });
      if (txnMatch) duplicateField = 'transactionId';
    }

    if (!duplicateField && teamName) {
      const teamMatch = await Registration.findOne({ teamName: new RegExp(`^${teamName.trim()}$`, 'i') });
      if (teamMatch) duplicateField = 'teamName';
    }

    const validRegNos = regNos.filter(val => val && typeof val === 'string' && val.trim().length > 0);

    if (!duplicateField && validRegNos.length > 0) {
      const regNoMatch = await Registration.findOne({
        $or: [
          { 'leader.regNo': { $in: validRegNos } },
          { 'members.regNo': { $in: validRegNos } }
        ]
      });
      if (regNoMatch) duplicateField = 'regNo';
    }

    res.json({
      isDuplicate: !!duplicateField,
      duplicateField
    });
  } catch (error) {
    next(error);
  }
};
