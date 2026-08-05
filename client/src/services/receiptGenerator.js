import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const loadImageData = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.width, height: img.height });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const LABEL_X = 15;
const VALUE_X = 85;
const PAGE_W = 210;

const drawKeyValue = (doc, label, value, y, col = 0) => {
  const lx = col === 0 ? LABEL_X : 115;
  const vx = col === 0 ? VALUE_X : 155;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(label, lx, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(String(value || 'N/A'), vx, y);
};

export const generateRegistrationReceipt = async (registration) => {
  if (!registration) return;

  const [farmLogo, taraLogo] = await Promise.all([
    loadImageData('/farm-fusion-logo.png'),
    loadImageData('/tara-logo.jpg')
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ── Header Background ──────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, 50, 'F');

  // Accent Bar (top)
  doc.setFillColor(15, 58, 36);
  doc.rect(0, 0, PAGE_W, 5, 'F');

  // Left Logo: FarmFusion
  if (farmLogo) {
    const aspect = farmLogo.width / farmLogo.height;
    const h = 26;
    const w = Math.min(h * aspect, 80);
    doc.addImage(farmLogo.dataUrl, 'PNG', 12, 10, w, h);
  } else {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 58, 36);
    doc.text('FARMFUSION', 14, 28);
  }

  // Right Logo: TARA
  if (taraLogo) {
    const aspect = taraLogo.width / taraLogo.height;
    const h = 22;
    const w = Math.min(h * aspect, 60);
    doc.addImage(taraLogo.dataUrl, 'JPEG', PAGE_W - 12 - w, 12, w, h);
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('TARA EVENTS', 155, 25);
  }

  // "Managed by" text under TARA logo
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(122, 79, 35);
  doc.text('Managed by TARA Event Management', PAGE_W - 12, 36, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.7);
  doc.line(12, 41, PAGE_W - 12, 41);

  // Subtitle row
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('OFFICIAL EVENT REGISTRATION PASS', LABEL_X, 47);
  const issueDate = new Date(registration.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  doc.text(`ISSUED: ${issueDate}`, PAGE_W - 12, 47, { align: 'right' });

  // ── Section 1: Registration Summary ───────────────────────────────────────
  let curY = 55;

  doc.setFillColor(240, 247, 243);
  doc.roundedRect(12, curY, 186, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 58, 36);
  doc.text('REGISTRATION DETAILS', LABEL_X, curY + 5.5);
  curY += 12;

  doc.setFontSize(8.5);
  drawKeyValue(doc, 'Team Name:', registration.teamName, curY, 0);
  drawKeyValue(doc, 'Transaction ID:', registration.transactionId, curY, 1);
  curY += 8;

  const totalMembers = 1 + (registration.members?.length || 0);
  const regDate = new Date(registration.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  drawKeyValue(doc, 'Total Members:', `${totalMembers} member${totalMembers !== 1 ? 's' : ''}`, curY, 0);
  drawKeyValue(doc, 'Registered On:', regDate, curY, 1);
  curY += 8;

  drawKeyValue(doc, 'Event:', 'FarmFusion', curY, 0);
  curY += 12;

  // ── Section 2: Team Leader ─────────────────────────────────────────────────
  doc.setFillColor(240, 247, 243);
  doc.roundedRect(12, curY, 186, 8, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 58, 36);
  doc.text('TEAM LEADER', LABEL_X, curY + 5.5);
  curY += 12;

  doc.setFontSize(8.5);
  const leader = registration.leader || {};
  const leaderEmail = leader.email || (leader.regNo ? `${leader.regNo}@klu.ac.in` : 'N/A');

  drawKeyValue(doc, 'Full Name:', leader.name, curY, 0);
  drawKeyValue(doc, 'Reg. Number:', leader.regNo, curY, 1);
  curY += 8;

  drawKeyValue(doc, 'Email:', leaderEmail, curY, 0);
  drawKeyValue(doc, 'Phone:', leader.phone, curY, 1);
  curY += 8;

  drawKeyValue(doc, 'Branch:', leader.branch, curY, 0);
  drawKeyValue(doc, 'Section:', leader.section, curY, 1);
  curY += 12;

  // ── Section 3: Team Members Table ─────────────────────────────────────────
  if (registration.members && registration.members.length > 0) {
    doc.setFillColor(240, 247, 243);
    doc.roundedRect(12, curY, 186, 8, 1, 1, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 58, 36);
    doc.text(`TEAM MEMBERS (${registration.members.length})`, LABEL_X, curY + 5.5);
    curY += 10;

    const memberRows = registration.members.map((m, i) => [
      i + 1,
      m.name || 'N/A',
      m.regNo || 'N/A',
      m.email || (m.regNo ? `${m.regNo}@klu.ac.in` : 'N/A'),
      m.phone || 'N/A',
      `${m.branch || 'N/A'} / ${m.section || 'N/A'}`
    ]);

    autoTable(doc, {
      startY: curY,
      margin: { left: 12, right: 12 },
      head: [['#', 'Name', 'Reg. No.', 'Email', 'Phone', 'Branch / Sec']],
      body: memberRows,
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [15, 58, 36],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 42 },
        4: { cellWidth: 22 },
        5: { cellWidth: 32 },
      },
    });

    curY = doc.lastAutoTable.finalY + 10;
  } else {
    curY += 4;
  }

  // ── Instructions Box ───────────────────────────────────────────────────────
  const boxH = 22;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, curY, 186, boxH, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Important Instructions:', LABEL_X, curY + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('• Bring a digital or printed copy of this pass on the event day.', LABEL_X, curY + 12);
  doc.text('• Verification will be conducted using your Registration Number & Transaction ID.', LABEL_X, curY + 17);

  // ── Official Stamp Seal ────────────────────────────────────────────────────
  const sealX = PAGE_W - 24;
  const sealY = curY + 11;

  doc.setDrawColor(15, 58, 36);
  doc.setLineWidth(1.2);
  doc.circle(sealX, sealY, 14, 'D');
  doc.setLineWidth(0.5);
  doc.circle(sealX, sealY, 12, 'D');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 58, 36);
  doc.text('★ TARA ★', sealX, sealY - 5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text('OFFICIAL', sealX, sealY + 0.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('PASS', sealX, sealY + 6, { align: 'center' });

  // ── Footer Notice ──────────────────────────────────────────────────────────
  curY += boxH + 4;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is an official computer-generated registration pass issued for FarmFusion.',
    PAGE_W / 2, curY, { align: 'center' }
  );
  doc.text(
    'Organized & Managed by TARA Event Management. Please keep this pass for venue entry.',
    PAGE_W / 2, curY + 4, { align: 'center' }
  );

  // Accent bar (bottom)
  doc.setFillColor(15, 58, 36);
  doc.rect(0, 290, PAGE_W, 5, 'F');

  // ── Save ───────────────────────────────────────────────────────────────────
  doc.save(`FarmFusion_Pass_${registration.teamName.replace(/\s+/g, '_')}.pdf`);
};
