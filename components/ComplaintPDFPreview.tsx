import React from 'react';
import { ComplaintData } from '../types';
import { Printer, X, Download, ShieldAlert } from 'lucide-react';
import { downloadComplaintPDF } from '../services/pdf.ts';

interface ComplaintPDFPreviewProps {
  complaint: ComplaintData;
  onClose: () => void;
  isHidden?: boolean;
}

interface ComplaintPDFContentProps {
  complaint: ComplaintData;
  id?: string;
}

const stakeholderCategoriesList = [
  'Farmer',
  'Milk Trader',
  'Processor',
  'Transporter',
  'Cooperative Society',
  'Input Supplier',
  'Distributor',
  'Consumer',
  'Other'
];

const complaintNaturesList = [
  'Licensing Issues',
  'Delayed Services',
  'Quality/Standards Concerns',
  'Inspection/Compliance Issues',
  'Milk Pricing Disputes',
  'Staff Conduct',
  'Corruption or Misconduct',
  'Regulatory Enforcement Concern',
  'Other'
];

const attachmentOptionsList = [
  'License Copy',
  'Payment Receipt',
  'Correspondence (Emails/Letters)',
  'Inspection Report',
  'Photos',
  'Other'
];

const ComplaintPDFContent: React.FC<ComplaintPDFContentProps> = ({ complaint, id }) => {
  const formattedDate = new Date(complaint.submittedAt || Date.now()).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div 
      className="px-10 pb-12 leading-[1.5] text-[12pt] text-left w-[1024px] box-border" 
      id={id} 
      style={{ 
        fontFamily: 'Arial, Helvetica, sans-serif', 
        whiteSpace: 'normal', 
        wordSpacing: 'normal',
        backgroundColor: '#ffffff',
        color: '#0f172a'
      }}
    >
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6 pt-6 break-inside-avoid" style={{ borderBottom: '2px solid #0f172a', paddingBottom: '16px' }}>
        <div className="space-y-1 w-full flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-center w-full" style={{ color: '#1e293b' }}>
            KENYA DAIRY BOARD
          </h1>
        </div>
      </div>

      {/* Document Title */}
      <div className="w-full flex justify-center text-center mb-6">
        <h2 className="text-lg font-bold mt-1 uppercase underline underline-offset-4 text-center" style={{ color: '#0f172a' }}>
          STAKEHOLDER COMPLAINTS FORM
        </h2>
      </div>

      {/* Official Reference & Metadata Block (Top Left Aligned) */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-300 mb-6 text-xs text-left max-w-md">
        <div className="grid grid-cols-[180px_1fr] gap-y-1 items-center">
          <span className="text-slate-600 font-bold">Reference No.:</span>
          <span className="font-mono font-bold text-red-700">{complaint.id}</span>
          
          <span className="text-slate-600 font-bold">Date Received:</span>
          <span className="font-bold text-slate-800">{complaint.dateReceived || formattedDate}</span>
          
          <span className="text-slate-600 font-bold">Received By (KDB Officer):</span>
          <span className="font-bold text-slate-800">{complaint.receivedBy || complaint.officialName || 'Authorized KDB Officer'}</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Section 1: Complainant Details */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            1. Complainant / Stakeholder Information
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11pt] mb-3">
            <p><strong>Full Name / Company Name:</strong> {complaint.clientName}</p>
            <p><strong>ID / Reg. Number:</strong> {complaint.idNumber || 'N/A'}</p>
            <p><strong>Postal Address:</strong> {complaint.postalAddress || 'N/A'}</p>
            <p><strong>Telephone Number:</strong> {complaint.tel}</p>
            <p><strong>Email Address:</strong> {complaint.email}</p>
            <p><strong>County of Operation:</strong> {complaint.county}</p>
          </div>

          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Stakeholder Category (Tick one):</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
              {stakeholderCategoriesList.map(cat => {
                const isSelected = complaint.stakeholderCategory === cat;
                const displayLabel = cat === 'Other' && isSelected && complaint.otherStakeholderCategory
                  ? `Other (${complaint.otherStakeholderCategory})`
                  : cat;
                return (
                  <div key={cat} className="flex items-center space-x-2">
                    <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-red-800' : 'text-slate-400'}`}>
                      {isSelected ? '☑' : '☐'}
                    </span>
                    <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                      {displayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: Particulars of Complaint & Incident */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            2. Particulars of Complaint & Incident
          </h3>

          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Nature of Complaint (Tick one):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
              {complaintNaturesList.map(nature => {
                const isSelected = complaint.natureOfComplaint === nature;
                const displayLabel = nature === 'Other' && isSelected && complaint.otherNatureOfComplaint
                  ? `Other (${complaint.otherNatureOfComplaint})`
                  : nature;
                return (
                  <div key={nature} className="flex items-center space-x-2">
                    <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-red-800' : 'text-slate-400'}`}>
                      {isSelected ? '☑' : '☐'}
                    </span>
                    <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                      {displayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-2 text-[11pt]">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500">Location of Incident</p>
              <p className="font-bold text-slate-800">{complaint.location}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500">Incident Date</p>
              <p className="font-bold text-slate-800">{complaint.incidentDate}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-[11pt] leading-relaxed mt-2">
            <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">
              Detailed Description of Complaint (Provide full details including names, dates, and supporting facts):
            </p>
            <p className="font-serif italic text-slate-800 whitespace-pre-wrap">
              {complaint.complaintDescription || complaint.complaintDetails || 'No detailed description provided.'}
            </p>
          </div>
        </section>

        {/* Section 3: Supporting Documentation & Requested Relief */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            3. Supporting Documentation & Requested Relief
          </h3>
          <div className="grid grid-cols-2 gap-6 text-[11pt]">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Supporting Documents Provided:</p>
              <div className="grid grid-cols-1 gap-y-1.5 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
                {attachmentOptionsList.map(att => {
                  const isChecked = (complaint.attachments || []).includes(att);
                  const displayLabel = att === 'Other' && isChecked && complaint.otherAttachment
                    ? `Other (${complaint.otherAttachment})`
                    : att;
                  return (
                    <div key={att} className="flex items-center space-x-2">
                      <span className={`inline-block text-base leading-none ${isChecked ? 'font-black text-red-800' : 'text-slate-400'}`}>
                        {isChecked ? '☑' : '☐'}
                      </span>
                      <span className={isChecked ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                        {displayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                Desired Resolution (What action would you like Kenya Dairy Board to take?):
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11pt] font-serif italic text-slate-800 min-h-[120px]">
                {complaint.desiredResolution || 'N/A'}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Official KDB Findings, Action & Resolution Assessment */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            4. Official KDB Investigation, Action & Resolution
          </h3>
          <div className="p-4 bg-red-50/40 rounded-lg border border-red-200 text-[11pt] space-y-2">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <p><strong>Category Code:</strong> {complaint.complaintCategoryCode || 'KDB/COMP/' + complaint.id.slice(-4)}</p>
              <p><strong>Assigned Officer/Dept:</strong> {complaint.assignedTo || complaint.receivedBy || 'Inspectorate Unit'}</p>
              <p><strong>Action Date:</strong> {complaint.actionDate || complaint.dateClosed || formattedDate}</p>
            </div>
            {complaint.investigationFindings && (
              <div className="pt-2 border-t border-red-200 text-xs">
                <p className="text-[9px] font-bold uppercase text-red-900">Investigation Findings:</p>
                <p className="font-medium text-slate-800 mt-0.5">{complaint.investigationFindings}</p>
              </div>
            )}
            <div className="pt-2 border-t border-red-200">
              <p className="text-[9px] font-bold uppercase text-red-900">Official Action Taken / Settlement Remarks:</p>
              <p className="font-serif italic font-semibold text-slate-800 mt-1">
                {complaint.officialComments || complaint.actionTaken || complaint.complaintDetails || 'Pending investigation and official countersign.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Terms & Declaration */}
        <section className="space-y-1 text-left" style={{ fontSize: '10pt', color: '#334155' }}>
          <h3 className="font-bold uppercase mb-1 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            5. Terms and Declarations
          </h3>
          <p className="mt-1">a) The complainant declares under oath that the statements made herein are truthful and factual.</p>
          <p>b) The Kenya Dairy Board handles all stakeholder complaints under strict confidentiality and regulatory guidelines.</p>
          <p>c) This document represents the official administrative dossier and formal record of complaint disposition.</p>
        </section>

        {/* Execution Blocks (Side-by-Side) */}
        <div className="pt-6 flex justify-between space-x-8 text-left">
          <div className="flex-1 space-y-2">
            <p className="font-bold pb-1" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
              FOR: KENYA DAIRY BOARD
            </p>
            <div className="space-y-1.5 min-h-[100px]">
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{complaint.officialName || 'Authorized KDB Inspector'}</span></p>
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{complaint.officialTitle || 'Compliance Officer'}</span></p>
              <div className="py-1 h-16 flex items-center">
                {complaint.officialSignature ? (
                  <img src={complaint.officialSignature} className="max-h-full" alt="KDB Signature" crossOrigin="anonymous" />
                ) : (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Awaiting Countersign</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <p className="font-bold pb-1" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
              FOR CLIENT / COMPLAINANT: {complaint.clientName}
            </p>
            <div className="space-y-1.5 min-h-[100px]">
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{complaint.clientNameDeclaration || complaint.clientName}</span></p>
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title:</span> <span className="font-bold" style={{ color: '#0f172a' }}>Complainant / Stakeholder</span></p>
              <div className="py-1 h-16 flex items-center">
                {complaint.clientSignature ? (
                  <img src={complaint.clientSignature} className="max-h-full" alt="Complainant Signature" crossOrigin="anonymous" />
                ) : (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Signed Digitally</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Footer Metadata */}
        <div className="pt-8 flex justify-between items-end" style={{ opacity: 0.5 }}>
          <div className="text-[7.5px] font-mono" style={{ color: '#64748b' }}>
            DOC_ID: {complaint.id.toUpperCase()} | GEN_TIME: {new Date().toISOString()}
          </div>
          <div className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>
            Official Document
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComplaintPDFPreview: React.FC<ComplaintPDFPreviewProps> = ({ complaint, onClose, isHidden = false }) => {
  const handleDownload = async () => {
    await downloadComplaintPDF(complaint, `complaint-form-pdf-${complaint.id}`);
  };

  if (isHidden) {
    return (
      <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none">
        <ComplaintPDFContent complaint={complaint} id={`complaint-form-pdf-${complaint.id}`} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-3xl max-w-[1080px] w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Controls Bar */}
        <div className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <span className="text-sm font-bold uppercase tracking-wider">Stakeholder Complaint Document</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleDownload}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 rounded-xl transition-all flex items-center space-x-2 text-xs font-bold"
              title="Download PDF Document"
            >
              <Download className="w-4 h-4" />
              <span>Download Official PDF</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl transition-all"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Container for Document */}
        <div className="overflow-y-auto flex-1 bg-slate-800 p-8 flex justify-center">
          <div className="shadow-2xl rounded-2xl overflow-hidden bg-white border border-slate-700">
            <ComplaintPDFContent complaint={complaint} id={`complaint-form-pdf-${complaint.id}`} />
          </div>
        </div>
      </div>
    </div>
  );
};
