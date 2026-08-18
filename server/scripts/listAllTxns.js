import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listAllTxns() {
  await connectDB();
  const regs = await Registration.find({}).select('teamName transactionId leader paymentStatus createdAt').sort({ createdAt: -1 }).lean();
  
  console.log(`\n=== ALL ${regs.length} REGISTRATION TRANSACTION IDs ===`);
  regs.forEach((r, idx) => {
    console.log(`${String(idx + 1).padStart(2, ' ')}. [${r.paymentStatus.padEnd(8, ' ')}] Txn: "${r.transactionId}" | Team: "${r.teamName}" | Leader: ${r.leader?.name} (${r.leader?.regNo})`);
  });
  console.log(`=========================================\n`);
  process.exit(0);
}

listAllTxns();
