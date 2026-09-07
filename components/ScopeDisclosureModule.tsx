import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  Download, 
  QrCode, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Building2, 
  Calendar, 
  UserCheck, 
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  PlusCircle,
  FileDown,
  Clock,
  X,
  Printer,
  Lock,
  Eye,
  EyeOff,
  Smartphone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DBService } from '../services/db';
import { LicensedClient, ScopeDisclosureRecord } from '../types';
import { SignaturePad } from './SignaturePad';
import { generateScopeDisclosurePdfDoc } from '../src/utils/generateScopeDisclosurePdf';

interface ScopeDisclosureModuleProps {
  initialPremiseName?: string;
  initialClientName?: string;
  initialPermitNo?: string;
  initialLocation?: string;
  initialCategory?: string;
  isStandalone?: boolean;
  isAdmin?: boolean;
  onSignedSuccess?: (record: ScopeDisclosureRecord) => void;
  onClose?: () => void;
}

export const ScopeDisclosureModule: React.FC<ScopeDisclosureModuleProps> = ({
  initialPremiseName,
  initialClientName,
  initialPermitNo,
  initialLocation,
  initialCategory,
  isStandalone = false,
  isAdmin,
  onSignedSuccess,
  onClose
}) => {
  // Only admins can see the Premise Search and Signed Registry. Remote signers via QR/link never see search.
  const userIsAdmin = Boolean(isAdmin && !isStandalone);

  // Navigation tabs within module (non-admin clients only ever see 'form')
  const [activeSubTab, setActiveSubTab] = useState<'form' | 'registry'>('form');

  // Clients & Disclosures Data
  const [clients, setClients] = useState<LicensedClient[]>([]);
  const [disclosures, setDisclosures] = useState<ScopeDisclosureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Timer for QR Code and generated link: '20min' (Standard 20-minute validity) or 'no_timer' (Continuous / No Expiry)
  const [qrTimerMode, setQrTimerMode] = useState<'20min' | 'no_timer'>('20min');
  const [qrExpiresAt, setQrExpiresAt] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(20 * 60);

  // Client Session Expiration (client-side via URL ?exp=...)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<ScopeDisclosureRecord>>({
    id: '',
    dboName: initialClientName || '',
    permitNo: initialPermitNo || '',
    premiseName: initialPremiseName || '',
    location: initialLocation || '',
    category: initialCategory || '',
    signerName: '',
    signerDesignation: '',
    signature: '',
    signedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
    status: 'draft'
  });

  // Client search & Premise selection
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // Privacy masking state for QR code & URL (same logic as Data Validation remote signing)
  const [isQrMasked, setIsQrMasked] = useState(true);
  const [isUrlMasked, setIsUrlMasked] = useState(true);

  // Reset/refresh QR 20-minute timer
  const resetQrTimer = () => {
    const newExp = Date.now() + 20 * 60 * 1000;
    setQrExpiresAt(newExp);
    setQrSecondsLeft(20 * 60);
  };

  const openQrModal = () => {
    if (qrExpiresAt - Date.now() < 60 * 1000) {
      resetQrTimer();
    }
    setShowQrModal(true);
  };

  // Helper to format countdown seconds MM:SS
  const formatTimer = (totalSecs: number) => {
    const clamped = Math.max(0, totalSecs);
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Interval for inspector's QR Modal countdown
  useEffect(() => {
    if (!showQrModal) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrExpiresAt - Date.now()) / 1000));
      setQrSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [showQrModal, qrExpiresAt]);

  // Interval for client-side remote session countdown (if exp param exists)
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const checkTimer = () => {
      const remaining = Math.floor((sessionExpiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsSessionExpired(true);
        setSessionSecondsLeft(0);
      } else {
        setSessionSecondsLeft(remaining);
      }
    };
    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // Load clients and existing disclosures
  const loadData = async () => {
    setLoading(true);
    try {
      if (userIsAdmin) {
        const [fetchedClients, fetchedDisclosures] = await Promise.all([
          DBService.getClients(),
          DBService.getScopeDisclosures()
        ]);
        setClients(fetchedClients || []);
        setDisclosures(fetchedDisclosures || []);
      } else {
        // For non-admin remote signing via QR or link: do NOT fetch client registry or other signed records
        setClients([]);
        setDisclosures([]);
      }
    } catch (e) {
      console.warn('Error loading scope disclosure data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check URL parameters for standalone or pre-filled access
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const premiseParam = params.get('premise') || initialPremiseName;
      const dboParam = params.get('dbo') || initialClientName;
      const permitParam = params.get('permit') || initialPermitNo;
      const locParam = params.get('location') || initialLocation;
      const catParam = params.get('category') || initialCategory;
      const expParam = params.get('exp');
      const timerParam = params.get('timer');

      if (timerParam === 'none') {
        // Explicit no-timer mode: continuous validity session
        setSessionExpiresAt(null);
        setSessionSecondsLeft(null);
        setIsSessionExpired(false);
      } else if (expParam) {
        const parsedExp = parseInt(expParam, 10);
        if (!isNaN(parsedExp)) {
          setSessionExpiresAt(parsedExp);
          const remaining = Math.floor((parsedExp - Date.now()) / 1000);
          if (remaining <= 0) {
            setIsSessionExpired(true);
            setSessionSecondsLeft(0);
          } else {
            setSessionSecondsLeft(remaining);
          }
        }
      }

      if (premiseParam || dboParam || permitParam) {
        setFormData(prev => ({
          ...prev,
          premiseName: premiseParam || prev.premiseName || '',
          dboName: dboParam || prev.dboName || '',
          permitNo: permitParam || prev.permitNo || '',
          location: locParam || prev.location || '',
          category: catParam || prev.category || ''
        }));
      }
    }
  }, []);

  // Check if current premise already has a signed disclosure
  const currentPremiseSigned = disclosures.find(
    d => d.status === 'signed' && 
    formData.premiseName && 
    d.premiseName.trim().toLowerCase() === formData.premiseName.trim().toLowerCase()
  );

  // Select a premise from licensed clients
  const handleSelectPremise = (client: LicensedClient, branchPremise?: string, branchLocation?: string) => {
    const cAny = client as any;
    const premise = branchPremise || client.premiseName || cAny.premisename || cAny.premises || client.clientName || '';
    const location = branchLocation || client.location || client.county || '';
    const permit = client.permitNumber || cAny.permitnumber || cAny.permit_number || '';
    const category = client.premiseCategory || cAny.premisecategory || cAny.category || '';

    // Check if this premise already has a signed disclosure
    const existing = disclosures.find(
      d => d.premiseName && d.premiseName.trim().toLowerCase() === premise.trim().toLowerCase()
    );

    if (existing) {
      setFormData({
        ...existing
      });
    } else {
      setFormData(prev => ({
        ...prev,
        id: '',
        dboName: client.clientName || cAny.clientname || '',
        permitNo: permit,
        premiseName: premise,
        location: location,
        category: category,
        status: 'draft'
      }));
    }

    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  // Generate QR Link (20-Minute Expiration or No Timer / Continuous Validity)
  const getQrUrl = () => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    const params = new URLSearchParams();
    if (formData.premiseName) params.set('premise', formData.premiseName);
    if (formData.dboName) params.set('dbo', formData.dboName);
    if (formData.permitNo) params.set('permit', formData.permitNo);
    if (formData.location) params.set('location', formData.location);
    if (formData.category) params.set('category', formData.category);

    if (qrTimerMode === '20min') {
      // Include 20-minute validity timestamp in the QR link
      params.set('exp', qrExpiresAt.toString());
    } else {
      // Explicit No Timer mode: continuous validity
      params.set('timer', 'none');
    }
    return `${base}/scope-disclosure?${params.toString()}`;
  };

  // Helper to mask Scope Disclosure signing link for officer security and privacy (app address hidden)
  const getMaskedScopeDisclosureUrl = (url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const maskedPath = parsed.pathname.includes('/sign-scope-disclosure')
        ? '/sign-scope-disclosure/••••••••'
        : '/scope-disclosure/••••••••';
      return `https://••••••••${maskedPath}?token=••••••••••••••••`;
    } catch {
      return 'https://••••••••/sign-scope-disclosure/••••••••?token=••••••••••••••••';
    }
  };

  const handleCopyLink = () => {
    const url = getQrUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle Form Submit / Save
  const handleSaveDisclosure = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAttemptedSubmit(true);

    if (isSessionExpired) {
      alert('This remote signing session has expired (20 minutes window elapsed). Please request a fresh QR code / link from your KDB inspector.');
      return;
    }

    // SECTION A MANDATORY VALIDATION: Name of Licensee, Premise Name, Location, Category
    if (!formData.dboName || !formData.dboName.trim()) {
      alert('Mandatory Field Missing: Please enter the Name of Licensee (DBO) in Section A.');
      return;
    }

    if (!formData.premiseName || !formData.premiseName.trim()) {
      alert('Mandatory Field Missing: Please enter the Premise Name in Section A.');
      return;
    }

    if (!formData.location || !formData.location.trim()) {
      alert('Mandatory Field Missing: Please enter the Premise Location in Section A.');
      return;
    }

    if (!formData.category || !formData.category.trim()) {
      alert('Mandatory Field Missing: Please enter the License Category in Section A.');
      return;
    }

    // SECTION G MANDATORY VALIDATION: Signer Name & Signature
    if (!formData.signerName || !formData.signerName.trim()) {
      alert('Mandatory Field Missing: Please enter the Licensee Representative Name in Section G.');
      return;
    }

    if (!formData.signature) {
      alert('Mandatory Requirement: Please provide a digital signature or sign using the signature pad in Section G.');
      return;
    }

    setSaving(true);
    try {
      const recordToSave: ScopeDisclosureRecord = {
        id: formData.id || 'SD-' + Date.now(),
        dboName: formData.dboName || '',
        permitNo: formData.permitNo || '',
        premiseName: formData.premiseName || '',
        location: formData.location || '',
        category: formData.category || '',
        signerName: formData.signerName || '',
        signerDesignation: formData.signerDesignation || 'Manager / Licensee',
        signature: formData.signature,
        signedDate: formData.signedDate || new Date().toLocaleDateString('en-GB'),
        status: 'signed',
        signedAt: new Date().toISOString()
      };

      const saved = await DBService.saveScopeDisclosure(recordToSave);
      setFormData(saved);
      setDisclosures(prev => [saved, ...prev.filter(d => d.id !== saved.id)]);
      setSaveSuccessMessage('Scope Disclosure Form signed and saved successfully!');

      if (onSignedSuccess) {
        onSignedSuccess(saved);
      }

      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to save scope disclosure:', err);
      alert('Error saving scope disclosure: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (record?: Partial<ScopeDisclosureRecord>) => {
    const dataToPrint = record || formData;
    if (!dataToPrint.premiseName) {
      alert('Please select or specify a premise before downloading.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = await generateScopeDisclosurePdfDoc(dataToPrint);
      const premiseClean = (dataToPrint.premiseName || dataToPrint.dboName || 'Premise').trim().replace(/[/\\?%*:|"<>]/g, '-');
      const rawDate = (dataToPrint.signedDate || new Date().toLocaleDateString('en-GB')).trim();
      const safeDate = rawDate.replace(/\//g, '-').replace(/[/\\?%*:|"<>]/g, '-');
      const filename = `KDB_Scope_Disclosure_${premiseClean}_${safeDate}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filtered premise list for search
  const filteredClients = clients.filter(c => {
    const q = searchQuery.toLowerCase();
    const cAny = c as any;
    const clientName = (c.clientName || cAny.clientname || '').toLowerCase();
    const premiseName = (c.premiseName || cAny.premisename || cAny.premises || '').toLowerCase();
    const permitNumber = (c.permitNumber || cAny.permitnumber || cAny.permit_number || '').toLowerCase();
    const location = (c.location || c.county || '').toLowerCase();
    return (
      clientName.includes(q) ||
      premiseName.includes(q) ||
      permitNumber.includes(q) ||
      location.includes(q)
    );
  }).slice(0, 15);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-700" />
                </span>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Scope Disclosure Form
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Cap. 336
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                KDB Premise Inspection Scope Disclosure & Licensee Acknowledgement
              </p>
            </div>

            {/* Sub-tab Switcher & Actions (Admin Only) */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {userIsAdmin && (
                <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('form')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeSubTab === 'form' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Document Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('registry')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      activeSubTab === 'registry' 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Signed Registry</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                      {disclosures.filter(d => d.status === 'signed').length}
                    </span>
                  </button>
                </div>
              )}

              {userIsAdmin && (
                <button
                  type="button"
                  onClick={openQrModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Open QR Code for mobile touch signing"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">QR Access</span>
                  <span className={`text-[10px] font-bold hidden md:inline ${qrTimerMode === '20min' ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {qrTimerMode === '20min' ? '• 20m' : '• No Exp'}
                  </span>
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                  title="Close Scope Disclosure"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 20-Minute Remote Signing Session Banner for Client */}
      {!userIsAdmin && sessionSecondsLeft !== null && sessionSecondsLeft > 0 && !isSessionExpired && (
        <div className="bg-amber-500/10 border-b border-amber-300 px-4 py-2.5 text-amber-900 text-xs font-semibold sticky top-[68px] z-20 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
              <span>Remote Signing Session Active • 20-minute validity window</span>
            </div>
            <div className="font-mono font-black text-amber-950 bg-amber-200/80 px-2.5 py-0.5 rounded-full text-xs border border-amber-300">
              Expires in: {formatTimer(sessionSecondsLeft)}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {/* If remote session is expired, show expiry block */}
        {!userIsAdmin && isSessionExpired ? (
          <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-rose-200 shadow-xl text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-2">Signing Link Expired</h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Validity window for this remote signing session has expired. Please request a fresh QR code or link.
            </p>
            <div className="text-[11px] text-slate-500 font-mono bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-200 inline-block">
              Signing Window Elapsed
            </div>
          </div>
        ) : (
          <>
            {saveSuccessMessage && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-xs sm:text-sm font-bold">{saveSuccessMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Signed PDF
                </button>
              </div>
            )}

            {/* REGISTRY SUB-TAB (ADMIN ONLY) */}
            {activeSubTab === 'registry' && userIsAdmin && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Signed Scope Disclosures Registry</h2>
                <p className="text-xs text-slate-500">Official log of completed licensee inspection disclosures</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {disclosures.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold text-slate-600">No Scope Disclosures Recorded Yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Fill out and sign a disclosure in the "Document Form" tab to generate official signed records.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('form')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700"
                >
                  Create New Scope Disclosure
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Premise & DBO</th>
                      <th className="py-3 px-3">Permit No</th>
                      <th className="py-3 px-3">Signer & Designation</th>
                      <th className="py-3 px-3">Signed Date</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disclosures.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{d.premiseName}</p>
                          <p className="text-[11px] text-slate-500">{d.dboName} • {d.location}</p>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">{d.permitNo || 'N/A'}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{d.signerName || 'Unknown'}</p>
                          <p className="text-[11px] text-slate-500">{d.signerDesignation}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{d.signedDate}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-2.5 h-2.5" />
                            Signed
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(d);
                                setActiveSubTab('form');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px]"
                            >
                              View / Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(d)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* DOCUMENT FORM SUB-TAB */}
        {activeSubTab === 'form' && (
          <div className="space-y-6">
            {/* Premise / Client Selector & Search Banner (ADMIN ONLY - Strictly hidden from remote QR and direct links) */}
            {userIsAdmin && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Target Premise & Licensee Selection
                    </h3>
                    <p className="text-xs text-slate-600">
                      Select an active premise from your registry to auto-fill statutory details, or type manually below.
                    </p>
                  </div>
                  {currentPremiseSigned ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold self-start sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Signed on {currentPremiseSigned.signedDate}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold self-start sm:self-auto">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Not Signed for this Premise</span>
                    </div>
                  )}
                </div>

                {/* Premise Selector Dropdown */}
                <div className="relative mt-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search premise name, DBO, or permit number..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          id: '',
                          dboName: '',
                          permitNo: '',
                          premiseName: '',
                          location: '',
                          category: '',
                          signerName: '',
                          signerDesignation: '',
                          signature: '',
                          signedDate: new Date().toLocaleDateString('en-GB'),
                          status: 'draft'
                        });
                      }}
                      className="px-3 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {isDropdownOpen && searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No matching premises found in registry.
                        </div>
                      ) : (
                        filteredClients.map((client, idx) => (
                          <div key={idx}>
                            <button
                              type="button"
                              onClick={() => handleSelectPremise(client)}
                              className="w-full px-3 py-2.5 text-left hover:bg-blue-50/70 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {client.premiseName || (client as any).premisename || client.clientName}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  DBO: {client.clientName || (client as any).clientname} • Permit: {client.permitNumber || (client as any).permitnumber || 'N/A'} • {client.location || client.county}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                Primary
                              </span>
                            </button>

                            {/* Branches if any */}
                            {client.branches && client.branches.map((b, bIdx) => (
                              <button
                                key={`b-${bIdx}`}
                                type="button"
                                onClick={() => handleSelectPremise(client, b.premiseName || (b as any).name, b.location)}
                                className="w-full pl-6 pr-3 py-2 text-left bg-slate-50/60 hover:bg-blue-50/70 transition-colors flex items-center justify-between border-t border-slate-100"
                              >
                                <div>
                                  <p className="text-xs font-bold text-slate-800">↳ Branch: {b.premiseName || (b as any).name}</p>
                                  <p className="text-[10px] text-slate-500">Loc: {b.location} • Permit: {b.permitNumber || client.permitNumber || 'N/A'}</p>
                                </div>
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-sm">
                                  Branch
                                </span>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* THE STATUTORY DOCUMENT CONTAINER */}
            <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-6 sm:p-10 font-sans leading-relaxed text-slate-800">
              
              {/* Document Header */}
              <div className="text-center pb-4 border-b border-slate-200">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  KDB Premise Inspection Scope Disclosure
                </h2>
                <p className="text-xs sm:text-[13px] text-slate-600 mt-2 text-justify sm:text-center max-w-3xl mx-auto leading-normal">
                  <span className="font-bold text-slate-900">Purpose:</span> To inform the licensee about the scope of inspections, the records subject to review, and the compliance checks that the regulator may conduct during premise inspections, in accordance with the Dairy Industry Act (Cap. 336) and its subsidiary regulations.
                </p>
              </div>

              {/* Section A */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <span>A. Licensee & Premise Details</span>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Mandatory Fields
                    </span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>• Name of Licensee (DBO): <span className="text-rose-600 font-bold">*</span></span>
                      {attemptedSubmit && !formData.dboName?.trim() && (
                        <span className="text-[10px] text-rose-600 font-semibold">Required</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. XYZ Dairies Ltd"
                      value={formData.dboName || ''}
                      onChange={(e) => setFormData({ ...formData, dboName: e.target.value })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors ${
                        attemptedSubmit && !formData.dboName?.trim()
                          ? 'border-2 border-rose-400 bg-rose-50/50'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>• License Category: <span className="text-rose-600 font-bold">*</span></span>
                      {attemptedSubmit && !formData.category?.trim() && (
                        <span className="text-[10px] text-rose-600 font-semibold">Required</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cooling Plant, Processor, Milk Bar"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors ${
                        attemptedSubmit && !formData.category?.trim()
                          ? 'border-2 border-rose-400 bg-rose-50/50'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-slate-700 flex items-center justify-between">
                      <span>• Premise Name & Location: <span className="text-rose-600 font-bold">*</span></span>
                      {attemptedSubmit && (!formData.premiseName?.trim() || !formData.location?.trim()) && (
                        <span className="text-[10px] text-rose-600 font-semibold">Both Required</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Premise Name"
                        value={formData.premiseName || ''}
                        onChange={(e) => setFormData({ ...formData, premiseName: e.target.value })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors ${
                          attemptedSubmit && !formData.premiseName?.trim()
                            ? 'border-2 border-rose-400 bg-rose-50/50'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors ${
                          attemptedSubmit && !formData.location?.trim()
                            ? 'border-2 border-rose-400 bg-rose-50/50'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  B. Operational Areas
                </h3>
                <p className="text-xs text-slate-600">
                  The regulator will inspect and assess the following areas of operation:
                </p>

                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3.5 w-1/3 border-r border-slate-200">Area</th>
                        <th className="py-2 px-3.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ['Milk Handling', 'Receipt, storage, and handling of raw milk'],
                        ['Processing Activities', 'Pasteurization, packaging, value addition'],
                        ['Distribution', 'Transportation and delivery systems'],
                        ['Hygiene & Sanitation', 'Cleanliness of premises, equipment, and personnel'],
                        ['Equipment & Facilities', 'Suitability and maintenance of machinery'],
                        ['Waste Management', 'Disposal of effluent and solid waste'],
                        ['Product Traceability', 'Ability to track milk from source to sale'],
                      ].map(([area, desc], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2 px-3.5 font-bold text-slate-800 border-r border-slate-200">{area}</td>
                          <td className="py-2 px-3.5 text-slate-700">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section C */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  C. Records That May Be Reviewed
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-700 pl-1">
                  {[
                    'Purchase records / milk intake logs',
                    'Delivery notes / dispatch records',
                    'Sales invoices / receipts',
                    'Farmer / supplier registers',
                    'Production and processing records (where applicable)',
                    'Cleaning and sanitation logs',
                    'Equipment maintenance records',
                    'Staff health certificates',
                    'Quality control and test results (where applicable)',
                    'Any other traceability or compliance documentation',
                  ].map((record, i) => (
                    <div key={i} className="flex items-start gap-1.5 py-0.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{record}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Data Filed with the Regulator (What You Submit)
                  </h4>
                  <p className="text-xs text-slate-600 mb-2">
                    The regulator will review and validate the following data as submitted by the client:
                  </p>

                  <div className="overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3.5 w-1/3 border-r border-slate-200">Item</th>
                          <th className="py-2 px-3.5">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {[
                          ['Declared Intake Volumes', 'Total milk/produce intake reported'],
                          ['Declared Sales Volumes', 'Total local sales reported'],
                          ['Reporting Period', 'Month and year of submission'],
                          ['Prices Declared', 'Buying and selling prices'],
                        ].map(([item, desc], i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="py-2 px-3.5 font-bold text-slate-800 border-r border-slate-200">{item}</td>
                            <td className="py-2 px-3.5 text-slate-700">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-500 italic pt-1">
                  <p>
                    <span className="font-semibold text-slate-700">Note:</span> Absence or inconsistency of records may affect compliance assessment/outcomes.
                  </p>
                  <p>
                    All records must be maintained and made available at the premises for inspection. Each branch outlet/premise shall retain copies of its individual records for at least three (3) months preceding the current month.
                  </p>
                </div>
              </div>

              {/* Section D */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  D. Compliance Checks Performed
                </h3>

                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3.5 w-1/3 border-r border-slate-200">Compliance Area</th>
                        <th className="py-2 px-3.5">What Is Assessed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ['Licensing Compliance', 'Validity, category and display of permit on premise'],
                        ['Hygiene Standards', 'Cleanliness vs regulatory requirements'],
                        ['Milk Quality', 'Handling and testing procedures'],
                        ['Structural Compliance', 'Premise layout vs approved standards'],
                        ['Equipment Suitability', 'Food-grade and operational condition'],
                        ['Traceability', 'Ability to track milk movement'],
                        ['Record Consistency', 'Records vs actual operations'],
                        ['Public Health Standards', 'Compliance with safety requirements'],
                      ].map(([area, what], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2 px-3.5 font-bold text-slate-800 border-r border-slate-200">{area}</td>
                          <td className="py-2 px-3.5 text-slate-700">{what}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section E */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  E. Reconciliation Checks Performed
                </h3>
                <p className="text-xs text-slate-600">The regulator may reconcile:</p>

                <div className="overflow-hidden border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3.5 w-1/3 border-r border-slate-200">Reconciliation Area</th>
                        <th className="py-2 px-3.5">What Is Compared</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        ['Volume Reconciliation', 'Declared intake vs verified intake'],
                        ['Sales Reconciliation', 'Declared sales vs records'],
                        ['Capacity Check', 'Volume per day vs operational capacity'],
                        ['Period Consistency', 'Daily, monthly, and cumulative figures'],
                        ['Price Consistency', 'Prices vs records and market norms'],
                      ].map(([area, what], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2 px-3.5 font-bold text-slate-800 border-r border-slate-200">{area}</td>
                          <td className="py-2 px-3.5 text-slate-700">{what}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section F */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  F. Possible Outcomes of Inspection
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-800 pl-1">
                  {[
                    'Confirmation of compliance',
                    'Confirmation of declared data',
                    'Identification of non-compliance issues (e.g. under-declared volumes, variances,)',
                    'Requirement to adjust future returns',
                    'Issuance of corrective actions/inspection orders/closure notices',
                    'Suspension or conditional operation (where applicable)',
                    'Recommendation for enforcement action',
                    'Follow-up inspection',
                  ].map((outcome, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="text-blue-700 font-black">✓</span>
                      <span>{outcome}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section G: Licensee Acknowledgement */}
              <div className="mt-8 pt-5 border-t border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    G. Licensee Acknowledgement
                  </h3>
                  {userIsAdmin && (
                    <button
                      type="button"
                      onClick={openQrModal}
                      className="flex items-center gap-1.5 text-xs text-blue-700 font-bold hover:text-blue-900 underline cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Sign on phone / tablet via QR code ({qrTimerMode === '20min' ? '20-Min Timer' : 'No Timer'})</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-700 italic">
                  "I/We acknowledge that we understand the scope of inspection and compliance requirements as outlined above."
                </p>

                {/* Signer Name & Designation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">
                      Name: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Full Name of DBO / Authorized Representative"
                      value={formData.signerName || ''}
                      onChange={(e) => setFormData({ ...formData, signerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">
                      Designation: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Director / Owner / Manager"
                      value={formData.signerDesignation || ''}
                      onChange={(e) => setFormData({ ...formData, signerDesignation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Digital Signature Pad (Using exact signature logic) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>Signature:</span>
                      <span className="text-red-500">*</span>
                      {formData.signature && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Check className="w-2.5 h-2.5" />
                          Signature Captured
                        </span>
                      )}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Sign using mouse, stylus, finger, or upload image
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <SignaturePad
                      label="Draw Licensee Signature Below"
                      value={formData.signature}
                      onSave={(sigDataUrl) => {
                        setFormData(prev => ({ ...prev, signature: sigDataUrl }));
                      }}
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="max-w-xs space-y-1 pt-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Date: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={formData.signedDate || ''}
                    onChange={(e) => setFormData({ ...formData, signedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {formData.status === 'signed' ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Status: Signed & Ready for PDF Download
                    </span>
                  ) : (
                    <span>Complete Section G to sign and validate this document.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf()}
                    disabled={isGeneratingPdf}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4 text-slate-600" />
                    <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveDisclosure()}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Submit & Sign Disclosure'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* QR CODE MODAL (20-MINUTE VALIDITY TIMER OR NO TIMER) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 text-center relative animate-in fade-in zoom-in-95 duration-150 my-auto">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Scope Disclosure Remote Signing
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Scan with smartphone camera or share link for digital touch signing on licensee mobile device.
            </p>

            {/* Validity Mode Switcher (20-Min Option vs No Timer) */}
            <div className="mt-3.5 mb-2.5 bg-slate-100/90 p-1 rounded-2xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setQrTimerMode('20min')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  qrTimerMode === '20min'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>20-Min Timer</span>
              </button>
              <button
                type="button"
                onClick={() => setQrTimerMode('no_timer')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  qrTimerMode === 'no_timer'
                    ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>No Timer (Continuous)</span>
              </button>
            </div>

            {/* Validity Status Badge */}
            {qrTimerMode === '20min' ? (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                qrSecondsLeft > 60 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : qrSecondsLeft > 0 
                    ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse' 
                    : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {qrSecondsLeft > 0 
                    ? `Valid for 20 mins • ${formatTimer(qrSecondsLeft)} remaining` 
                    : 'Expired (20-min window elapsed)'}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-900 border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>No Timer • Continuous Validity (Does Not Expire)</span>
              </div>
            )}

            {/* Premise Context Card */}
            {formData.premiseName && (
              <div className="mt-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Premise</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{formData.permitNo || 'No Permit'}</span>
                </div>
                <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{formData.premiseName}</p>
                {formData.dboName && (
                  <p className="text-[11px] text-slate-500 truncate">{formData.dboName} • {formData.location}</p>
                )}
              </div>
            )}

            {/* Scannable QR Code Card with Frosted Privacy Mask */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col items-center text-center my-3">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Scannable QR Link</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrMasked(!isQrMasked)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  title={isQrMasked ? "Reveal QR Code" : "Mask QR Code for privacy"}
                >
                  {isQrMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{isQrMasked ? 'Reveal QR' : 'Mask QR'}</span>
                </button>
              </div>

              {/* QR Code Container with Frosted Privacy Mask */}
              <div className="relative my-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden w-[210px] h-[210px] shrink-0">
                <div className={`transition-all duration-300 ${isQrMasked ? 'filter blur-md opacity-25 select-none pointer-events-none' : 'opacity-100'}`}>
                  <QRCodeSVG
                    value={getQrUrl()}
                    size={180}
                    level="M"
                    includeMargin={true}
                  />
                </div>

                {/* Interactive Masking Overlay */}
                {isQrMasked && (
                  <div
                    onClick={() => setIsQrMasked(false)}
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all hover:bg-slate-900/85 group"
                    title="Click to reveal QR Code"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                      <Lock className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-white tracking-tight">QR Link Masked</span>
                    <span className="text-[10px] text-slate-300 mt-0.5">Click or tap to reveal</span>
                    <span className="mt-2 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold inline-flex items-center gap-1 shadow-xs">
                      <Eye className="w-3 h-3" /> Reveal QR
                    </span>
                  </div>
                )}

                {/* Expired Overlay if 20-min elapsed */}
                {qrTimerMode === '20min' && qrSecondsLeft <= 0 && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 z-10">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                    <p className="text-xs font-black text-slate-900">QR Code Expired</p>
                    <p className="text-[11px] text-slate-500 mb-3">20-minute validity elapsed</p>
                    <button
                      type="button"
                      onClick={resetQrTimer}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      Generate New QR Code
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[260px]">
                Point smartphone or tablet camera to review statutory scope of inspection and sign on-screen.
              </p>
            </div>

            {/* Masked Link Input Box with Privacy Toggle (App address hidden when masked) */}
            <div className="space-y-1.5 text-left mb-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Remote Disclosure URL</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                    {isUrlMasked ? 'Masked for Security' : 'Visible'}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsUrlMasked(!isUrlMasked)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  title={isUrlMasked ? "Show full URL" : "Mask URL for security"}
                >
                  {isUrlMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{isUrlMasked ? 'Reveal Link' : 'Mask Link'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    isUrlMasked
                      ? getMaskedScopeDisclosureUrl(getQrUrl())
                      : getQrUrl()
                  }
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-mono select-all focus:outline-none focus:bg-white focus:border-blue-500 tracking-tight"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={qrTimerMode === '20min' && qrSecondsLeft <= 0}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Copy direct active link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
                <a
                  href={getQrUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shrink-0"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="space-y-2">
              {qrTimerMode === '20min' ? (
                <button
                  type="button"
                  onClick={resetQrTimer}
                  className="w-full text-center text-[11px] font-bold text-blue-600 hover:text-blue-800 py-1 transition-colors cursor-pointer"
                >
                  ↻ Refresh / Reset 20-min window
                </button>
              ) : (
                <p className="text-[11px] text-emerald-700 font-semibold py-1 text-center">
                  ✓ Active link without expiry timestamp
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
