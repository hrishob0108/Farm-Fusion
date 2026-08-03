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

      rows.push({
        'Team Name': r.teamName,
        'Name': r.leader.name || '',
        'Reg No': leaderRegNo,
        'Email ID': leaderEmail,
        'Phone Number': r.leader.phone || '',
        'Section': r.leader.section || '',
        'Branch': r.leader.branch || '',
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

        rows.push({
          'Team Name': r.teamName,
          'Name': m?.name || '',
          'Reg No': mRegNo,
          'Email ID': mEmail,
          'Phone Number': m?.phone || '',
          'Section': m?.section || '',
          'Branch': m?.branch || '',
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

// Constructs participant rows in the exact format of data.json
export const buildJSONParticipantRows = (registrations) => {
  const rows = [];

  (registrations || []).forEach(r => {
    // Leader Row
    if (r.leader) {
      const leaderRegNo = (r.leader.regNo || '').trim();
      const leaderEmail = r.leader.email || (leaderRegNo ? `${leaderRegNo}@klu.ac.in` : '');
      const leaderYear = r.leader.year || (leaderRegNo.startsWith('9925') ? '2' : '3');

      rows.push({
        regno: leaderRegNo,
        name: r.leader.name || '',
        teamName: r.teamName || '',
        role: 'Team Leader',
        branch: r.leader.branch || '',
        year: String(leaderYear),
        phone: r.leader.phone || '',
        email: leaderEmail
      });
    }

    // Additional Members Rows
    if (Array.isArray(r.members)) {
      r.members.forEach((m, idx) => {
        const mRegNo = (m?.regNo || '').trim();
        const mEmail = m?.email || (mRegNo ? `${mRegNo}@klu.ac.in` : '');
        const mYear = m?.year || (mRegNo.startsWith('9925') ? '2' : '3');

        rows.push({
          regno: mRegNo,
          name: m?.name || '',
          teamName: r.teamName || '',
          role: `Team Member ${idx + 1}`,
          branch: m?.branch || '',
          year: String(mYear),
          phone: m?.phone || '',
          email: mEmail
        });
      });
    }
  });

  return rows;
};

// JSON Export Handler (matches data.json schema)
export const exportToJSON = (registrations) => {
  if (!registrations || registrations.length === 0) return;

  const jsonRows = buildJSONParticipantRows(registrations);
  const jsonString = JSON.stringify(jsonRows, null, 2);

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Farm_Fusion_AI_Participants_${Date.now()}.json`);
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
    r['Transaction ID'],
    r['Payment Screenshot Link'],
    r['Payment Status'],
    r['Date & Time (IST)']
  ]);

  autoTable(doc, {
    startY: 26,
    head: [[
      '#', 'Team Name', 'Name', 'Reg No', 'Email ID',
      'Phone Number', 'Section', 'Branch', 'Transaction ID',
      'Payment Screenshot Link', 'Payment Status', 'Date & Time (IST)'
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
