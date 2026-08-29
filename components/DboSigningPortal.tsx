import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  User, 
  Building2, 
  MapPin, 
  Calendar, 
  PenTool, 
  Trash2, 
  Upload, 
  Eye, 
  X, 
  ExternalLink,
  Lock,
  ArrowRight,
  Loader2,
  Check
} from 'lucide-react';
import { DBService } from '../services/db';
import { ValidationDraft } from '../types';
import { generateValidationPdfDataUri } from '../src/utils/generateValidationPdf';

export const DboSigningPortal: React.FC = () => {
  const { draftId: paramDraftId } = useParams<{ draftId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryDraftId = searchParams.get('id') || searchParams.get('draftId');
  const draftId = paramDraftId || queryDraftId || '';
  const token = searchParams.get('token') || '';
  const expParam = searchParams.get('exp') || '';

  const [draft, setDraft] = useState<ValidationDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Expiration countdown
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isAlreadySigned, setIsAlreadySigned] = useState(false);

  // Form fields for DBO
  const [confirmationName, setConfirmationName] = useState('');
  const [designation, setDesignation] = useState('');
  const [dboSignature, setDboSignature] = useState('');
  const [declarations, setDeclarations] = useState({
    accurate: false,
    offense: false,
    awareness: false
  });

  // State for signature pad
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [isPadEmpty, setIsPadEmpty] = useState(true);

  // PDF Preview
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load Draft
  useEffect(() => {
    let isMounted = true;

    async function fetchDraft() {
      if (!draftId) {
        setErrorMessage("No validation draft ID was provided in the signing link.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await DBService.getValidationDraftById(draftId);
        if (!isMounted) return;

        if (!data) {
          setErrorMessage("Validation draft document could not be found. It may have already been finalized or deleted.");
          setIsLoading(false);
          return;
        }

        setDraft(data);

        // Pre-fill DBO Name if available
        const raw = data.rawData || data.raw_data || {};
        const form = raw.formData || {};
        setConfirmationName(form.confirmationName || data.dboName || data.dbo_name || '');
        setDesignation(form.designation || '');

        if (form.dboSignature) {
          setDboSignature(form.dboSignature);
        }

        // Check if already signed
        if (data.status === 'signed_by_dbo' || data.status === 'submitted' || data.dboSignedAt || raw.dboSignedAt) {
          setIsAlreadySigned(true);
        }

        // Calculate Expiry
        let expiryTimestamp: number | null = null;
        if (expParam) {
          const parsed = Number(expParam);
          if (!isNaN(parsed) && parsed > 0) {
            expiryTimestamp = parsed;
          }
        }
        if (!expiryTimestamp && (data.signingExpiresAt || raw.signingExpiresAt)) {
          const iso = data.signingExpiresAt || raw.signingExpiresAt;
          const parsed = new Date(iso).getTime();
          if (!isNaN(parsed)) {
            expiryTimestamp = parsed;
          }
        }

        if (expiryTimestamp) {
          const now = Date.now();
          const diffSeconds = Math.floor((expiryTimestamp - now) / 1000);
          if (diffSeconds <= 0) {
            setIsExpired(true);
            setRemainingSeconds(0);
          } else {
            setRemainingSeconds(diffSeconds);
          }
        } else {
          // If no expiry parameter provided, default to 5 minutes from load for safety
          setRemainingSeconds(300);
        }
      } catch (err: any) {
        console.error("Error loading draft for signing:", err);
        setErrorMessage("Failed to load validation document. Please check your network connection.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchDraft();

    return () => {
      isMounted = false;
    };
  }, [draftId, expParam]);

  // Interval timer for 5-minute countdown
  useEffect(() => {
    if (remainingSeconds === null || isExpired || isSuccess || isAlreadySigned) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, isExpired, isSuccess, isAlreadySigned]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
    setDboSignature('');
    setIsPadEmpty(true);
  };

  const handleSaveDrawnSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
      setDboSignature(dataUrl);
      setIsPadEmpty(false);
    }
  };

  const handleSignatureFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setDboSignature(result);
        setIsPadEmpty(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPdfPreview = async () => {
    if (!draft) return;
    setIsLoadingPdf(true);
    setShowPdfModal(true);

    try {
      const raw = draft.rawData || draft.raw_data || {};
      const form = raw.formData || {};
      const previewPayload = {
        ...form,
        confirmationName: confirmationName || form.confirmationName || draft.dboName,
        designation: designation || form.designation || 'Dairy Business Operator',
        dboSignature: dboSignature || form.dboSignature || ''
      };

      const pdfDataUri = await generateValidationPdfDataUri(previewPayload, raw.globalUnit || 'L');
      setPdfPreviewUrl(pdfDataUri);
    } catch (e) {
      console.error("Failed to generate draft PDF preview:", e);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isExpired) {
      alert("This signing link has expired (5-minute security limit). Please request the compliance officer to generate a new signing link.");
      return;
    }

    if (!confirmationName.trim()) {
      alert("Please enter your full name as Dairy Business Operator / authorized representative.");
      return;
    }

    if (!designation.trim()) {
      alert("Please enter your designation (e.g., Director, Owner, Manager).");
      return;
    }

    // If signature pad has strokes but user didn't click save button
    let finalSignature = dboSignature;
    if (!finalSignature && sigPadRef.current && !sigPadRef.current.isEmpty()) {
      finalSignature = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
      setDboSignature(finalSignature);
    }

    if (!finalSignature) {
      alert("Please provide your signature on the pad or upload a signature image.");
      return;
    }

    if (!declarations.accurate || !declarations.awareness) {
      alert("Please confirm the mandatory statutory declarations by checking the boxes.");
      return;
    }

    if (!draft) return;

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const raw = draft.rawData || draft.raw_data || {};
      const form = raw.formData || {};

      const updatedFormData = {
        ...form,
        confirmationName: confirmationName.trim(),
        designation: designation.trim(),
        dboSignature: finalSignature
      };

      const updatedRawData = {
        ...raw,
        formData: updatedFormData,
        declarations: {
          ...raw.declarations,
          ...declarations
        },
        dboSignedAt: nowIso,
        signedByDbo: true
      };

      const updatedDraft: ValidationDraft = {
        ...draft,
        status: 'signed_by_dbo',
        dboSignedAt: nowIso,
        dbo_signed_at: nowIso,
        updatedAt: nowIso,
        updated_at: nowIso,
        rawData: updatedRawData,
        raw_data: updatedRawData
      };

      await DBService.saveValidationDraft(updatedDraft);
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Failed to submit DBO signature:", err);
      alert("Failed to submit your signature. Please check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const raw = draft?.rawData || draft?.raw_data || {};
  const form = raw.formData || {};
  const sales = Array.isArray(form.sales) ? form.sales : [];
  const nonCompliance = Array.isArray(form.nonCompliance) ? form.nonCompliance : [];
  const hasUnderDeclaration = sales.some((s: any) => (parseFloat(s.underDeclared) || 0) > 0) || nonCompliance.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Loading Validation Document...</h2>
          <p className="text-xs text-slate-500">Retrieving inspection data from Kenya Dairy Board verification server.</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !draft) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800">Document Unavailable</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (isAlreadySigned && !isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800">Already Signed</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              This validation form has already been signed by the operator and submitted to the Kenya Dairy Board compliance officer.
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1.5 text-xs text-slate-600">
            <div><strong>Operator / DBO:</strong> {draft.dboName || form.dboName}</div>
            <div><strong>Premise:</strong> {draft.premiseName || form.premiseName}</div>
            <div><strong>Permit No:</strong> {draft.permitNo || form.permitNo || 'N/A'}</div>
            {draft.dboSignedAt && (
              <div><strong>Signed At:</strong> {new Date(draft.dboSignedAt).toLocaleString()}</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleOpenPdfPreview}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            <span>View Signed PDF</span>
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Signature Recorded
            </span>
            <h2 className="text-2xl font-black text-slate-900">Successfully Signed & Submitted!</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Thank you, <strong>{confirmationName}</strong>. Your confirmation and signature have been securely logged. The Kenya Dairy Board compliance officer has been notified to complete the final review and cloud sync.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">DBO Name:</span>
              <span className="font-bold">{confirmationName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Designation:</span>
              <span className="font-bold">{designation}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Premise:</span>
              <span className="font-bold">{draft.premiseName || form.premiseName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Validation Period:</span>
              <span className="font-bold">{draft.validationPeriod || form.validationPeriod}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Timestamp:</span>
              <span className="font-mono text-[11px] font-semibold">{new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleOpenPdfPreview}
              className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Draft PDF</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">Kenya Dairy Board</h1>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Operator Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Data Validation Form • DBO Verification & Signing</p>
            </div>
          </div>

          {/* 5-Minute Countdown Badge */}
          <div className="flex items-center gap-2">
            {isExpired ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl border border-rose-200 text-xs font-black">
                <AlertTriangle className="w-4 h-4" />
                <span>Link Expired (5m)</span>
              </div>
            ) : remainingSeconds !== null ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 shadow-2xs">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Expires In</div>
                  <div className="text-xs font-black font-mono">{formatCountdown(remainingSeconds)}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Expiration Notice if Expired */}
        {isExpired && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm">Security Timeout: This 5-minute signing session has expired</h4>
              <p className="text-xs text-rose-700 leading-relaxed">
                For regulatory and data integrity compliance, remote DBO signing links remain active for exactly 5 minutes after issuance. 
                Please contact the Kenya Dairy Board compliance officer to generate a refreshed 5-minute signing link.
              </p>
            </div>
          </div>
        )}

        {/* Premise & Audit Overview Card */}
        <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Inspection Overview</span>
              <h2 className="text-xl font-black text-slate-900">{draft.premiseName || form.premiseName || 'Inspection Draft'}</h2>
              <p className="text-xs text-slate-500 font-medium">
                Permit Number: <strong className="text-slate-800 font-mono">{draft.permitNo || form.permitNo || 'N/A'}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenPdfPreview}
              className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Official Draft PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">DBO Name</div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{draft.dboName || form.dboName || 'N/A'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Category</div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{draft.category || form.category || 'N/A'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Location</div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5">{draft.location || form.location || 'N/A'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Validation Period</div>
              <div className="text-xs font-bold text-blue-700 font-mono mt-0.5">{draft.validationPeriod || form.validationPeriod || 'N/A'}</div>
            </div>
          </div>

          {/* Sales / Witnessed Quantity Breakdown */}
          {sales.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Witnessed Local Sales Data</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Period</th>
                      <th className="p-2.5">Declared Qty</th>
                      <th className="p-2.5">Witnessed Qty</th>
                      <th className="p-2.5">Under-Declared</th>
                      <th className="p-2.5">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((sale: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-800">{sale.month} {sale.year}</td>
                        <td className="p-2.5">{sale.qtyDeclared || '0'} L</td>
                        <td className="p-2.5 font-semibold text-blue-700">{sale.verifiedQty || '0'} L</td>
                        <td className="p-2.5 font-bold">
                          {(parseFloat(sale.underDeclared) || 0) > 0 ? (
                            <span className="text-rose-600 font-bold">+{sale.underDeclared} L</span>
                          ) : (
                            <span className="text-emerald-600">0 L</span>
                          )}
                        </td>
                        <td className="p-2.5">Ksh {sale.sellingPrice || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Non-compliance / Penalty section */}
          {nonCompliance.length > 0 && (
            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Under-Declaration Compliance Commitment Recorded</span>
              </div>
              <p className="text-[11px] text-rose-700">
                The compliance inspection documented an under-declaration penalty totaling{' '}
                <strong>
                  Ksh {nonCompliance.reduce((acc: number, nc: any) => acc + (parseFloat(nc.amount) || 0), 0).toFixed(2)}
                </strong>.
              </p>
            </div>
          )}

          {/* Compliance Officer info */}
          {form.complianceOfficer && (
            <div className="pt-2 text-xs text-slate-500 flex items-center gap-2">
              <span>Inspecting Compliance Officer:</span>
              <strong className="text-slate-800">{form.complianceOfficer}</strong>
              {form.complianceSignature && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Officer Signed
                </span>
              )}
            </div>
          )}
        </section>

        {/* Declarations & Operator Signature Section */}
        <form onSubmit={handleSubmitSignature} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-black tracking-widest text-emerald-600 uppercase">Operator Affirmation</span>
            <h2 className="text-xl font-black text-slate-900">Statutory Declarations & Signature</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Please review the statutory affirmations below, provide your official title, and execute your signature.
            </p>
          </div>

          {/* Mandatory Checkboxes */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                disabled={isExpired}
                checked={declarations.accurate}
                onChange={(e) => setDeclarations(prev => ({ ...prev, accurate: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                <strong>1. Accuracy of Information:</strong> I/We confirm that the information provided in this validation form is true and accurate to the best of my/our knowledge.
              </span>
            </label>

            {hasUnderDeclaration && (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  disabled={isExpired}
                  checked={declarations.offense}
                  onChange={(e) => setDeclarations(prev => ({ ...prev, offense: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>2. Statutory Compliance Agreement:</strong> I/We understand that under-declaration of milk volumes is an offense under the Dairy Industry Act and agree to pay calculated under-declared volumes and monies within specified periods.
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                disabled={isExpired}
                checked={declarations.awareness}
                onChange={(e) => setDeclarations(prev => ({ ...prev, awareness: e.target.checked }))}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-relaxed font-medium">
                <strong>3. Premise Inspection Scope Disclosure:</strong> I/We confirm that I/We have been informed, presented with, read and understood the KDB Premise Inspection Scope Disclosure, including legal obligations to maintain records and traceability under the Dairy Industry Act (Cap 336), Laws of Kenya.
              </span>
            </label>
          </div>

          {/* DBO Name and Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Full Name of DBO / Authorized Representative <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isExpired}
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                placeholder="e.g., Jane Wanjiku Mwangi"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Designation / Capacity <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isExpired}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g., Director / Managing Owner / Accountant"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-xs font-semibold"
              />
            </div>
          </div>

          {/* Signature Canvas Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                DBO Signature <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3 text-xs">
                {dboSignature && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Signature Captured
                  </span>
                )}
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={handleClearSignature}
                  className="text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear Signature
                </button>
              </div>
            </div>

            {dboSignature ? (
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 flex flex-col items-center justify-center relative group">
                <img
                  src={dboSignature}
                  alt="DBO Signature"
                  className="max-h-28 object-contain"
                />
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setDboSignature('')}
                  className="mt-2 text-xs text-rose-600 hover:underline font-bold"
                >
                  Clear and Redraw
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`border-2 border-dashed rounded-2xl p-2 bg-white transition-all ${isExpired ? 'opacity-50 pointer-events-none' : 'border-slate-300 hover:border-emerald-400'}`}>
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="#0f172a"
                    onEnd={handleSaveDrawnSignature}
                    canvasProps={{
                      className: "w-full h-36 rounded-xl cursor-crosshair touch-none",
                      style: { background: '#fafafa' }
                    }}
                  />
                  <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-slate-400 border-t border-slate-100">
                    <span>Draw with your finger or stylus above</span>
                    <button
                      type="button"
                      onClick={handleSaveDrawnSignature}
                      className="font-bold text-emerald-600 hover:underline"
                    >
                      Confirm Signature
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                  <span>Or upload signature image:</span>
                  <label className={`font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1 ${isExpired ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-3 h-3" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isExpired}
                      onChange={handleSignatureFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Submission Button */}
          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || isExpired}
              className={`w-full py-4 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                isExpired
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] cursor-pointer shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Signature...</span>
                </>
              ) : isExpired ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Link Expired — Request New Link</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sign & Submit for Officer Approval</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2.5">
              By submitting, you certify your identity under the Kenya Dairy Industry Act (Cap 336).
            </p>
          </div>
        </form>
      </main>

      {/* PDF Modal Preview */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Official Draft PDF Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 bg-slate-200 relative overflow-hidden">
              {isLoadingPdf ? (
                <div className="h-full flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-600">Rendering official document...</span>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title="PDF Preview"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Unable to display PDF preview.
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Kenya Dairy Board Official Inspection Document
              </span>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
