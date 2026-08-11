import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { Reservation } from '../models/Reservation.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { sendPaymentStatusEmail, sendTeamVerificationEmail } from '../services/emailService.js';

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

    const { teamName, transactionId, reservationId } = req.body;

    // Validate 5-minute temporary reservation token if provided
    let activeReservation = null;
    if (reservationId) {
      activeReservation = await Reservation.findOne({ reservationId, status: 'reserved' });
      if (!activeReservation || activeReservation.expiresAt <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Your 5-minute reservation slot has expired. Please fill out the registration form again to reserve a new slot.'
        });
      }
    }

    const activeReservedCount = await Reservation.countDocuments({
      status: 'reserved',
      expiresAt: { $gt: new Date() }
    });
    const confirmedCount = await Registration.countDocuments();
    const totalOccupied = confirmedCount + activeReservedCount;
    const maxTeams = event?.maxTeams || 50;

    if (!activeReservation && totalOccupied >= maxTeams) {
      console.warn(`[Registration Error] Registration capacity reached (${totalOccupied}/${maxTeams})`);
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
    if (transactionId.includes('@')) {
      return res.status(400).json({ success: false, message: 'Transaction ID / UTR number cannot contain "@" symbol.' });
    }

    // Backend phone number validation (must be exactly 10 digits)
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

    // Post-save Race Condition Verification for non-reserved registrations
    if (!activeReservation) {
      const finalConfirmed = await Registration.countDocuments();
      const finalReserved = await Reservation.countDocuments({
        status: 'reserved',
        expiresAt: { $gt: new Date() }
      });
      if ((finalConfirmed + finalReserved) > maxTeams) {
        console.warn(`[Registration Concurrency Blocked] Capacity exceeded on direct registration. Deleting record ${createdRecord._id}`);
        await Registration.deleteOne({ _id: createdRecord._id });
        return res.status(400).json({
          success: false,
          message: `Registration capacity limit of ${maxTeams} teams has been reached.`
        });
      }
    }

    // Mark temporary reservation as confirmed
    if (activeReservation) {
      activeReservation.status = 'confirmed';
      await activeReservation.save();
    }

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

    // Trigger email notification asynchronously to team leader + all team mates
    sendPaymentStatusEmail(updatedRecord, paymentStatus, rejectionReason || '')
      .then(result => {
        console.log(`[AdminController] Payment status email triggered for Team "${updatedRecord.teamName}":`, result);
      })
      .catch(err => {
        console.error(`[AdminController] Error sending payment status email:`, err.message);
      });

    res.json({
      success: true,
      message: `Payment status updated to "${paymentStatus}". Email notification dispatched to team.`,
      registration: updatedRecord
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/resend-email - Manually resends verification email to team leader and teammates
export const resendVerificationEmail = async (req, res, next) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Registration ID is required' });
    }

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration record not found' });
    }

    const emailResult = await sendTeamVerificationEmail(registration);

    if (emailResult.success) {
      return res.json({
        success: true,
        message: `Verification email successfully sent to Team "${registration.teamName}" leader and team mates!`,
        provider: emailResult.provider
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Failed to send email: ${emailResult.error || 'Unknown error'}`
      });
    }
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

// POST /api/admin/bulk-push - Bulk push/import team registrations JSON into MongoDB
export const bulkPushRegistrations = async (req, res, next) => {
  try {
    const rawData = req.body;
    let items = [];

    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === 'object') {
      items = rawData.registrations || rawData.teams || rawData.data || [rawData];
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid JSON registration records provided.'
      });
    }

    // Helper: Normalize flat participant objects OR structured team objects
    const normalizeTeams = (rawItems) => {
      const isStructured = rawItems.some(i => i && typeof i === 'object' && (i.leader || i.teamLeader));

      if (isStructured) {
        return rawItems.map(i => {
          const leaderObj = i.leader || i.teamLeader || {};
          const membersArr = Array.isArray(i.members) ? i.members : [];

          const leaderRegNo = String(leaderObj.regNo || leaderObj.regno || leaderObj['Reg No'] || '').trim();
          const leaderEmail = leaderObj.email || (leaderRegNo ? `${leaderRegNo}@klu.ac.in` : '');

          return {
            teamName: String(i.teamName || i['Team Name'] || '').trim(),
            transactionId: String(i.transactionId || i.txnId || i['Transaction ID'] || i.utr || '').trim(),
            paymentScreenshot: String(i.paymentScreenshot || i.paymentScreenshotLink || i.paymentScreenshotUrl || i['Payment Screenshot Link'] || '').trim() || 'https://via.placeholder.com/600x400.png?text=Bulk+Imported+Payment+Receipt',
            paymentStatus: i.paymentStatus || i['Payment Status'] || 'Pending',
            rejectionReason: i.rejectionReason || '',
            leader: {
              name: String(leaderObj.name || leaderObj['Name'] || '').trim(),
              regNo: leaderRegNo,
              email: leaderEmail,
              phone: String(leaderObj.phone || leaderObj['Phone Number'] || '').trim(),
              section: String(leaderObj.section || leaderObj['Section'] || '').trim(),
              branch: String(leaderObj.branch || leaderObj['Branch'] || '').trim(),
              residenceType: leaderObj.residenceType || leaderObj['Residency Status'] || 'Day Scholar',
              hostelName: String(leaderObj.hostelName || leaderObj['Hostel Name'] || '').trim(),
              roomNumber: String(leaderObj.roomNumber || leaderObj['Room Number'] || '').trim()
            },
            members: membersArr.map(m => {
              const mRegNo = String(m.regNo || m.regno || m['Reg No'] || '').trim();
              return {
                name: String(m.name || m['Name'] || '').trim(),
                regNo: mRegNo,
                email: m.email || (mRegNo ? `${mRegNo}@klu.ac.in` : ''),
                phone: String(m.phone || m['Phone Number'] || '').trim(),
                section: String(m.section || m['Section'] || '').trim(),
                branch: String(m.branch || m['Branch'] || '').trim(),
                residenceType: m.residenceType || m['Residency Status'] || 'Day Scholar',
                hostelName: String(m.hostelName || m['Hostel Name'] || '').trim(),
                roomNumber: String(m.roomNumber || m['Room Number'] || '').trim()
              };
            })
          };
        });
      }

      // Group flat participant rows by teamName / transactionId
      const teamGroups = new Map();
      for (const row of rawItems) {
        if (!row || typeof row !== 'object') continue;
        const teamKey = String(row.teamName || row['Team Name'] || row.transactionId || row['Transaction ID'] || 'UNNAMED').trim();
        if (!teamGroups.has(teamKey)) {
          teamGroups.set(teamKey, []);
        }
        teamGroups.get(teamKey).push(row);
      }

      const teams = [];
      for (const [teamKey, rows] of teamGroups.entries()) {
        if (rows.length === 0) continue;
        let leaderIndex = rows.findIndex(r => String(r.role || '').toLowerCase().includes('leader'));
        if (leaderIndex === -1) leaderIndex = 0;

        const leaderRow = rows[leaderIndex];
        const memberRows = rows.filter((_, idx) => idx !== leaderIndex);

        const leaderRegNo = String(leaderRow.regNo || leaderRow.regno || leaderRow['Reg No'] || '').trim();
        const leaderObj = {
          name: String(leaderRow.name || leaderRow['Name'] || '').trim(),
          regNo: leaderRegNo,
          email: leaderRow.email || (leaderRegNo ? `${leaderRegNo}@klu.ac.in` : ''),
          phone: String(leaderRow.phone || leaderRow['Phone Number'] || '').trim(),
          section: String(leaderRow.section || leaderRow['Section'] || '').trim(),
          branch: String(leaderRow.branch || leaderRow['Branch'] || '').trim(),
          residenceType: leaderRow.residenceType || leaderRow['Residency Status'] || 'Day Scholar',
          hostelName: String(leaderRow.hostelName || leaderRow['Hostel Name'] || '').trim(),
          roomNumber: String(leaderRow.roomNumber || leaderRow['Room Number'] || '').trim()
        };

        const membersObj = memberRows.map(m => {
          const mRegNo = String(m.regNo || m.regno || m['Reg No'] || '').trim();
          return {
            name: String(m.name || m['Name'] || '').trim(),
            regNo: mRegNo,
            email: m.email || (mRegNo ? `${mRegNo}@klu.ac.in` : ''),
            phone: String(m.phone || m['Phone Number'] || '').trim(),
            section: String(m.section || m['Section'] || '').trim(),
            branch: String(m.branch || m['Branch'] || '').trim(),
            residenceType: m.residenceType || m['Residency Status'] || 'Day Scholar',
            hostelName: String(m.hostelName || m['Hostel Name'] || '').trim(),
            roomNumber: String(m.roomNumber || m['Room Number'] || '').trim()
          };
        });

        const screenshotLink = leaderRow.paymentScreenshot || leaderRow.paymentScreenshotLink || leaderRow.paymentScreenshotUrl || leaderRow['Payment Screenshot Link'] || 'https://via.placeholder.com/600x400.png?text=Bulk+Imported+Payment+Receipt';

        teams.push({
          teamName: String(leaderRow.teamName || leaderRow['Team Name'] || teamKey).trim(),
          transactionId: String(leaderRow.transactionId || leaderRow.txnId || leaderRow['Transaction ID'] || `BULK_${Date.now()}_${Math.floor(Math.random()*1000)}`).trim(),
          paymentScreenshot: String(screenshotLink).trim(),
          paymentStatus: leaderRow.paymentStatus || leaderRow['Payment Status'] || 'Pending',
          rejectionReason: leaderRow.rejectionReason || '',
          leader: leaderObj,
          members: membersObj
        });
      }

      return teams;
    };

    const candidates = normalizeTeams(items);
    if (candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract valid team registrations from JSON input.'
      });
    }

    const inserted = [];
    const skipped = [];

    // Process candidates sequentially with duplicate checks
    for (let i = 0; i < candidates.length; i++) {
      const team = candidates[i];

      // Basic validation
      if (!team.teamName) {
        skipped.push({ teamName: `Item #${i+1}`, reason: 'Missing teamName' });
        continue;
      }
      if (!team.transactionId) {
        skipped.push({ teamName: team.teamName, reason: 'Missing transactionId' });
        continue;
      }
      if (!team.leader || !team.leader.name || !team.leader.regNo) {
        skipped.push({ teamName: team.teamName, reason: 'Missing Team Leader name or regNo' });
        continue;
      }

      // Check duplicates in DB
      const existingTeam = await Registration.findOne({ teamName: new RegExp(`^${team.teamName}$`, 'i') });
      if (existingTeam) {
        skipped.push({ teamName: team.teamName, reason: `Team Name "${team.teamName}" already exists` });
        continue;
      }

      const existingTxn = await Registration.findOne({ transactionId: new RegExp(`^${team.transactionId}$`, 'i') });
      if (existingTxn) {
        skipped.push({ teamName: team.teamName, reason: `Transaction ID "${team.transactionId}" already exists` });
        continue;
      }

      const teamRegNos = [team.leader.regNo, ...team.members.map(m => m.regNo)].filter(Boolean);
      if (teamRegNos.length > 0) {
        const existingRegNo = await Registration.findOne({
          $or: [
            { 'leader.regNo': { $in: teamRegNos } },
            { 'members.regNo': { $in: teamRegNos } }
          ]
        });
        if (existingRegNo) {
          skipped.push({ teamName: team.teamName, reason: `One or more Reg Nos already registered (${teamRegNos.join(', ')})` });
          continue;
        }
      }

      // Allowed payment statuses: 'Pending', 'Verified', 'Rejected', 'Resubmit Requested'
      const validStatuses = ['Pending', 'Verified', 'Rejected', 'Resubmit Requested'];
      if (!validStatuses.includes(team.paymentStatus)) {
        team.paymentStatus = 'Pending';
      }

      const newRegistration = new Registration({
        teamName: team.teamName,
        leader: team.leader,
        members: team.members,
        transactionId: team.transactionId,
        paymentScreenshot: team.paymentScreenshot,
        paymentStatus: team.paymentStatus,
        rejectionReason: team.rejectionReason || ''
      });

      const saved = await newRegistration.save();
      inserted.push(saved);
    }

    // Update Event capacity progress stats
    if (inserted.length > 0) {
      try {
        const totalCount = await Registration.countDocuments();
        const currentEvent = await Event.findOne();
        if (currentEvent) {
          const capacity = currentEvent.maxTeams || 50;
          currentEvent.registrationProgress = Math.min(Math.round((totalCount / capacity) * 100), 100);
          await currentEvent.save();
        }
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: `Bulk push completed! ${inserted.length} team(s) imported successfully, ${skipped.length} skipped.`,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      inserted,
      skipped
    });

  } catch (error) {
    console.error('[Bulk Push Error]:', error);
    next(error);
  }
};

