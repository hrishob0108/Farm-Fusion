import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Reservation } from '../models/Reservation.js';
import { Registration } from '../models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const escapeCsv = (str) => {
  if (str === null || str === undefined) return '""';
  const val = String(str).replace(/"/g, '""');
  return `"${val}"`;
};

async function exportCsv() {
  try {
    console.log('Connecting to MongoDB...');
    const connected = await connectDB();
    if (!connected) {
      console.error('Failed to connect to database.');
      process.exit(1);
    }

    // Auto-update any expired active reservations
    const now = new Date();
    await Reservation.updateMany(
      { status: 'reserved', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    console.log('Fetching confirmed registrations to exclude teams that registered later...');
    const confirmedRegistrations = await Registration.find().lean();
    const confirmedReservations = await Reservation.find({ status: 'confirmed' }).lean();

    const confirmedTeamNames = new Set();
    const confirmedRegNos = new Set();
    const txnMap = new Map();

    // Population from Registration collection
    for (const reg of confirmedRegistrations) {
      if (reg.teamName) {
        confirmedTeamNames.add(reg.teamName.trim().toLowerCase());
        if (reg.transactionId) {
          txnMap.set(reg.teamName.trim().toLowerCase(), reg.transactionId);
        }
      }
      if (reg.leader?.regNo) {
        confirmedRegNos.add(reg.leader.regNo.trim().toLowerCase());
        if (reg.transactionId) {
          txnMap.set(reg.leader.regNo.trim().toLowerCase(), reg.transactionId);
        }
      }
      if (Array.isArray(reg.members)) {
        for (const m of reg.members) {
          if (m?.regNo) {
            confirmedRegNos.add(m.regNo.trim().toLowerCase());
          }
        }
      }
    }

    // Population from Reservation collection (status: 'confirmed')
    for (const res of confirmedReservations) {
      if (res.teamName) {
        confirmedTeamNames.add(res.teamName.trim().toLowerCase());
      }
      if (res.leader?.regNo) {
        confirmedRegNos.add(res.leader.regNo.trim().toLowerCase());
      }
      if (Array.isArray(res.members)) {
        for (const m of res.members) {
          if (m?.regNo) {
            confirmedRegNos.add(m.regNo.trim().toLowerCase());
          }
        }
      }
    }

    console.log('Fetching cancelled and expired reservations...');
    const rawRecords = await Reservation.find({
      status: { $in: ['cancelled', 'expired'] }
    }).sort({ createdAt: -1 }).lean();

    // Filter out reservations whose team name or leader/member regNo is confirmed
    const unconfirmedRecords = [];
    for (const item of rawRecords) {
      const normTeamName = (item.teamName || '').trim().toLowerCase();
      const leaderRegNo = (item.leader?.regNo || '').trim().toLowerCase();

      let isMemberConfirmed = false;
      if (Array.isArray(item.members)) {
        for (const m of item.members) {
          if (m?.regNo && confirmedRegNos.has(m.regNo.trim().toLowerCase())) {
            isMemberConfirmed = true;
            break;
          }
        }
      }

      // Skip if team or leader or any member later confirmed
      if (confirmedTeamNames.has(normTeamName) || confirmedRegNos.has(leaderRegNo) || isMemberConfirmed) {
        continue;
      }

      unconfirmedRecords.push(item);
    }

    // Deduplicate by normalized Team Name
    const teamMap = new Map();
    for (const item of unconfirmedRecords) {
      const normName = (item.teamName || '').trim().toLowerCase();
      if (normName && !teamMap.has(normName)) {
        teamMap.set(normName, item);
      }
    }

    // Sort primarily by Team Name (A-Z), secondarily by Status
    const records = Array.from(teamMap.values()).sort((a, b) => {
      const nameA = (a.teamName || '').trim();
      const nameB = (b.teamName || '').trim();
      const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return (a.status || '').localeCompare(b.status || '');
    });

    console.log(`Total TRULY UNCONFIRMED unique team names exported: ${records.length}`);

    const headers = [
      'Team Name',
      'Status',
      'Leader Name',
      'Phone Number',
      'Registration Number',
      'Transaction ID'
    ];

    const rows = [headers.map(escapeCsv).join(',')];

    for (const item of records) {
      const leader = item.leader || {};
      const normTeamName = (item.teamName || '').trim().toLowerCase();
      const leaderRegNo = (leader.regNo || '').trim().toLowerCase();
      const txnId = item.transactionId || txnMap.get(normTeamName) || txnMap.get(leaderRegNo) || '';

      const row = [
        item.teamName || '',
        item.status || '',
        leader.name || '',
        leader.phone || '',
        leader.regNo || '',
        txnId
      ];

      rows.push(row.map(escapeCsv).join(','));
    }

    const csvContent = rows.join('\n');
    const mainPath = path.join(__dirname, '../../unconfirmed_cancelled_expired_reservations.csv');
    fs.writeFileSync(mainPath, csvContent, 'utf8');
    console.log(`Successfully exported ${records.length} unconfirmed records to ${mainPath}`);

    // Try updating cancelled_expired_reservations.csv and ordered version if unlocked
    try {
      fs.writeFileSync(path.join(__dirname, '../../cancelled_expired_reservations.csv'), csvContent, 'utf8');
    } catch (e) {}
    try {
      fs.writeFileSync(path.join(__dirname, '../../cancelled_expired_reservations_ordered.csv'), csvContent, 'utf8');
    } catch (e) {}

    process.exit(0);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    process.exit(1);
  }
}

exportCsv();
