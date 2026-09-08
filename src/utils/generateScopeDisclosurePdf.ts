import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ScopeDisclosureRecord } from '../../types';

const KDB_LOGO_URL = "https://odolazcniphinupgyaqo.supabase.co/storage/v1/object/sign/Pdf%20logo/KDB-LOGOx100h.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zNDNkNjNiOC1jY2RlLTQwYTgtOGVmMS1lN2UyY2NjNzQ0NjUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJQZGYgbG9nby9LREItTE9HT3gxMDBoLnBuZyIsImlhdCI6MTc3NDQwODY3MywiZXhwIjoyMDg5NzY4NjczfQ.r_8Gre72kWfCNdIGpiNEePogU0ieuPOJYqAyvqJ7YsQ";

let cachedLogoImage: HTMLImageElement | null = null;
let logoFetchPromise: Promise<HTMLImageElement | null> | null = null;

const getCachedLogo = async (): Promise<HTMLImageElement | null> => {
  if (cachedLogoImage) return cachedLogoImage;
  if (logoFetchPromise) return logoFetchPromise;

  logoFetchPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, 1200);

    img.onload = () => {
      clearTimeout(timer);
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = KDB_LOGO_URL;
  });

  return logoFetchPromise;
};

export const generateScopeDisclosurePdfDoc = async (data: Partial<ScopeDisclosureRecord>): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // --- PAGE 1 ---
  let currentY = 10;

  // Optional KDB Logo
  try {
    const logo = await getCachedLogo();
    if (logo) {
      doc.addImage(logo, 'PNG', (pageWidth - 32) / 2, currentY, 32, 18);
      currentY += 21;
    }
  } catch (_) {
    currentY = 14;
  }

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('KDB Premise Inspection Scope Disclosure', pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // Purpose Paragraph
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Purpose: ', margin, currentY);
  const purposePrefixWidth = doc.getTextWidth('Purpose: ');

  doc.setFont('helvetica', 'normal');
  const purposeText = 'To inform the licensee about the scope of inspections, the records subject to review, and the compliance checks that the regulator may conduct during premise inspections, in accordance with the Dairy Industry Act (Cap. 336) and its subsidiary regulations.';
  const splitPurpose = doc.splitTextToSize(purposeText, contentWidth - purposePrefixWidth);
  doc.text(splitPurpose[0], margin + purposePrefixWidth, currentY);

  if (splitPurpose.length > 1) {
    for (let i = 1; i < splitPurpose.length; i++) {
      currentY += 4;
      doc.text(splitPurpose[i], margin, currentY);
    }
  }
  currentY += 5;

  // Horizontal Divider Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Section A: Licensee & Premise Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. Licensee & Premise Details', margin, currentY);
  currentY += 4.5;

  doc.setFontSize(8.5);
  const details = [
    { label: 'Name of Licensee (DBO):', value: data.dboName || '..................................................................................' },
    { label: 'Premise Name:', value: data.premiseName || '..................................................................................' },
    { label: 'Location:', value: data.location || '..................................................................................' },
    { label: 'License Category:', value: data.category || '..................................................................................' }
  ];

  details.forEach((d) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`•  ${d.label}`, margin + 2, currentY);
    const labelW = doc.getTextWidth(`•  ${d.label}`);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${d.value}`, margin + 2 + labelW, currentY);
    currentY += 4.2;
  });
  currentY += 2.5;

  // Section B: Operational Areas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('B. Operational Areas', margin, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('The regulator will inspect and assess the following areas of operation:', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Area', 'Description']],
    body: [
      ['Milk Handling', 'Receipt, storage, and handling of raw milk'],
      ['Processing Activities', 'Pasteurization, packaging, value addition'],
      ['Distribution', 'Transportation and delivery systems'],
      ['Hygiene & Sanitation', 'Cleanliness of premises, equipment, and personnel'],
      ['Equipment & Facilities', 'Suitability and maintenance of machinery'],
      ['Waste Management', 'Disposal of effluent and solid waste'],
      ['Product Traceability', 'Ability to track milk from source to sale'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Section C: Records That May Be Reviewed
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('C. Records That May Be Reviewed', margin, currentY);
  currentY += 4;

  const recordsList = [
    'Purchase records / milk intake logs',
    'Delivery notes / dispatch records',
    'Sales invoices / receipts',
    'Farmer / supplier registers',
    'Production and processing records (where applicable)',
    'Cleaning and sanitation logs',
    'Equipment maintenance records',
    'Staff health certificates',
    'Quality control and test results (where applicable)',
    'Any other traceability or compliance documentation'
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // 2-column layout for the 10 bullet points to fit page 1 cleanly
  const colWidth = (contentWidth - 6) / 2;
  const midPoint = 5;
  const startBulletY = currentY;

  for (let i = 0; i < midPoint; i++) {
    doc.text(`•  ${recordsList[i]}`, margin + 2, startBulletY + (i * 3.8));
  }
  for (let i = midPoint; i < recordsList.length; i++) {
    doc.text(`•  ${recordsList[i]}`, margin + colWidth + 4, startBulletY + ((i - midPoint) * 3.8));
  }
  currentY = startBulletY + (midPoint * 3.8) + 3;

  // Subsection: Data Filed with the Regulator
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Data Filed with the Regulator (What You Submit)', margin, currentY);
  currentY += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('The regulator will review and validate the following data as submitted by the client:', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item', 'Description']],
    body: [
      ['Declared Intake Volumes', 'Total milk/produce intake reported'],
      ['Declared Sales Volumes', 'Total local sales reported'],
      ['Reporting Period', 'Month and year of submission'],
      ['Prices Declared', 'Buying and selling prices'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 7.8,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3.5;

  // Notes under C
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Note: Absence or inconsistency of records may affect compliance assessment/outcomes.', margin, currentY);
  currentY += 3.5;

  const note2 = 'All records must be maintained and made available at the premises for inspection. Each branch outlet/premise shall retain copies of its individual records for at least three (3) months preceding the current month.';
  const splitNote2 = doc.splitTextToSize(note2, contentWidth);
  doc.text(splitNote2, margin, currentY);

  // Footer for Page 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Page 1 of 2  •  Kenya Dairy Board Premise Inspection Scope Disclosure', pageWidth / 2, 290, { align: 'center' });


  // --- PAGE 2 ---
  doc.addPage();
  currentY = 14;

  // Header on Page 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('KDB Premise Inspection Scope Disclosure (Cont.)', pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // Section D: Compliance Checks Performed
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('D. Compliance Checks Performed', margin, currentY);
  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Compliance Area', 'What Is Assessed']],
    body: [
      ['Licensing Compliance', 'Validity, category and display of permit on premise'],
      ['Hygiene Standards', 'Cleanliness vs regulatory requirements'],
      ['Milk Quality', 'Handling and testing procedures'],
      ['Structural Compliance', 'Premise layout vs approved standards'],
      ['Equipment Suitability', 'Food-grade and operational condition'],
      ['Traceability', 'Ability to track milk movement'],
      ['Record Consistency', 'Records vs actual operations'],
      ['Public Health Standards', 'Compliance with safety requirements'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Section E: Reconciliation Checks Performed
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('E. Reconciliation Checks Performed', margin, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('The regulator may reconcile:', margin, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Reconciliation Area', 'What Is Compared']],
    body: [
      ['Volume Reconciliation', 'Declared intake vs verified intake'],
      ['Sales Reconciliation', 'Declared sales vs records'],
      ['Capacity Check', 'Volume per day vs operational capacity'],
      ['Period Consistency', 'Daily, monthly, and cumulative figures'],
      ['Price Consistency', 'Prices vs records and market norms'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // Section F: Possible Outcomes of Inspection
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('F. Possible Outcomes of Inspection', margin, currentY);
  currentY += 4;

  const outcomes = [
    'Confirmation of compliance',
    'Confirmation of declared data',
    'Identification of non-compliance issues (e.g. under-declared volumes, variances,)',
    'Requirement to adjust future returns',
    'Issuance of corrective actions/inspection orders/closure notices',
    'Suspension or conditional operation (where applicable)',
    'Recommendation for enforcement action',
    'Follow-up inspection'
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const outColWidth = (contentWidth - 6) / 2;
  const startOutY = currentY;

  // Column 1
  let col1Y = startOutY;
  // Item 0
  doc.text(`[X]  ${outcomes[0]}`, margin + 2, col1Y);
  col1Y += 4.2;
  // Item 1
  doc.text(`[X]  ${outcomes[1]}`, margin + 2, col1Y);
  col1Y += 4.2;
  // Item 2 (Line 861): Wrap text for this line only to prevent overlapping with Column 2 (Line 865)
  const wrappedItem2 = doc.splitTextToSize(outcomes[2], outColWidth - 10);
  doc.text(`[X]  ${wrappedItem2[0]}`, margin + 2, col1Y);
  col1Y += 3.4;
  if (wrappedItem2.length > 1) {
    doc.text(`       ${wrappedItem2.slice(1).join(' ')}`, margin + 2, col1Y);
    col1Y += 4.2;
  } else {
    col1Y += 0.8;
  }
  // Item 3
  doc.text(`[X]  ${outcomes[3]}`, margin + 2, col1Y);
  col1Y += 4.2;

  // Column 2
  let col2Y = startOutY;
  for (let i = 4; i < outcomes.length; i++) {
    doc.text(`[X]  ${outcomes[i]}`, margin + outColWidth + 4, col2Y);
    col2Y += 4.2;
  }

  currentY = Math.max(col1Y, col2Y) + 4;

  // Section G: Licensee Acknowledgement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('G. Licensee Acknowledgement', margin, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('I/We acknowledge that we understand the scope of inspection and compliance requirements as outlined above.', margin, currentY);
  currentY += 6;

  // Section G Details Box
  const boxX = margin;
  const boxY = currentY;
  const boxWidth = contentWidth;
  const boxHeight = 36;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'FD');

  const halfWidth = boxWidth / 2;

  // Name & Designation Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Name:', boxX + 4, boxY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signerName || '....................................................................', boxX + 16, boxY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('Designation:', boxX + halfWidth + 4, boxY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signerDesignation || '....................................................................', boxX + halfWidth + 26, boxY + 7);

  // Signature & Date Row
  doc.setFont('helvetica', 'bold');
  doc.text('Signature:', boxX + 4, boxY + 22);

  if (data.signature) {
    try {
      doc.addImage(data.signature, 'PNG', boxX + 22, boxY + 11, 48, 18);
    } catch (_) {
      doc.setFont('helvetica', 'italic');
      doc.text('[Signed Digitally]', boxX + 22, boxY + 22);
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('....................................................................', boxX + 22, boxY + 22);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', boxX + halfWidth + 4, boxY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(data.signedDate || '....................................................................', boxX + halfWidth + 15, boxY + 22);

  // Page 2 Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Page 2 of 2  •  Kenya Dairy Board Premise Inspection Scope Disclosure', pageWidth / 2, 290, { align: 'center' });

  return doc;
};
