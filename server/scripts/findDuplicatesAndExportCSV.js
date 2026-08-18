import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';
import { Reservation } from '../models/Reservation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

function escapeCSV(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

function normalizeStr(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findDuplicates() {
  const connected = await connectDB();
  if (!connected) {
    console.error("❌ Failed to connect to MongoDB database.");
    process.exit(1);
  }

  console.log("🔍 Fetching all registrations and reservations from database...");
  const allRegistrations = await Registration.find({}).lean();
  const allReservations = await Reservation.find({}).lean();
  console.log(`📊 Total Registrations found: ${allRegistrations.length}`);
  console.log(`📊 Total Reservations found: ${allReservations.length}`);

  const duplicateRows = [];
  const processedKeys = new Set();

  // --- 1. REGISTRATIONS INTERNAL DUPLICATES ---
  // A. Duplicate Txn IDs in Registrations
  const txnMap = new Map();
  for (const reg of allRegistrations) {
    const normTxn = normalizeStr(reg.transactionId);
    if (!normTxn || normTxn === 'na' || normTxn === 'none') continue;
    if (!txnMap.has(normTxn)) txnMap.set(normTxn, []);
    txnMap.get(normTxn).push(reg);
  }

  for (const [normTxn, regs] of txnMap.entries()) {
    if (regs.length > 1) {
      for (const reg of regs) {
        const key = `REG_TXN_${normTxn}_${reg._id}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        duplicateRows.push({
          source: 'Registrations Table',
          duplicateType: 'Duplicate Transaction ID',
          duplicateValue: reg.transactionId,
          recordId: reg._id,
          teamName: reg.teamName,
          leaderName: reg.leader?.name || '',
          leaderRegNo: reg.leader?.regNo || '',
          leaderEmail: reg.leader?.email || '',
          leaderPhone: reg.leader?.phone || '',
          teammates: reg.members?.map(m => `${m.name} (${m.regNo})`).join('; ') || '',
          transactionId: reg.transactionId || '',
          status: reg.paymentStatus || '',
          createdAt: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : ''
        });
      }
    }
  }

  // B. Duplicate Team Names in Registrations
  const teamMap = new Map();
  for (const reg of allRegistrations) {
    const normTeam = normalizeStr(reg.teamName);
    if (!normTeam) continue;
    if (!teamMap.has(normTeam)) teamMap.set(normTeam, []);
    teamMap.get(normTeam).push(reg);
  }

  for (const [normTeam, regs] of teamMap.entries()) {
    if (regs.length > 1) {
      for (const reg of regs) {
        const key = `REG_TEAM_${normTeam}_${reg._id}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        duplicateRows.push({
          source: 'Registrations Table',
          duplicateType: 'Duplicate Team Name',
          duplicateValue: reg.teamName,
          recordId: reg._id,
          teamName: reg.teamName,
          leaderName: reg.leader?.name || '',
          leaderRegNo: reg.leader?.regNo || '',
          leaderEmail: reg.leader?.email || '',
          leaderPhone: reg.leader?.phone || '',
          teammates: reg.members?.map(m => `${m.name} (${m.regNo})`).join('; ') || '',
          transactionId: reg.transactionId || '',
          status: reg.paymentStatus || '',
          createdAt: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : ''
        });
      }
    }
  }

  // C. Duplicate Student Registration Numbers in Registrations
  const regNoMap = new Map();
  for (const reg of allRegistrations) {
    const leaderRegNo = reg.leader?.regNo?.trim();
    if (leaderRegNo) {
      const normRegNo = normalizeStr(leaderRegNo);
      if (!regNoMap.has(normRegNo)) regNoMap.set(normRegNo, []);
      regNoMap.get(normRegNo).push({ reg, role: 'Leader', name: reg.leader?.name, regNo: leaderRegNo });
    }

    if (Array.isArray(reg.members)) {
      for (const m of reg.members) {
        const memberRegNo = m.regNo?.trim();
        if (memberRegNo) {
          const normRegNo = normalizeStr(memberRegNo);
          if (!regNoMap.has(normRegNo)) regNoMap.set(normRegNo, []);
          regNoMap.get(normRegNo).push({ reg, role: 'Member', name: m.name, regNo: memberRegNo });
        }
      }
    }
  }

  for (const [normRegNo, entries] of regNoMap.entries()) {
    const uniqueDocIds = new Set(entries.map(e => String(e.reg._id)));
    if (uniqueDocIds.size > 1) {
      for (const entry of entries) {
        const reg = entry.reg;
        const key = `REG_REGNO_${normRegNo}_${reg._id}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        duplicateRows.push({
          source: 'Registrations Table',
          duplicateType: `Duplicate Student RegNo (${entry.role}: ${entry.name})`,
          duplicateValue: entry.regNo,
          recordId: reg._id,
          teamName: reg.teamName,
          leaderName: reg.leader?.name || '',
          leaderRegNo: reg.leader?.regNo || '',
          leaderEmail: reg.leader?.email || '',
          leaderPhone: reg.leader?.phone || '',
          teammates: reg.members?.map(m => `${m.name} (${m.regNo})`).join('; ') || '',
          transactionId: reg.transactionId || '',
          status: reg.paymentStatus || '',
          createdAt: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : ''
        });
      }
    }
  }

  // --- 2. CROSS-CHECK RESERVATIONS VS REGISTRATIONS ---
  for (const resItem of allReservations) {
    const normTxn = normalizeStr(resItem.transactionId);
    const normTeam = normalizeStr(resItem.teamName);

    // Check if reservation Txn matches a Registration
    if (normTxn && normTxn !== 'na') {
      const matchingRegs = allRegistrations.filter(r => normalizeStr(r.transactionId) === normTxn);
      if (matchingRegs.length > 0) {
        for (const reg of matchingRegs) {
          const key = `CROSS_TXN_${normTxn}_${reg._id}_${resItem._id}`;
          if (processedKeys.has(key)) continue;
          processedKeys.add(key);

          duplicateRows.push({
            source: 'Reservation vs Registration Match',
            duplicateType: 'Txn ID in both Reservations & Registrations',
            duplicateValue: resItem.transactionId,
            recordId: `${reg._id} / Res:${resItem.reservationId}`,
            teamName: reg.teamName,
            leaderName: reg.leader?.name || resItem.leader?.name || '',
            leaderRegNo: reg.leader?.regNo || resItem.leader?.regNo || '',
            leaderEmail: reg.leader?.email || resItem.leader?.email || '',
            leaderPhone: reg.leader?.phone || resItem.leader?.phone || '',
            teammates: reg.members?.map(m => `${m.name} (${m.regNo})`).join('; ') || '',
            transactionId: reg.transactionId || '',
            status: `Reg:${reg.paymentStatus} / Res:${resItem.status}`,
            createdAt: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : ''
          });
        }
      }
    }
  }

  // Generate CSV Header & Content
  const csvHeaders = [
    'Source Table',
    'Duplicate Category',
    'Duplicate Value',
    'Record ID',
    'Team Name',
    'Leader Name',
    'Leader Reg No',
    'Leader Email',
    'Leader Phone',
    'Teammates',
    'Transaction ID',
    'Status',
    'Created At'
  ];

  const csvLines = [
    csvHeaders.map(escapeCSV).join(',')
  ];

  for (const r of duplicateRows) {
    const line = [
      escapeCSV(r.source),
      escapeCSV(r.duplicateType),
      escapeCSV(r.duplicateValue),
      escapeCSV(r.recordId),
      escapeCSV(r.teamName),
      escapeCSV(r.leaderName),
      escapeCSV(r.leaderRegNo),
      escapeCSV(r.leaderEmail),
      escapeCSV(r.leaderPhone),
      escapeCSV(r.teammates),
      escapeCSV(r.transactionId),
      escapeCSV(r.status),
      escapeCSV(r.createdAt)
    ].join(',');
    csvLines.push(line);
  }

  const csvContent = csvLines.join('\n');
  const rootFolderPath = path.join(__dirname, '../../duplicates.csv');
  const altRootFolderPath = path.join(__dirname, '../../duplicate_registrations.csv');

  fs.writeFileSync(rootFolderPath, csvContent, 'utf-8');
  fs.writeFileSync(altRootFolderPath, csvContent, 'utf-8');

  console.log("\n==================================================");
  console.log("📊 COMPREHENSIVE DUPLICATE ANALYSIS REPORT");
  console.log("==================================================");
  console.log(`📌 Total Duplicate Records Flagged: ${duplicateRows.length}`);
  console.log(`📁 Saved to: ${rootFolderPath}`);
  console.log(`📁 Saved to: ${altRootFolderPath}`);
  console.log("==================================================\n");

  process.exit(0);
}

findDuplicates();
