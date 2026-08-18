import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';
import { Reservation } from '../models/Reservation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspect() {
  await connectDB();
  const registrations = await Registration.find().lean();
  
  const allKeys = new Set();
  const hostelBreakdown = {};
  const dayScholars = [];
  const lhHostellers = [];
  const mhHostellers = [];
  const unclassified = [];

  const processPerson = (person, role, reg) => {
    Object.keys(person).forEach(k => allKeys.add(k));

    const resType = (person.residenceType || '').trim();
    const hName = (person.hostelName || '').trim();
    const hUpper = hName.toUpperCase();

    const record = {
      teamName: reg.teamName,
      paymentStatus: reg.paymentStatus,
      transactionId: reg.transactionId,
      role: role,
      name: person.name,
      regNo: person.regNo,
      email: person.email || `${person.regNo}@klu.ac.in`,
      phone: person.phone,
      section: person.section,
      branch: person.branch,
      residenceType: person.residenceType,
      hostelName: person.hostelName,
      roomNumber: person.roomNumber
    };

    if (resType === 'Day Scholar' || !resType || resType === 'N/A') {
      dayScholars.push(record);
    } else if (hUpper.includes('LH')) {
      lhHostellers.push(record);
    } else if (hUpper.includes('MH') || hUpper.includes('PG')) {
      mhHostellers.push(record);
    } else {
      unclassified.push(record);
    }

    if (hName) {
      hostelBreakdown[hName] = (hostelBreakdown[hName] || 0) + 1;
    }
  };

  for (const reg of registrations) {
    if (reg.leader) processPerson(reg.leader, 'Leader', reg);
    if (Array.isArray(reg.members)) {
      for (const m of reg.members) {
        processPerson(m, 'Member', reg);
      }
    }
  }

  console.log('All keys found on participant objects:', Array.from(allKeys));
  console.log(`\nCounts summary:`);
  console.log(`- LH Hostellers (Girls): ${lhHostellers.length}`);
  console.log(`- MH / PG Hostellers (Boys): ${mhHostellers.length}`);
  console.log(`- Day Scholars: ${dayScholars.length}`);
  console.log(`- Unclassified Hostellers: ${unclassified.length}`);

  if (unclassified.length > 0) {
    console.log('\nUnclassified records:', unclassified);
  }

  console.log('\nHostel breakdown:', hostelBreakdown);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
