import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';
import { Reservation } from '../models/Reservation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectCollections() {
  await connectDB();
  const regs = await Registration.find().lean();
  const reser = await Reservation.find().lean();

  console.log(`Registration collection count: ${regs.length}`);
  console.log(`Reservation collection count: ${reser.length}`);

  const regPaymentStatuses = {};
  regs.forEach(r => {
    regPaymentStatuses[r.paymentStatus] = (regPaymentStatuses[r.paymentStatus] || 0) + 1;
  });

  const reserStatuses = {};
  reser.forEach(r => {
    reserStatuses[r.status] = (reserStatuses[r.status] || 0) + 1;
  });

  console.log('Registration Payment Statuses:', regPaymentStatuses);
  console.log('Reservation Statuses:', reserStatuses);

  process.exit(0);
}

inspectCollections().catch(err => {
  console.error(err);
  process.exit(1);
});
