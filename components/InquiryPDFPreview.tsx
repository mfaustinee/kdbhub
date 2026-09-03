import React from 'react';
import { InquiryData } from '../types';
import { Printer, X, Download, HelpCircle } from 'lucide-react';
import { downloadInquiryPDF } from '../services/pdf.ts';

interface InquiryPDFPreviewProps {
  inquiry: InquiryData;
  onClose: () => void;
  isHidden?: boolean;
}

interface InquiryPDFContentProps {
  inquiry: InquiryData;
  id?: string;
}

const clientTypesList = [
  'Dairy Farmer',
  'Milk Transporter',
  'Milk Processor',
  'Milk Vendor/Trader',
  'Cooperative Society',
  'Equipment Supplier',
  'Exporter/Importer',
  'Prospective Investor',
  'Member of Public',
  'Other'
];

const inquiryNaturesList = [
  'Licensing & Registration',
  'License Renewal',
  'Compliance Requirements',
  'Inspection & Certification',
  'Dairy Imports/Exports',
  'Market Information',
  'Training & Capacity Building',
  'Complaint Submission',
  'Product Standards',
  'Other'
];

const preferredModesList = [
  'Email',
  'Phone Call',
  'In-person Appointment',
  'Written Letter'
];

const docStatusesList = [
  'Attached',
  'To be submitted later',
  'None'
];