// PUT /api/admin/registration/:id - Updates team registration data (team, leader, members, paymentScreenshot file/link, status)
export const updateRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Registration ID is required' });
    }

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration record not found' });
    }

    const {
      teamName,
      transactionId,
      paymentStatus,
      rejectionReason,
      paymentScreenshotUrl
    } = req.body;

    let leader = req.body.leader;
    let members = req.body.members || [];

    if (typeof leader === 'string') {
      try { leader = JSON.parse(leader); } catch (e) {}
    }
    if (typeof members === 'string') {
      try { members = JSON.parse(members); } catch (e) { members = []; }
    }

    // Handle payment screenshot: If new file uploaded, upload to Cloudinary
    if (req.file) {
      console.log('[UpdateRegistration] Uploading new payment screenshot to Cloudinary...');
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
      registration.paymentScreenshot = cloudinaryResult?.secure_url || cloudinaryResult?.url || registration.paymentScreenshot;
    } else if (paymentScreenshotUrl && paymentScreenshotUrl.trim()) {
      registration.paymentScreenshot = paymentScreenshotUrl.trim();
    }

    if (teamName && teamName.trim()) {
      registration.teamName = teamName.trim();
    }
    if (transactionId && transactionId.trim()) {
      registration.transactionId = transactionId.trim();
    }
    if (paymentStatus) {
      registration.paymentStatus = paymentStatus;
    }
    if (rejectionReason !== undefined) {
      registration.rejectionReason = rejectionReason;
    }

    // Update Leader
    if (leader && typeof leader === 'object') {
      const leaderRegNo = String(leader.regNo || registration.leader.regNo || '').trim();
      registration.leader = {
        name: String(leader.name || registration.leader.name || '').trim(),
        regNo: leaderRegNo,
        email: leader.email || (leaderRegNo ? `${leaderRegNo}@klu.ac.in` : registration.leader.email),
        phone: String(leader.phone || registration.leader.phone || '').trim(),
        section: String(leader.section || registration.leader.section || '').trim(),
        branch: String(leader.branch || registration.leader.branch || '').trim(),
        residenceType: leader.residenceType || registration.leader.residenceType || 'Day Scholar',
        hostelName: String(leader.hostelName !== undefined ? leader.hostelName : registration.leader.hostelName).trim(),
        roomNumber: String(leader.roomNumber !== undefined ? leader.roomNumber : registration.leader.roomNumber).trim()
      };
    }

    // Update Members
    if (Array.isArray(members)) {
      registration.members = members.map(m => {
        const mRegNo = String(m.regNo || '').trim();
        return {
          name: String(m.name || '').trim(),
          regNo: mRegNo,
          email: m.email || (mRegNo ? `${mRegNo}@klu.ac.in` : ''),
          phone: String(m.phone || '').trim(),
          section: String(m.section || '').trim(),
          branch: String(m.branch || '').trim(),
          residenceType: m.residenceType || 'Day Scholar',
          hostelName: String(m.hostelName || '').trim(),
          roomNumber: String(m.roomNumber || '').trim()
        };
      });
    }

    const updated = await registration.save();

    res.json({
      success: true,
      message: `Team "${updated.teamName}" details updated successfully!`,
      registration: updated
    });
  } catch (error) {
    console.error('[UpdateRegistration Catch Error]:', error);
    next(error);
  }
};


