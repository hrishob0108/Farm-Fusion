import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

function escapeCSV(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

async function generateTxnReport() {
  await connectDB();
  const regs = await Registration.find({}).sort({ createdAt: -1 }).lean();

  const txnMap = new Map();
  regs.forEach(r => {
    const txn = r.transactionId ? String(r.transactionId).trim() : 'N/A';
    const key = txn.toLowerCase();
    if (!txnMap.has(key)) txnMap.set(key, []);
    txnMap.get(key).push(r);
  });

  const duplicateGroups = Array.from(txnMap.entries()).filter(([k, v]) => v.length > 1);

  // Write CSV of all transaction IDs and duplicate status
  const csvHeaders = ['S.No', 'Transaction ID', 'Duplicate Status', 'Team Name', 'Leader Name', 'Leader Reg No', 'Leader Phone', 'Payment Status', 'Created At'];
  const csvRows = [csvHeaders.map(escapeCSV).join(',')];

  regs.forEach((r, idx) => {
    const txn = r.transactionId ? String(r.transactionId).trim() : 'N/A';
    const isDup = txnMap.get(txn.toLowerCase()).length > 1;
    csvRows.push([
      escapeCSV(idx + 1),
      escapeCSV(txn),
      escapeCSV(isDup ? 'DUPLICATE' : 'UNIQUE'),
      escapeCSV(r.teamName),
      escapeCSV(r.leader?.name || ''),
      escapeCSV(r.leader?.regNo || ''),
      escapeCSV(r.leader?.phone || ''),
      escapeCSV(r.paymentStatus || ''),
      escapeCSV(r.createdAt ? new Date(r.createdAt).toLocaleString() : '')
    ].join(','));
  });

  const csvContent = csvRows.join('\n');
  const rootPath = path.join(__dirname, '../../duplicates.csv');
  const altPath = path.join(__dirname, '../../duplicate_registrations.csv');
  const txnsPath = path.join(__dirname, '../../all_transaction_ids.csv');

  fs.writeFileSync(rootPath, csvContent, 'utf-8');
  fs.writeFileSync(altPath, csvContent, 'utf-8');
  fs.writeFileSync(txnsPath, csvContent, 'utf-8');

  console.log(`Report generated. Duplicates found: ${duplicateGroups.length}`);
  process.exit(0);
}

generateTxnReport();
