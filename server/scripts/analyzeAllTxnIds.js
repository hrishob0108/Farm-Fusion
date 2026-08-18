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

async function analyzeTxnIds() {
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to MongoDB");
    process.exit(1);
  }

  const registrations = await Registration.find({}).lean();
  const reservations = await Reservation.find({}).lean();

  console.log(`\n========================================`);
  console.log(`Total Registrations in DB: ${registrations.length}`);
  console.log(`Total Reservations in DB: ${reservations.length}`);
  console.log(`========================================\n`);

  // Map of raw Txn ID -> Array of registration docs
  const rawTxnMap = new Map();
  // Map of cleaned numeric Txn ID -> Array of registration docs
  const cleanTxnMap = new Map();

  for (const reg of registrations) {
    const rawTxn = reg.transactionId ? String(reg.transactionId).trim() : '';
    if (!rawTxn) continue;

    // 1. Raw exact match (case insensitive)
    const rawKey = rawTxn.toLowerCase();
    if (!rawTxnMap.has(rawKey)) rawTxnMap.set(rawKey, []);
    rawTxnMap.get(rawKey).push(reg);

    // 2. Cleaned digits-only match (e.g. T260807175... -> 260807175...)
    const digitsOnly = rawTxn.replace(/\D/g, '');
    if (digitsOnly && digitsOnly.length >= 6) {
      if (!cleanTxnMap.has(digitsOnly)) cleanTxnMap.set(digitsOnly, []);
      cleanTxnMap.get(digitsOnly).push(reg);
    }
  }

  const duplicateTxns = [];

  // Check Exact Raw Matches
  for (const [key, regs] of rawTxnMap.entries()) {
    if (regs.length > 1) {
      duplicateTxns.push({ matchType: 'Exact Match', key: regs[0].transactionId, regs });
    }
  }

  // Check Cleaned Digits Matches
  for (const [key, regs] of cleanTxnMap.entries()) {
    if (regs.length > 1) {
      // Check if not already added by raw match
      const alreadyIn = duplicateTxns.some(d => d.regs[0]._id.toString() === regs[0]._id.toString() && d.regs[1]._id.toString() === regs[1]._id.toString());
      if (!alreadyIn) {
        duplicateTxns.push({ matchType: 'Numeric Sequence Match', key, regs });
      }
    }
  }

  // Check Cross Matches with Reservations
  const reservationCrossMatches = [];
  for (const resItem of reservations) {
    const resTxn = resItem.transactionId ? String(resItem.transactionId).trim() : '';
    if (!resTxn) continue;
    const resDigits = resTxn.replace(/\D/g, '');

    const matchingRegs = registrations.filter(r => {
      const rTxn = r.transactionId ? String(r.transactionId).trim() : '';
      if (!rTxn) return false;
      return rTxn.toLowerCase() === resTxn.toLowerCase() || (resDigits.length >= 6 && rTxn.replace(/\D/g, '') === resDigits);
    });

    if (matchingRegs.length > 0) {
      reservationCrossMatches.push({ resItem, matchingRegs });
    }
  }

  console.log("--- EXACT DUPLICATE TXN IDs IN REGISTRATIONS ---");
  if (duplicateTxns.length === 0) {
    console.log("None found.");
  } else {
    duplicateTxns.forEach(d => {
      console.log(`❌ Match Type: ${d.matchType} | Key: "${d.key}"`);
      d.regs.forEach(r => {
        console.log(`   - Team: "${r.teamName}" | Leader: "${r.leader?.name}" (${r.leader?.regNo}) | Status: ${r.paymentStatus} | ID: ${r._id}`);
      });
    });
  }

  console.log("\n--- TRANSACTION IDs MATCHING BETWEEN RESERVATIONS & REGISTRATIONS ---");
  if (reservationCrossMatches.length === 0) {
    console.log("None found.");
  } else {
    reservationCrossMatches.forEach(m => {
      console.log(`⚠️ Reservation "${m.resItem.teamName}" (Txn: ${m.resItem.transactionId}, Status: ${m.resItem.status}) matches:`);
      m.matchingRegs.forEach(r => {
        console.log(`   - Registration Team: "${r.teamName}" (Txn: ${r.transactionId}, Status: ${r.paymentStatus})`);
      });
    });
  }

  // Export CSV
  const csvHeaders = ['Match Type', 'Transaction ID', 'Registration ID', 'Team Name', 'Leader Name', 'Leader RegNo', 'Leader Phone', 'Payment Status', 'Created At'];
  const csvRows = [csvHeaders.map(escapeCSV).join(',')];

  for (const d of duplicateTxns) {
    for (const r of d.regs) {
      csvRows.push([
        escapeCSV(d.matchType),
        escapeCSV(r.transactionId),
        escapeCSV(r._id),
        escapeCSV(r.teamName),
        escapeCSV(r.leader?.name || ''),
        escapeCSV(r.leader?.regNo || ''),
        escapeCSV(r.leader?.phone || ''),
        escapeCSV(r.paymentStatus || ''),
        escapeCSV(r.createdAt ? new Date(r.createdAt).toLocaleString() : '')
      ].join(','));
    }
  }

  for (const m of reservationCrossMatches) {
    const resItem = m.resItem;
    for (const r of m.matchingRegs) {
      csvRows.push([
        escapeCSV(`Reservation vs Registration Match (${resItem.status})`),
        escapeCSV(r.transactionId || resItem.transactionId),
        escapeCSV(`Reg:${r._id} | Res:${resItem.reservationId}`),
        escapeCSV(`Reg:"${r.teamName}" / Res:"${resItem.teamName}"`),
        escapeCSV(r.leader?.name || resItem.leader?.name || ''),
        escapeCSV(r.leader?.regNo || resItem.leader?.regNo || ''),
        escapeCSV(r.leader?.phone || resItem.leader?.phone || ''),
        escapeCSV(`Reg:${r.paymentStatus} | Res:${resItem.status}`),
        escapeCSV(r.createdAt ? new Date(r.createdAt).toLocaleString() : '')
      ].join(','));
    }
  }

  const csvContent = csvRows.join('\n');
  const rootPath = path.join(__dirname, '../../duplicates.csv');
  const altPath = path.join(__dirname, '../../duplicate_registrations.csv');

  fs.writeFileSync(rootPath, csvContent, 'utf-8');
  fs.writeFileSync(altPath, csvContent, 'utf-8');

  console.log(`\n========================================`);
  console.log(`📄 Saved analysis report to CSV:`);
  console.log(`   - ${rootPath}`);
  console.log(`   - ${altPath}`);
  console.log(`========================================\n`);

  process.exit(0);
}

analyzeTxnIds();
