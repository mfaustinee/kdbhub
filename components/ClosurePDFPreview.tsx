import React from 'react';
import { ClosureNotificationData } from '../types';
import { ShieldCheck, Printer, X, Download } from 'lucide-react';
import { downloadClosurePDF } from '../services/pdf.ts';

interface ClosurePDFPreviewProps {
  closure: ClosureNotificationData;
  onClose: () => void;
  isHidden?: boolean;
}

interface ClosurePDFContentProps {
  closure: ClosureNotificationData;
  id?: string;
}

const ClosurePDFContent: React.FC<ClosurePDFContentProps> = ({ closure, id }) => (
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
        <p className="text-sm font-bold text-center w-full" style={{ color: '#475569' }}>
          REGULATORY & COMPLIANCE DEPARTMENT
        </p>
        <p className="text-xs font-bold text-center w-full" style={{ color: '#64748b' }}>
          Ardhi House (Huduma Centre) 5th Floor, Wing B.
        </p>
        <p className="text-xs font-bold text-center w-full" style={{ color: '#94a3b8' }}>
          Tel: 0717997465 / 0734026367 | Email: regulatory@kdb.co.ke
        </p>
      </div>
      <div className="w-full mt-4"></div>
    </div>

    {/* Document Title */}
    <div className="w-full flex flex-col justify-center text-center mb-6">
      <h2 className="text-lg font-extrabold uppercase underline underline-offset-4 text-center tracking-wide" style={{ color: '#0f172a' }}>
        NOTIFICATION OF DAIRY BUSINESS CESSATION
      </h2>
      <p className="text-xs mt-2 italic font-semibold" style={{ color: '#475569' }}>
        (Submitted under the Provisions of the Dairy Industry Act, Cap 336 Laws of Kenya)
      </p>
    </div>

    <div className="space-y-6">
      <p className="text-left font-medium leading-relaxed" style={{ fontSize: '11pt', color: '#1e293b' }}>
        This serves as formal notification by the registered Dairy Business Operative (DBO) regarding the permanent cessation of dairy operations at the specified premise. The Kenya Dairy Board is hereby formally notified of the decision to decommission the associated permit and premise records.
      </p>

      {/* Operator & Premise Information */}
      <section className="text-left">
        <h3 className="font-extrabold text-[12pt] uppercase pb-1 mb-3" style={{ borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
          1. Operator & Premise Profile
        </h3>
        <table className="w-full border-collapse" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 w-[35%] font-bold text-xs uppercase" style={{ color: '#64748b' }}>Permit Holder Name</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>{closure.dboName}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Regulated Permit Number</td>
              <td className="py-2 font-mono font-bold" style={{ color: '#0f172a' }}>{closure.permitNo}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Registered Premise Name</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>{closure.premiseName}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Permit / Business Type</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>{closure.permitType}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Primary Contact Tel</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>{closure.tel}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Geographic Location</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>
                {closure.location}, {closure.subCounty} Sub-County, {closure.county} County
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Cessation Specifics */}
      <section className="text-left">
        <h3 className="font-extrabold text-[12pt] uppercase pb-1 mb-3" style={{ borderBottom: '1px solid #cbd5e1', color: '#1e293b' }}>
          2. Cessation Details
        </h3>
        <table className="w-full border-collapse" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 w-[35%] font-bold text-xs uppercase" style={{ color: '#64748b' }}>Official Closure Date</td>
              <td className="py-2 font-bold" style={{ color: '#0f172a' }}>{closure.closureDate}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b' }}>Requested Permit Status Intent</td>
              <td className="py-2 font-bold uppercase tracking-wider" style={{ color: '#dc2626' }}>
                {closure.permitStatusIntent}
              </td>
            </tr>
            <tr>
              <td className="py-2 font-bold text-xs uppercase" style={{ color: '#64748b', verticalAlign: 'top' }}>Reason for Cessation</td>
              <td className="py-2 font-medium leading-relaxed italic" style={{ color: '#1e293b' }}>
                {closure.closureReason}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Legal Declaration */}
      <section 
        className="text-left p-4 rounded-xl text-xs font-semibold leading-relaxed" 
        style={{ 
          backgroundColor: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          color: '#475569' 
        }}
      >
        <p className="font-extrabold mb-1 uppercase tracking-wider" style={{ color: '#1e293b' }}>
          Permit Holder Declaration
        </p>
        &quot;I declare that dairy business operations at the indicated premise have ceased as of the official closure date, and this notification has been submitted in good faith under provisions of the Dairy Industry Act. I acknowledge that regulatory permits are strictly non-transferable.&quot;
      </section>

      {/* Counter Signatures */}
      <div className="pt-6 flex justify-between space-x-12 text-left">
        {/* KDB official receipt block */}
        <div className="flex-1 space-y-2">
          <p className="font-bold pb-1 text-xs" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
            RECEIVED BY: KENYA DAIRY BOARD (KDB)
          </p>
          <div className="space-y-1.5 min-h-[100px]">
            <p>
              <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span>{' '}
              <span className="font-bold" style={{ color: '#0f172a' }}>{closure.officialName || '______________________'}</span>
            </p>
            <p>
              <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title (Blank for Official to input):</span>{' '}
              <span className="font-bold" style={{ color: '#0f172a' }}>______________________</span>
            </p>
            <div className="py-1 h-16 flex items-center">
              {closure.officialSignature ? (
                <img src={closure.officialSignature} className="max-h-full" alt="KDB Authorized Counter-Signature" crossOrigin="anonymous" />
              ) : (
                <div className="italic text-xs font-bold uppercase tracking-wider" style={{ color: '#dc2626' }}>
                  Awaiting KDB Official Receipt
                </div>
              )}
            </div>
            {closure.approvedAt && (
              <p>
                <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Received Date:</span>{' '}
                <span className="font-bold text-xs" style={{ color: '#0f172a' }}>{new Date(closure.approvedAt).toLocaleDateString()}</span>
              </p>
            )}
          </div>
        </div>

        {/* DBO signature block */}
        <div className="flex-1 space-y-2">
          <p className="font-bold pb-1 text-xs" style={{ borderBottom: '1px solid #0f172a', color: '#0f172a' }}>
            SUBMITTED BY OPERATOR (PERMIT HOLDER):
          </p>
          <div className="space-y-1.5 min-h-[100px]">
            <p>
              <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Name:</span>{' '}
              <span className="font-bold" style={{ color: '#0f172a' }}>{closure.clientName}</span>
            </p>
            <p>
              <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Title:</span>{' '}
              <span className="font-bold" style={{ color: '#0f172a' }}>Registered DBO Applicant</span>
            </p>
            <div className="py-1 h-16 flex items-center">
              <img src={closure.clientSignature} className="max-h-full" alt="DBO Authorized Signature" crossOrigin="anonymous" />
            </div>
            <p>
              <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Notification Date:</span>{' '}
              <span className="font-bold text-xs" style={{ color: '#0f172a' }}>{new Date(closure.submittedAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="pt-8 flex justify-between items-end" style={{ opacity: 0.5 }}>
        <div className="text-[7.5px] font-mono select-none font-bold" style={{ color: '#64748b' }}>
          CESSATION_ID: {closure.id.toUpperCase()} | SYSTEM_FILED
        </div>
        <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
          KDB Cessation copy
        </div>
      </div>
    </div>
  </div>
);

export const ClosurePDFPreview: React.FC<ClosurePDFPreviewProps> = ({ closure, onClose, isHidden }) => {
  if (isHidden) {
    return (
      <div className="fixed left-[-9999px] top-0 bg-white w-[1024px] overflow-visible h-auto">
        <ClosurePDFContent closure={closure} id="closure-certificate-hidden" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-[1024px] shadow-2xl rounded-none my-8 animate-in zoom-in-95 duration-300 relative">
        <div className="absolute -top-12 right-0 flex space-x-4 print:hidden">
          <button 
            onClick={() => downloadClosurePDF(closure, 'closure-certificate')} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center hover:bg-red-700 shadow-lg"
          >
            <Download className="w-4 h-4 mr-2" /> Download Notification PDF
          </button>
          <button onClick={onClose} className="bg-white/10 text-white p-2 rounded-lg hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ClosurePDFContent closure={closure} id="closure-certificate" />
      </div>
    </div>
  );
};
