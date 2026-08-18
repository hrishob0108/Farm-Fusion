import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to format date with exact +05:30 IST timezone
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

// Constructs vertical row-per-participant flat data (members listed down by down)
const buildFlatParticipantRows = (registrations) => {
  const origin = window.location.origin;
  const rows = [];

  (registrations || []).forEach(r => {
    const screenshotUrl = r.paymentScreenshot ? (r.paymentScreenshot.startsWith('http') ? r.paymentScreenshot : `${origin}${r.paymentScreenshot}`) : 'N/A';
    const istTime = formatISTDate(r.createdAt);

    // Leader Row
    if (r.leader) {
      const leaderRegNo = r.leader.regNo || '';
      const leaderEmail = r.leader.email || (leaderRegNo ? `${leaderRegNo.trim()}@klu.ac.in` : '');
      const leaderResidency = r.leader.residenceType || 'Day Scholar';
      const leaderHostel = r.leader.residenceType === 'Hosteller' ? (r.leader.hostelName || 'N/A') : 'N/A';
      const leaderRoom = r.leader.residenceType === 'Hosteller' ? (r.leader.roomNumber || 'N/A') : 'N/A';

      rows.push({
        'Team Name': r.teamName,
        'Name': r.leader.name || '',
        'Reg No': leaderRegNo,
        'Email ID': leaderEmail,
        'Phone Number': r.leader.phone || '',
        'Section': r.leader.section || '',
        'Branch': r.leader.branch || '',
        'Residency Status': leaderResidency,
        'Hostel Name': leaderHostel,
        'Room Number': leaderRoom,
        'Transaction ID': r.transactionId || '',
        'Payment Screenshot Link': screenshotUrl,
        'Payment Status': r.paymentStatus || 'Pending',
        'Date & Time (IST)': istTime
      });
    }

    // Additional Members Rows (down by down under the same Team Name)
    if (Array.isArray(r.members)) {
      r.members.forEach(m => {
        const mRegNo = m?.regNo || '';
        const mEmail = m?.email || (mRegNo ? `${mRegNo.trim()}@klu.ac.in` : '');
        const mResidency = m?.residenceType || 'Day Scholar';
        const mHostel = m?.residenceType === 'Hosteller' ? (m?.hostelName || 'N/A') : 'N/A';
        const mRoom = m?.residenceType === 'Hosteller' ? (m?.roomNumber || 'N/A') : 'N/A';

        rows.push({
          'Team Name': r.teamName,
          'Name': m?.name || '',
          'Reg No': mRegNo,
          'Email ID': mEmail,
          'Phone Number': m?.phone || '',
          'Section': m?.section || '',
          'Branch': m?.branch || '',
          'Residency Status': mResidency,
          'Hostel Name': mHostel,
          'Room Number': mRoom,
          'Transaction ID': r.transactionId || '',
          'Payment Screenshot Link': screenshotUrl,
          'Payment Status': r.paymentStatus || 'Pending',
          'Date & Time (IST)': istTime
        });
      });
    }
  });

  return rows;
};

// CSV Export Handler
export const exportToCSV = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const flatRows = buildFlatParticipantRows(registrations);
  const csv = Papa.unparse(flatRows);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Farm_Fusion_AI_Participants_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export LH Girls (Female Hostellers) CSV Handler
export const exportLHGirlsCSV = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const flatRows = buildFlatParticipantRows(registrations);
  const filteredRows = flatRows.filter(r => {
    const hostel = String(r['Hostel Name'] || '').toUpperCase();
    return hostel.includes('LH');
  });

  const csv = Papa.unparse(filteredRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `female_lh_girls_participants_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export MH Boys (Male Hostellers) CSV Handler
export const exportMHBoysCSV = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const flatRows = buildFlatParticipantRows(registrations);
  const filteredRows = flatRows.filter(r => {
    const hostel = String(r['Hostel Name'] || '').toUpperCase();
    return hostel.includes('MH') || hostel.includes('PG');
  });

  const csv = Papa.unparse(filteredRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `male_mh_boys_participants_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export Day Scholars CSV Handler
export const exportDayScholarsCSV = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const flatRows = buildFlatParticipantRows(registrations);
  const filteredRows = flatRows.filter(r => {
    const res = String(r['Residency Status'] || '');
    return res === 'Day Scholar' || r['Hostel Name'] === 'N/A';
  });

  const csv = Papa.unparse(filteredRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `dayscholar_participants_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Constructs team rows in the exact requested format
export const buildJSONTeamRows = (registrations) => {
  return (registrations || []).map(r => ({
    teamName: r.teamName || '',
    transactionId: r.transactionId || '',
    paymentScreenshot: r.paymentScreenshot || '',
    paymentStatus: r.paymentStatus || 'Pending',
    leader: {
      name: r.leader?.name || '',
      regNo: (r.leader?.regNo || '').trim(),
      phone: r.leader?.phone || '',
      section: r.leader?.section || '',
      branch: r.leader?.branch || '',
      residenceType: r.leader?.residenceType || 'Day Scholar',
      hostelName: r.leader?.residenceType === 'Hosteller' ? (r.leader?.hostelName || '') : '',
      roomNumber: r.leader?.residenceType === 'Hosteller' ? (r.leader?.roomNumber || '') : ''
    },
    members: Array.isArray(r.members)
      ? r.members.map(m => ({
          name: m?.name || '',
          regNo: (m?.regNo || '').trim(),
          phone: m?.phone || '',
          section: m?.section || '',
          branch: m?.branch || '',
          residenceType: m?.residenceType || 'Day Scholar',
          hostelName: m?.residenceType === 'Hosteller' ? (m?.hostelName || '') : '',
          roomNumber: m?.residenceType === 'Hosteller' ? (m?.roomNumber || '') : ''
        }))
      : []
  }));
};

export const buildJSONParticipantRows = buildJSONTeamRows;

// JSON Export Handler (matches requested team registration schema)
export const exportToJSON = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const jsonRows = buildJSONTeamRows(registrations);
  const jsonString = JSON.stringify(jsonRows, null, 2);

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Farm_Fusion_Teams_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Deprecated Excel Export Handler (redirects to JSON export)
export const exportToExcel = (registrations) => {
  exportToJSON(registrations);
};

// PDF Report Export Handler
export const exportToPDF = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const flatRows = buildFlatParticipantRows(registrations);
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header Banner
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FARMFUSION - MASTER PARTICIPANTS REPORT (+05:30 IST)', 14, 15);

  const pdfBody = flatRows.map((r, idx) => [
    idx + 1,
    r['Team Name'],
    r['Name'],
    r['Reg No'],
    r['Email ID'],
    r['Phone Number'],
    r['Section'],
    r['Branch'],
    r['Residency Status'],
    r['Hostel Name'],
    r['Room Number'],
    r['Transaction ID'],
    r['Payment Status']
  ]);

  autoTable(doc, {
    startY: 26,
    head: [[
      '#', 'Team Name', 'Name', 'Reg No', 'Email ID',
      'Phone', 'Section', 'Branch', 'Residency', 'Hostel', 'Room No',
      'Txn ID', 'Status'
    ]],
    body: pdfBody,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244]
    },
    margin: { left: 8, right: 8 }
  });

  doc.save(`Farm_Fusion_AI_Participants_Report_${Date.now()}.pdf`);
};