const InquiryPDFContent: React.FC<InquiryPDFContentProps> = ({ inquiry, id }) => {
  const formattedDate = new Date(inquiry.submittedAt || Date.now()).toLocaleDateString('en-GB', {
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
      <div className="flex flex-col items-center text-center mb-8 pt-6 break-inside-avoid" style={{ borderBottom: '2px solid #0f172a', paddingBottom: '16px' }}>
        <div className="space-y-1 w-full flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-center w-full" style={{ color: '#1e293b' }}>
            KENYA DAIRY BOARD
          </h1>
        </div>
      </div>

      {/* Document Title */}
      <div className="w-full flex justify-center text-center mb-6">
        <h2 className="text-lg font-bold mt-2 uppercase underline underline-offset-4 text-center" style={{ color: '#0f172a' }}>
          CLIENT INQUIRY FORM
        </h2>
      </div>

      {/* Official Reference & Metadata Box */}
      <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-300 mb-6 text-xs font-semibold">
        <div>
          <span className="text-slate-500 block uppercase text-[9px] font-bold">Inquiry Ref No.</span>
          <span className="font-mono font-bold text-slate-800">{inquiry.id}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[9px] font-bold">Submission Date</span>
          <span className="font-bold text-slate-800">{formattedDate}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase text-[9px] font-bold">Processing Status</span>
          <span className="font-bold uppercase text-slate-800">{inquiry.status || 'Submitted'}</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Section 1: Client Information */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            1. Client / Applicant Information
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11pt]">
            <p><strong>Full Name / Company Name:</strong> {inquiry.clientName}</p>
            <p><strong>Contact Person:</strong> {inquiry.contactPerson || 'N/A'}</p>
            <p><strong>ID / Passport No:</strong> {inquiry.idPassportNo || 'N/A'}</p>
            <p><strong>KDB License Number:</strong> {inquiry.kdbLicenseNo || 'N/A'}</p>
            <p><strong>Postal Address:</strong> {inquiry.postalAddress || 'N/A'}</p>
            <p><strong>City / Town:</strong> {inquiry.cityTown || 'N/A'}</p>
            <p><strong>Telephone Number:</strong> {inquiry.tel || 'N/A'}</p>
            <p><strong>Mobile Number:</strong> {inquiry.mobileNumber || inquiry.tel || 'N/A'}</p>
            <p className="col-span-2"><strong>Email Address:</strong> {inquiry.email}</p>
          </div>
        </section>

        {/* Section 2: Type of Client (Tick where applicable) */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            2. Type of Client (Tick where applicable)
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
            {clientTypesList.map(type => {
              const isSelected = inquiry.clientType === type;
              const displayLabel = type === 'Other' && isSelected && inquiry.otherClientType 
                ? `Other (${inquiry.otherClientType})` 
                : type;
              return (
                <div key={type} className="flex items-center space-x-2">
                  <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-sky-800' : 'text-slate-400'}`}>
                    {isSelected ? '☑' : '☐'}
                  </span>
                  <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                    {displayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Nature of Inquiry (Tick where applicable) */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            3. Nature of Inquiry (Tick where applicable)
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
            {inquiryNaturesList.map(nature => {
              const isSelected = inquiry.natureOfInquiry === nature;
              const displayLabel = nature === 'Other' && isSelected && inquiry.otherNatureOfInquiry 
                ? `Other (${inquiry.otherNatureOfInquiry})` 
                : nature;
              return (
                <div key={nature} className="flex items-center space-x-2">
                  <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-sky-800' : 'text-slate-400'}`}>
                    {isSelected ? '☑' : '☐'}
                  </span>
                  <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                    {displayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Details of Inquiry */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            4. Details of Inquiry / Request
          </h3>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-[11pt] font-serif italic whitespace-pre-wrap leading-relaxed">
            {inquiry.inquiryDetails || inquiry.message || 'No detailed message provided.'}
          </div>
        </section>

        {/* Section 5: Supporting Documents & Response Preference */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            5. Supporting Documentation & Response Preference
          </h3>
          <div className="grid grid-cols-2 gap-6 text-[11pt]">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-1.5">Supporting Documents (If Any)</p>
              <div className="space-y-1 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
                {docStatusesList.map(status => {
                  const isSelected = (inquiry.supportingDocsStatus || 'None') === status;
                  return (
                    <div key={status} className="flex items-center space-x-2">
                      <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-sky-800' : 'text-slate-400'}`}>
                        {isSelected ? '☑' : '☐'}
                      </span>
                      <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
              {inquiry.supportingDocsStatus === 'Attached' && inquiry.attachedDocsList && (
                <p className="text-xs text-slate-600 mt-2 italic"><strong>List of attached documents:</strong> {inquiry.attachedDocsList}</p>
              )}
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-1.5">Preferred Mode of Response</p>
              <div className="space-y-1 text-[10pt] border p-3 rounded-lg bg-slate-50/50">
                {preferredModesList.map(mode => {
                  const isSelected = inquiry.preferredResponseMode === mode;
                  return (
                    <div key={mode} className="flex items-center space-x-2">
                      <span className={`inline-block text-base leading-none ${isSelected ? 'font-black text-sky-800' : 'text-slate-400'}`}>
                        {isSelected ? '☑' : '☐'}
                      </span>
                      <span className={isSelected ? 'font-bold text-slate-900 underline' : 'text-slate-700'}>
                        {mode}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Official KDB Assessment & Response */}
        <section className="text-left">
          <h3 className="font-bold uppercase mb-2 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            6. Official KDB Response & Resolution Assessment
          </h3>
          <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200 text-[11pt] space-y-2">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <p><strong>Department / Assigned Officer:</strong> {inquiry.departmentAssigned || inquiry.referredTo || 'KDB Compliance & Regulatory Unit'}</p>
              <p><strong>Action Date:</strong> {inquiry.actionDate || inquiry.dateReplied || formattedDate}</p>
            </div>
            <div className="pt-2 border-t border-amber-200">
              <p className="text-[9px] font-bold uppercase text-amber-800">Official Action / Response Remarks:</p>
              <p className="font-serif italic font-semibold text-slate-800 mt-1">
                {inquiry.officialComments || inquiry.responseDetails || inquiry.actionTaken || 'Pending official response and countersign.'}
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Terms & Declaration */}
        <section className="space-y-1 text-left" style={{ fontSize: '10pt', color: '#334155' }}>
          <h3 className="font-bold uppercase mb-1 text-[11pt]" style={{ color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px' }}>
            7. Terms and Declarations
          </h3>
          <p className="mt-1">a) The inquirer confirms that all particulars provided in this form are accurate and complete to the best of their knowledge.</p>
          <p>b) The Kenya Dairy Board shall process inquiries in accordance with the Dairy Industry Act (Cap 336) and official service standards.</p>
          <p>c) This record serves as an official acknowledgment of the inquiry and its official administrative disposition.</p>
        </section>

        {/* Execution Blocks (Side-by-Side) */}
        <div className="pt-6 flex justify-between space-x-8 text-left">
          <div className="flex-1 space-y-2">
            <p className="font-bold pb-1" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
              FOR: KENYA DAIRY BOARD
            </p>
            <div className="space-y-1.5 min-h-[100px]">
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{inquiry.officialName || 'Authorized KDB Officer'}</span></p>
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{inquiry.officialTitle || 'Compliance Officer'}</span></p>
              <div className="py-1 h-16 flex items-center">
                {inquiry.officialSignature ? (
                  <img src={inquiry.officialSignature} className="max-h-full" alt="KDB Signature" crossOrigin="anonymous" />
                ) : (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Awaiting Countersign</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <p className="font-bold pb-1" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
              FOR CLIENT / INQUIRER: {inquiry.clientName}
            </p>
            <div className="space-y-1.5 min-h-[100px]">
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{inquiry.clientName}</span></p>
              <p><span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title:</span> <span className="font-bold" style={{ color: '#0f172a' }}>Applicant / Client</span></p>
              <div className="py-1 h-16 flex items-center">
                {inquiry.clientSignature ? (
                  <img src={inquiry.clientSignature} className="max-h-full" alt="Client Signature" crossOrigin="anonymous" />
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
            DOC_ID: {inquiry.id.toUpperCase()} | GEN_TIME: {new Date().toISOString()}
          </div>
          <div className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>
            Official Document
          </div>
        </div>
      </div>
    </div>
  );
};

export const InquiryPDFPreview: React.FC<InquiryPDFPreviewProps> = ({ inquiry, onClose, isHidden = false }) => {
  const handleDownload = async () => {
    await downloadInquiryPDF(inquiry, `inquiry-form-pdf-${inquiry.id}`);
  };

  if (isHidden) {
    return (
      <div className="absolute left-[-9999px] top-[-9999px] pointer-events-none">
        <InquiryPDFContent inquiry={inquiry} id={`inquiry-form-pdf-${inquiry.id}`} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-3xl max-w-[1080px] w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Controls Bar */}
        <div className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelpCircle className="w-5 h-5 text-sky-400" />
            <span className="text-sm font-bold uppercase tracking-wider">Client Inquiry Document</span>
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
            <InquiryPDFContent inquiry={inquiry} id={`inquiry-form-pdf-${inquiry.id}`} />
          </div>
        </div>
      </div>
    </div>
  );
};
