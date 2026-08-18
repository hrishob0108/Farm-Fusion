import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Registration } from '../models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const escapeCsv = (str) => {
  if (str === null || str === undefined) return '""';
  const val = String(str).replace(/"/g, '""');
  return `"${val}"`;
};

const formatISTDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' IST (+05:30)';
};

async function exportCategorizedCSVs() {
  try {
    console.log('Connecting to MongoDB...');
    const connected = await connectDB();
    if (!connected) {
      console.error('Failed to connect to database.');
      process.exit(1);
    }

    console.log('Fetching registrations...');
    const registrations = await Registration.find().sort({ createdAt: -1 }).lean();

    const headers = [
      'S.No',
      'Team Name',
      'Role',
      'Participant Name',
      'Registration Number',
      'Email ID',
      'Phone Number',
      'Section',
      'Branch',
      'Residency Status',
      'Hostel Name',
      'Room Number',
      'Transaction ID',
      'Payment Status',
      'Registration Date (IST)'
    ];

    const lhGirlsList = [];
    const mhBoysList = [];
    const dayScholarsList = [];
    const unclassifiedList = [];

    let totalCount = 0;

    for (const reg of registrations) {
      const teamName = reg.teamName || '';
      const txnId = reg.transactionId || '';
      const paymentStatus = reg.paymentStatus || 'Pending';
      const regDate = formatISTDate(reg.createdAt);

      // Process Leader
      if (reg.leader) {
        totalCount++;
        const l = reg.leader;
        const regNo = (l.regNo || '').trim();
        const resType = (l.residenceType || '').trim();
        const hostelName = (l.hostelName || '').trim();
        const hostelUpper = hostelName.toUpperCase();

        const record = {
          teamName,
          role: 'Team Leader',
          name: l.name || '',
          regNo,
          email: l.email || (regNo ? `${regNo}@klu.ac.in` : ''),
          phone: l.phone || '',
          section: l.section || '',
          branch: l.branch || '',
          residenceType: resType || 'Day Scholar',
          hostelName: resType === 'Hosteller' ? hostelName : 'N/A',
          roomNumber: resType === 'Hosteller' ? (l.roomNumber || 'N/A') : 'N/A',
          transactionId: txnId,
          paymentStatus,
          regDate
        };

        if (resType === 'Day Scholar' || !resType) {
          dayScholarsList.push(record);
        } else if (hostelUpper.includes('LH')) {
          lhGirlsList.push(record);
        } else if (hostelUpper.includes('MH') || hostelUpper.includes('PG')) {
          mhBoysList.push(record);
        } else {
          unclassifiedList.push(record);
        }
      }

      // Process Members
      if (Array.isArray(reg.members)) {
        reg.members.forEach((m, idx) => {
          if (!m) return;
          totalCount++;
          const regNo = (m.regNo || '').trim();
          const resType = (m.residenceType || '').trim();
          const hostelName = (m.hostelName || '').trim();
          const hostelUpper = hostelName.toUpperCase();

          const record = {
            teamName,
            role: `Team Member ${idx + 1}`,
            name: m.name || '',
            regNo,
            email: m.email || (regNo ? `${regNo}@klu.ac.in` : ''),
            phone: m.phone || '',
            section: m.section || '',
            branch: m.branch || '',
            residenceType: resType || 'Day Scholar',
            hostelName: resType === 'Hosteller' ? hostelName : 'N/A',
            roomNumber: resType === 'Hosteller' ? (m.roomNumber || 'N/A') : 'N/A',
            transactionId: txnId,
            paymentStatus,
            regDate
          };

          if (resType === 'Day Scholar' || !resType) {
            dayScholarsList.push(record);
          } else if (hostelUpper.includes('LH')) {
            lhGirlsList.push(record);
          } else if (hostelUpper.includes('MH') || hostelUpper.includes('PG')) {
            mhBoysList.push(record);
          } else {
            unclassifiedList.push(record);
          }
        });
      }
    }

    const buildCsvContent = (list) => {
      const rows = [headers.map(escapeCsv).join(',')];
      list.forEach((item, index) => {
        const row = [
          index + 1,
          item.teamName,
          item.role,
          item.name,
          item.regNo,
          item.email,
          item.phone,
          item.section,
          item.branch,
          item.residenceType,
          item.hostelName,
          item.roomNumber,
          item.transactionId,
          item.paymentStatus,
          item.regDate
        ];
        rows.push(row.map(escapeCsv).join(','));
      });
      return rows.join('\n');
    };

    const rootDir = path.join(__dirname, '../../');

    // 1. Export Female / Girls (LH Hostellers)
    const femaleLhCsv = buildCsvContent(lhGirlsList);
    const femaleLhPath = path.join(rootDir, 'female_lh_girls_participants.csv');
    fs.writeFileSync(femaleLhPath, femaleLhCsv, 'utf8');
    console.log(`✅ Saved ${lhGirlsList.length} Female (LH Girls) records to: ${femaleLhPath}`);

    // 2. Export Male / Boys (MH Hostellers)
    const maleMhCsv = buildCsvContent(mhBoysList);
    const maleMhPath = path.join(rootDir, 'male_mh_boys_participants.csv');
    fs.writeFileSync(maleMhPath, maleMhCsv, 'utf8');
    console.log(`✅ Saved ${mhBoysList.length} Male (MH Boys) records to: ${maleMhPath}`);

    // 3. Export Day Scholars
    const dayScholarCsv = buildCsvContent(dayScholarsList);
    const dayScholarPath = path.join(rootDir, 'dayscholar_participants.csv');
    fs.writeFileSync(dayScholarPath, dayScholarCsv, 'utf8');
    console.log(`✅ Saved ${dayScholarsList.length} Day Scholar records to: ${dayScholarPath}`);

    // Summary stats
    console.log('\n--- EXPORT SUMMARY ---');
    console.log(`Total Registrations: ${registrations.length}`);
    console.log(`Total Participants: ${totalCount}`);
    console.log(`Female (LH Girls) CSV: ${lhGirlsList.length} records`);
    console.log(`Male (MH Boys) CSV: ${mhBoysList.length} records`);
    console.log(`Day Scholar CSV: ${dayScholarsList.length} records`);
    if (unclassifiedList.length > 0) {
      console.log(`Unclassified CSV: ${unclassifiedList.length} records`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error generating categorized CSVs:', error);
    process.exit(1);
  }
}

exportCategorizedCSVs();
