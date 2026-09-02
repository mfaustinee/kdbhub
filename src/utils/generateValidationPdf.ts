import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FIELD_CHECKLIST_SECTIONS } from '../../components/fieldChecklistData';

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

export const generateValidationPdfDataUri = async (data: any, globalUnit: string = 'L'): Promise<string> => {
  const doc = new jsPDF();
  let currentY = 130;

  try {
    const logo = await getCachedLogo();
    if (logo) {
      doc.addImage(logo, 'PNG', 85, 10, 40, 25);
    }
  } catch (e) {
    console.warn("Could not load KDB logo for PDF", e);
  }

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > 275) {
      doc.addPage();
      currentY = 20;
      return true;
    }
    return false;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatNum = (val: any) => {
    if (val === undefined || val === null || val === '') return '-';
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    if (isNaN(num)) return String(val);
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const writeField = (label: string, value: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(` ${value || ''}`, x + labelWidth, y);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Data Validation Form", 105, 45, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(45, 47, 165, 47);
  doc.setFont("helvetica", "normal");

  // SECTION 1: General Information
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. General Information:", 20, 58);
  doc.setFont("helvetica", "normal");

  doc.setFontSize(9);
  writeField("Branch:", data.branch || data.county || 'Kericho', 20, 66);
  writeField("Date:", formatDate(data.date), 110, 66);
  writeField("Start Time:", data.startTime || '', 20, 74);
  writeField("End Time:", data.endTime || '', 110, 74);

  writeField("Dairy Business Operator (DBO) Name:", data.dboName || '', 20, 84);
  writeField("Premise Name:", data.premiseName || '', 20, 92);
  writeField("Category:", data.category || '', 20, 100);
  writeField("Permit No:", data.permitNo || '', 110, 100);
  writeField("Contacts:", data.contacts || '', 20, 108);
  writeField("Expiry Date:", formatDate(data.expiryDate), 110, 108);
  writeField("Location:", data.location || '', 20, 116);
  writeField("County:", data.county || '', 110, 116);
  writeField("Validation Period:", data.validationPeriod || '', 20, 124);

  currentY = 134;

  // SECTION 2: Records & Traceability
  checkPageBreak(35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2. Records & Traceability:", 20, currentY);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Detail', 'Value']],
    body: [
      ['Records & Traceability Status', data.traceability || 'No'],
      ['Nature of Produce?', Array.isArray(data.natureOfProduce) ? data.natureOfProduce.join(', ') : (data.natureOfProduce || 'Raw Milk')],
      ['Source', data.source || 'Direct from Farmers'],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' }
  });
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Optional Field Records Checklist (rendered when checklist items are evaluated)
  if (data.fieldChecklist && Object.keys(data.fieldChecklist).length > 0) {
    FIELD_CHECKLIST_SECTIONS.forEach(sec => {
      const secEvaluatedItems: Array<[string, string, string, string, string]> = [];
      sec.items.forEach(item => {
        const entry = data.fieldChecklist?.[item.ref];
        if (entry && (entry.status || (entry.notes && entry.notes.trim() !== ''))) {
          const subGroupLabel = item.subGroup ? `[${item.subGroup}]\n` : '';
          secEvaluatedItems.push([
            item.ref,
            `${subGroupLabel}${item.dataItem || item.title}\n${item.validationTest || item.description}`,
            `${item.primarySource || '-'}\n[Evidence: ${item.evidenceDetail || '-'}]`,
            entry.status || 'Evaluated',
            entry.notes || '-'
          ]);
        }
      });

      if (secEvaluatedItems.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const rangeLabel = sec.items.length > 0 ? ` (${sec.items[0]?.ref} – ${sec.items[sec.items.length - 1]?.ref})` : '';
        doc.text(`Section ${sec.sectionNumber}: ${sec.title} Checklist & Reconciliation${rangeLabel}:`, 20, currentY);
        doc.setFont("helvetica", "normal");

        autoTable(doc, {
          startY: currentY + 4,
          head: [['Ref', 'Data Item & Validation Test', 'Primary Source & Evidence', 'Record/Result Status', 'Observations & Notes']],
          body: secEvaluatedItems,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 14, fontStyle: 'bold' },
            1: { cellWidth: 62 },
            2: { cellWidth: 42 },
            3: { cellWidth: 30 },
            4: { cellWidth: 27 }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
    });
  }

  // SECTION 2(a): Exception Register Table
  if (Array.isArray(data.exceptionRegister) && data.exceptionRegister.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2(a). Exception Register (Discrepancies & Mismatches Tracked):", 20, currentY);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Type', 'Definition', 'Example', 'Source', 'Owner', 'Due Date', 'Resolution Evidence', 'Status']],
      body: data.exceptionRegister.map((exc: any) => [
        exc.type || '-',
        exc.definition || '-',
        exc.example || '-',
        exc.source || '-',
        exc.owner || '-',
        exc.dueDate || '-',
        exc.resolutionEvidence || '-',
        exc.status || 'Open'
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 32 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 18 },
        6: { cellWidth: 24 },
        7: { cellWidth: 12, fontStyle: 'bold' }
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // SECTION 2 (b): Volume & Sales Data
  checkPageBreak(35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2 (b). Volume & Sales Data:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 2;

  // Intakes Table
  if ((data.category === 'CP>5,000 L/D' || data.category === 'CP<5,000 L/D' || data.category === 'Processor') && Array.isArray(data.intakes) && data.intakes.length > 0) {
    checkPageBreak(25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Total Monthly Intakes", 20, currentY + 2);
    doc.setFont("helvetica", "normal");
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Month/Year', `Qty (${globalUnit})`, 'Farmer Price (Kshs)', 'Processor', 'Proc. Price (Kshs)', `Avg Collection/Day (${globalUnit}/Day)`]],
      body: data.intakes.map((i: any) => [
        `${i.month} ${i.year}`, 
        formatNum(i.quantity), 
        formatNum(i.farmerPrice), 
        i.processor || '-', 
        formatNum(i.processorPrice), 
        formatNum(i.avgVolPerDay)
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Sales Table
  const sales = Array.isArray(data.sales) ? data.sales : [];
  if (data.hasLocalSales !== false && sales.length > 0) {
    checkPageBreak(25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Local Sales Data", 20, currentY + 2);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Month/Year', `Declared (${globalUnit})`, `Witnessed (${globalUnit})`, `Projected (${globalUnit})`, `Under Declared (${globalUnit})`, 'Buying Price (Kshs)', 'Selling Price (Kshs)', `Avg Vol/Day (${globalUnit}/Day)`]],
      body: sales.map((s: any) => [
        `${s.month} ${s.year}`, 
        formatNum(s.qtyDeclared || '0'), 
        formatNum(s.verifiedQty || '0'), 
        formatNum(s.projectedQty || '0'), 
        formatNum(s.underDeclared || '0'), 
        formatNum(s.buyingPrice || '0'), 
        formatNum(s.sellingPrice || '0'), 
        formatNum(s.avgVolPerDay || '0')
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Distribution Details Table
  if ((data.category === 'Mini Dairy' || data.category === 'Cottage Industry') && (Array.isArray(data.distributors) || data.distName)) {
    const distributors = Array.isArray(data.distributors) && data.distributors.length > 0
      ? data.distributors
      : [{
          name: data.distName,
          contacts: data.distContacts,
          volPerDay: data.distVolPerDay,
          permitNo: data.distPermitNo,
          areaOfSale: data.distAreaOfSale,
          outlets: data.distOutlets,
          natureOfProduce: data.distNatureOfProduce,
          prices: { [data.distNatureOfProduce?.[0] || 'Produce']: data.distPrice }
        }];

    distributors.forEach((dist: any, dIdx: number) => {
      checkPageBreak(55);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Distributor Details #${dIdx + 1}: ${dist.name || 'Unnamed'}`, 20, currentY + 2);
      doc.setFont("helvetica", "normal");

      const outletsText = Array.isArray(dist.outlets) && dist.outlets.length > 0
        ? dist.outlets.map((o: any, index: number) => `#${index+1}: Loc: ${o.location || 'N/A'}, Vol: ${o.volPerDay || 'N/A'}, Permit: ${o.permitStatus || 'N/A'}, Levy: ${o.levyInfo || 'N/A'}`).join('\n')
        : 'None';

      const natureText = Array.isArray(dist.natureOfProduce) ? dist.natureOfProduce.join(', ') : 'N/A';
      const pricesText = dist.prices && Object.keys(dist.prices).length > 0
        ? Object.entries(dist.prices).map(([prod, price]) => `${prod}: ${formatNum(price)}`).join(', ')
        : (formatNum(data.distPrice) || 'N/A');

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Field', 'Detail']],
        body: [
          ['Distributor Name', dist.name || 'N/A'],
          ['Distributor Contacts', dist.contacts || 'N/A'],
          ['Volume per Day', formatNum(dist.volPerDay) || 'N/A'],
          ['Permit Number', dist.permitNo || 'N/A'],
          ['Area of Sale', dist.areaOfSale || 'N/A'],
          ['Nature of Produce', natureText],
          ['Prices (Kshs)', pricesText],
          ['List of Outlets', outletsText]
        ],
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 120 }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  }

  // SECTION 3: Compliance & Confirmation -> Under-Declaration & Statutory CSL Arrears Schedule
  const nonCompliance = Array.isArray(data.nonCompliance) ? data.nonCompliance : [];
  
  checkPageBreak(35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("3. Compliance & Confirmation:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 2;

  checkPageBreak(25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Under-Declaration & Statutory CSL Arrears Schedule", 20, currentY + 2);
  doc.setFont("helvetica", "normal");

  if (nonCompliance.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(0, 128, 0);
    doc.text("No under-declaration was witnessed.", 20, currentY + 8);
    doc.setTextColor(0, 0, 0);
    currentY += 15;
  } else {
    const totalPenalty = nonCompliance.reduce((sum: number, nc: any) => {
      const amt = parseFloat(String(nc.amount || '0').replace(/,/g, '')) || 0;
      return sum + amt;
    }, 0);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['CSL Period (Month/Year)', globalUnit === 'L' ? 'Litres' : 'Kilograms', 'Recalculated Amount (Kshs)', 'Month/Year to Pay', 'MPESA REF']],
      body: [
        ...nonCompliance.map((nc: any) => [
          nc.month || '', 
          formatNum(nc.litres) || '', 
          formatNum(nc.amount) || '0.00', 
          nc.paymentMonthYear || '', 
          nc.mpesaRef || ''
        ]),
        [
          { content: 'TOTAL', styles: { fontStyle: 'bold' } }, 
          '', 
          { content: totalPenalty.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { fontStyle: 'bold' } }, 
          '', 
          ''
        ]
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // SECTION 4: Comments & Recommended Corrective Actions
  checkPageBreak(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("4. Comments & Recommended Corrective Actions:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 6;

  if (data.comments) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Inspector Observations & Comments:", 20, currentY);
    doc.setFont("helvetica", "normal");
    const splitComments = doc.splitTextToSize(data.comments, 170);
    doc.text(splitComments, 20, currentY + 4);
    currentY += Math.max(splitComments.length * 4.5, 6) + 4;
  }

  if (data.recommendedActions) {
    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Recommended Corrective Actions & Directives:", 20, currentY);
    doc.setFont("helvetica", "normal");
    const splitActions = doc.splitTextToSize(data.recommendedActions, 170);
    doc.text(splitActions, 20, currentY + 4);
    currentY += Math.max(splitActions.length * 4.5, 6) + 4;

    if (data.actionDueDate || data.actionOwner) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      const metaText = `Remediation Due Date: ${data.actionDueDate || 'N/A'}  |  Responsible Party: ${data.actionOwner || 'DBO Representative'}`;
      doc.text(metaText, 20, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 6;
    }
  }

  if (!data.comments && !data.recommendedActions) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("No specific corrective directives or remarks noted.", 20, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 6;
  }

  currentY += 4;

  // SECTION 5: Declarations
  checkPageBreak(45);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("5. Declarations:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 7;

  const hasUnderDeclaration = sales.some((sale: any) => (parseFloat(String(sale.underDeclared || '0').replace(/,/g, '')) || 0) > 0);
  const declarationTexts = [
    "I/We confirm that the information provided is true and accurate to the best of my/our knowledge.",
    ...(hasUnderDeclaration ? ["I/We understand that under-declaration of milk volumes is an offense under the Dairy Industry Act and agree to pay the calculated under declared volumes and monies within the specified periods."] : []),
    "I/We confirm that I/We have been informed/presented with, read and understood the KDB Premise Inspection Scope Disclosure, including the legal obligations to maintain records and traceability of the same as stipulated under the Dairy Industry Act (Cap 336), Laws of Kenya."
  ];

  declarationTexts.forEach((text, i) => {
    const splitText = doc.splitTextToSize(text, 164);
    const itemHeight = Math.max(splitText.length * 5.5, 7);
    checkPageBreak(itemHeight + 3);

    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(splitText, 26, currentY);
    currentY += itemHeight + 2;
  });
  currentY += 3;

  // Signatures
  checkPageBreak(45);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Signatures & Authorization:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 6;

  doc.text(`Compliance Officer: ${data.complianceOfficer || ''}`, 20, currentY);
  if (data.complianceSignature && typeof data.complianceSignature === 'string' && data.complianceSignature.startsWith('data:image')) {
    try {
      const format = data.complianceSignature.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(data.complianceSignature, format, 20, currentY + 2, 40, 15);
    } catch (e) {
      console.error('Error adding compliance signature:', e);
    }
  }

  doc.text(`For DBO; Name: ${data.confirmationName || ''} (${data.designation || ''})`, 110, currentY);
  if (data.dboSignature && typeof data.dboSignature === 'string' && data.dboSignature.startsWith('data:image')) {
    try {
      const format = data.dboSignature.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(data.dboSignature, format, 110, currentY + 2, 40, 15);
    } catch (e) {
      console.error('Error adding DBO signature:', e);
    }
  }

  return doc.output('datauristring');
};
