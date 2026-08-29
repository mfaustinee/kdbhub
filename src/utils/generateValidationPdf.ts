import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  doc.setFontSize(10);
  writeField("Branch:", data.branch || data.county || 'Kericho', 20, 65);
  writeField("Date:", formatDate(data.date), 20, 73);
  writeField("Start Time:", data.startTime || '', 20, 81);
  writeField("End Time:", data.endTime || '', 20, 89);

  writeField("Dairy Business Operator (DBO) Name:", data.dboName || '', 20, 101);
  writeField("Premise Name:", data.premiseName || '', 20, 109);
  writeField("Category:", data.category || '', 20, 117);
  writeField("Permit No:", data.permitNo || '', 110, 117);
  writeField("Contacts:", data.contacts || '', 20, 125);
  writeField("Expiry Date:", formatDate(data.expiryDate), 110, 125);
  writeField("Location:", data.location || '', 20, 133);
  writeField("County:", data.county || '', 110, 133);
  writeField("Validation Period:", data.validationPeriod || '', 20, 141);

  currentY = 150;

  // Intakes Table
  if ((data.category === 'CP>5,000 L/D' || data.category === 'CP<5,000 L/D' || data.category === 'Processor') && Array.isArray(data.intakes) && data.intakes.length > 0) {
    checkPageBreak(25);
    doc.setFontSize(12);
    doc.text("Total Monthly Intakes", 20, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Month/Year', `Qty (${globalUnit})`, 'Farmer Price', 'Processor', 'Proc. Price', `Avg Collection/Day (${globalUnit}/Day)`]],
      body: data.intakes.map((i: any) => [`${i.month} ${i.year}`, i.quantity, i.farmerPrice, i.processor, i.processorPrice, i.avgVolPerDay]),
      styles: { fontSize: 8 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Sales Table
  const sales = Array.isArray(data.sales) ? data.sales : [];
  if (data.hasLocalSales !== false && sales.length > 0) {
    checkPageBreak(25);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Local Sales Data", 20, currentY);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Month/Year', `Declared (${globalUnit})`, `Witnessed/Verified (${globalUnit})`, `Projected (${globalUnit})`, `Under Declared (${globalUnit})`, 'Buying Price', 'Selling Price', `Avg Vol/Day (${globalUnit}/Day)`]],
      body: sales.map((s: any) => [`${s.month} ${s.year}`, s.qtyDeclared || '0', s.verifiedQty || '0', s.projectedQty || '0', s.underDeclared || '0', s.buyingPrice || '0', s.sellingPrice || '0', s.avgVolPerDay || '0']),
      styles: { fontSize: 7 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
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
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Distributor Details #${dIdx + 1}: ${dist.name || 'Unnamed'}`, 20, currentY);
      doc.setFont("helvetica", "normal");

      const outletsText = Array.isArray(dist.outlets) && dist.outlets.length > 0
        ? dist.outlets.map((o: any, index: number) => `#${index+1}: Loc: ${o.location || 'N/A'}, Vol: ${o.volPerDay || 'N/A'}, Permit: ${o.permitStatus || 'N/A'}, Levy: ${o.levyInfo || 'N/A'}`).join('\n')
        : 'None';

      const natureText = Array.isArray(dist.natureOfProduce) ? dist.natureOfProduce.join(', ') : 'N/A';
      const pricesText = dist.prices && Object.keys(dist.prices).length > 0
        ? Object.entries(dist.prices).map(([prod, price]) => `${prod}: ${price}`).join(', ')
        : (data.distPrice || 'N/A');

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Field', 'Detail']],
        body: [
          ['Distributor Name', dist.name || 'N/A'],
          ['Distributor Contacts', dist.contacts || 'N/A'],
          ['Volume per Day', dist.volPerDay || 'N/A'],
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
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });
  }

  // Summary Data
  checkPageBreak(35);
  autoTable(doc, {
    startY: currentY + 5,
    head: [['Detail', 'Value']],
    body: [
      ['Are Traceability & Records Available', data.traceability || 'No'],
      ['Nature of Produce?', Array.isArray(data.natureOfProduce) ? data.natureOfProduce.join(', ') : (data.natureOfProduce || 'Raw Milk')],
      ['Source', data.source || 'Direct from Farmers'],
    ],
    styles: { fontSize: 8 }
  });
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Compliance Section
  const nonCompliance = Array.isArray(data.nonCompliance) ? data.nonCompliance : [];
  checkPageBreak(25);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance Commitment:", 20, currentY);
  doc.setFont("helvetica", "normal");

  if (nonCompliance.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(0, 128, 0);
    doc.text("No under-declaration was witnessed.", 20, currentY + 7);
    doc.setTextColor(0, 0, 0);
    currentY += 15;
  } else {
    const totalPenalty = nonCompliance.reduce((sum: number, nc: any) => sum + (parseFloat(nc.amount) || 0), 0);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['CSL Period (Month/Year)', globalUnit === 'L' ? 'Litres' : 'Kilograms', 'Amount (Kshs)', 'Month/Year to Pay', 'MPESA REF']],
      body: [
        ...nonCompliance.map((nc: any) => [nc.month || '', nc.litres || '', nc.amount || '', nc.paymentMonthYear || '', nc.mpesaRef || '']),
        [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, '', { content: totalPenalty.toFixed(2), styles: { fontStyle: 'bold' } }, '', '']
      ],
      styles: { fontSize: 8 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  if (data.comments) {
    checkPageBreak(25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Comments:", 20, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(data.comments, 20, currentY + 5, { maxWidth: 170 });
    currentY += 20;
  }

  // Declarations
  checkPageBreak(45);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Declarations:", 20, currentY);
  doc.setFont("helvetica", "normal");
  currentY += 7;

  const hasUnderDeclaration = sales.some((sale: any) => (parseFloat(sale.underDeclared) || 0) > 0);
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
  doc.setFontSize(11);
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
