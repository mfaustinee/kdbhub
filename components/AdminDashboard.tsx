
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { AgreementData, DebtorRecord, ArrearItem, Installment, StaffConfig, ClosureNotificationData, EnabledModules, AuthoritySignature } from '../types';
import { DBService } from '../services/db';
import { Eye, Plus, Trash2, Database, FileCheck, UserPlus, MapPin, ShieldCheck, AlertTriangle, Send, Settings, Upload, CheckCircle2, Briefcase, FileText, FileSearch, Mail, Calendar, Check, Loader2, Search, X, Download, Server, Cpu, Globe, Key, Lock, AlertCircle, ExternalLink, PenTool, Trash, Activity, Building, Building2, TrendingUp, Menu, ToggleLeft, ToggleRight, EyeOff, HelpCircle, ArrowUp, ArrowDown, ArrowUpDown, ChevronUp, ChevronDown, Edit3, LogOut, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../src/contexts/AuthContext';
import { PDFPreview } from './PDFPreview';
import { ClosurePDFPreview } from './ClosurePDFPreview';
import { downloadAgreementPDF, downloadClosurePDF } from '../services/pdf';
import { numberToWords } from '../utils/numberToWords';
import { LicensedClientsModule } from './LicensedClientsModule';
import { ClientReturnsModule } from './ClientReturnsModule';
import { ClientsAndReturnsHub } from './ClientsAndReturnsHub';
import { ReportsModule } from './ReportsModule';
import { DataValidationModule } from './DataValidationModule';
import { ScopeDisclosureModule } from './ScopeDisclosureModule';
import { SecuritySettingsCard } from './SecuritySettingsCard';
import { GeneralAccessQrCard } from './GeneralAccessQrCard';

interface AdminDashboardProps {
  agreements: AgreementData[];
  closures: ClosureNotificationData[];
  debtors: DebtorRecord[];
  staffConfig: StaffConfig;
  isSyncing?: boolean;
  onRefresh?: () => void;
  onAction: (id: string, action: 'approve' | 'reject', adminData?: { signature: string; name: string; reason?: string }) => void;
  onDeleteAgreement?: (id: string) => void;
  onClosureAction: (id: string, action: 'approve' | 'reject', adminData?: { signature: string; name: string; reason?: string; title?: string; comments?: string }) => void;
  onDeleteClosure?: (id: string) => void;
  onDebtorUpdate: (updated: DebtorRecord[]) => void;
  onStaffUpdate: (config: StaffConfig) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  agreements = [], 
  closures = [], 
  debtors, 
  staffConfig, 
  isSyncing, 
  onRefresh, 
  onAction, 
  onDeleteAgreement, 
  onClosureAction,
  onDeleteClosure,
  onDebtorUpdate, 
  onStaffUpdate 
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'requests_to_approve' | 'clients_returns' | 'clients' | 'returns' | 'reports' | 'data_validation' | 'scope_disclosure' | 'settings'>('data_validation');
  const [approvalSubTab, setApprovalSubTab] = useState<'agreements' | 'cessations'>('agreements');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const pendingRequestsCount = 
    agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length + 
    closures.filter(c => c.status === 'submitted').length;

  const getTabLabel = (currentTab: typeof tab) => {
    switch (currentTab) {
      case 'data_validation': return 'Data Validation Form';
      case 'scope_disclosure': return 'Scope Disclosure Form';
      case 'requests_to_approve': return 'Requests to Approve';
      case 'clients_returns':
      case 'clients':
      case 'returns': return 'Clients & Returns Hub';
      case 'reports': return 'Compliance Reports';
      case 'settings': return 'System Settings';
      default: return 'Admin Workspace';
    }
  };

  const changeTab = (newTab: typeof tab) => {
    setTab(newTab);
    setIsMobileMenuOpen(false);
  };
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);

  const [isRejecting, setIsRejecting] = useState(false);
  const [isRejectingClosure, setIsRejectingClosure] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApprovingClosure, setIsApprovingClosure] = useState(false);

  const [approvalStatus, setApprovalStatus] = useState('');
  const [closureApprovalStatus, setClosureApprovalStatus] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showClosurePreview, setShowClosurePreview] = useState(false);

  const { user, signOut } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [closureRejectionReason, setClosureRejectionReason] = useState('');
  const [adminName, setAdminName] = useState(() => user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
  const [adminTitle, setAdminTitle] = useState('Compliance Officer');
  const [closureOfficerTitle, setClosureOfficerTitle] = useState('');
  const [closureOfficerComments, setClosureOfficerComments] = useState('');
  const [selectedSigningSigId, setSelectedSigningSigId] = useState<string>('');
  const [isSyncingSigs, setIsSyncingSigs] = useState(false);

  useEffect(() => {
    if (user && !adminName) {
      setAdminName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
    }
  }, [user]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingDebtor, setIsAddingDebtor] = useState(false);
  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);
  const [authoritySigs, setAuthoritySigs] = useState<AuthoritySignature[]>([]);
  const [showAddSigModal, setShowAddSigModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [newSigName, setNewSigName] = useState('');
  const [newSigTitle, setNewSigTitle] = useState('');
  const [newSigImage, setNewSigImage] = useState('');
  const [newSigMode, setNewSigMode] = useState<'upload' | 'draw'>('upload');
  const newSigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [isSavingSig, setIsSavingSig] = useState(false);
  const [editingSig, setEditingSig] = useState<AuthoritySignature | null>(null);
  const [editSigName, setEditSigName] = useState('');
  const [editSigTitle, setEditSigTitle] = useState('');
  const [editSigImage, setEditSigImage] = useState('');
  const [editSigMode, setEditSigMode] = useState<'upload' | 'draw'>('upload');
  const editSigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [editSigIsDefault, setEditSigIsDefault] = useState(false);
  const [isSavingEditSig, setIsSavingEditSig] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any>({
    status: 'checking',
    writable: false,
    backendSupabase: false,
    clientSupabase: false,
    count: 0,
    error: null
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const checkHealth = async () => {
    setIsTestingConnection(true);
    try {
      console.log("[HealthCheck] Starting health checks...");
      // 1. Check Backend Health
      const healthRes = await fetch('/api/health');
      const healthResClone = healthRes.clone();
      const healthText = await healthRes.text();
      
      console.log(`[HealthCheck] /api/health response status: ${healthRes.status}`);
      
      if (!healthRes.ok) {
        throw new Error(`Backend health check failed (${healthRes.status}): ${healthText.substring(0, 100)}`);
      }
      
      let healthData;
      try {
        healthData = JSON.parse(healthText);
        console.log("[HealthCheck] /api/health data:", healthData);
      } catch (jsonErr) {
        console.error("[HealthCheck] /api/health JSON parse error:", jsonErr);
        const isHtml = healthText.trim().startsWith('<!DOCTYPE html>') || healthText.trim().startsWith('<html');
        throw new Error(`Invalid response from /api/health. Expected JSON, but received ${isHtml ? 'HTML (likely a 404 fallback)' : 'invalid text'}. Content: ${healthText.substring(0, 100)}...`);
      }
      
      // 2. Check Supabase via DBService
      const { DBService } = await import('../services/db.ts');
      const config = await DBService.fetchConfig();
      console.log("[HealthCheck] Supabase config from server:", config);
      
      // Check both sources for configuration
      const hasBuildUrl = !!import.meta.env.VITE_SUPABASE_URL;
      const hasBuildKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
      const hasServerUrl = !!(config && config.VITE_SUPABASE_URL);
      const hasServerKey = !!(config && config.VITE_SUPABASE_ANON_KEY);
      
      const isConfigured = (hasBuildUrl && hasBuildKey) || (hasServerUrl && hasServerKey);
      
      console.log("[HealthCheck] Configuration status:", {
        buildTime: { url: hasBuildUrl, key: hasBuildKey },
        serverTime: { url: hasServerUrl, key: hasServerKey },
        final: isConfigured
      });

      let tableStatus = { agreements: false, debtors: false, staff: false };
      let agreementsCount = 0;

      if (isConfigured) {
        try {
          const agreements = await DBService.getAgreements();
          agreementsCount = agreements.length;
          tableStatus.agreements = true;
          console.log(`[HealthCheck] Agreements table accessible. Count: ${agreementsCount}`);
        } catch (e) {
          console.error("[HealthCheck] Agreements table check failed:", e);
        }

        try {
          await DBService.getDebtors();
          tableStatus.debtors = true;
          console.log("[HealthCheck] Debtors table accessible");
        } catch (e) {
          console.error("[HealthCheck] Debtors table check failed:", e);
        }

        try {
          await DBService.getStaffConfig();
          tableStatus.staff = true;
          console.log("[HealthCheck] Staff table accessible");
        } catch (e) {
          console.error("[HealthCheck] Staff table check failed:", e);
        }
      }
      
      setSystemHealth({ 
        status: healthData.status || 'ok', 
        writable: healthData.writable, 
        backendSupabase: healthData.supabaseConfigured,
        clientSupabase: isConfigured,
        tables: tableStatus,
        count: agreementsCount,
        error: isConfigured ? null : "Missing Configuration: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set in environment"
      });
    } catch (e: any) {
      console.error("[HealthCheck] Error:", e);
      setSystemHealth({ 
        status: 'error', 
        message: e.message,
        details: e.details || e.hint || ''
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    if (tab === 'settings') {
      checkHealth();
    }
  }, [tab]);

  const loadSignatures = async (forceFresh = false) => {
    if (forceFresh) setIsSyncingSigs(true);
    try {
      const sigs = await DBService.getAuthoritySignatures(forceFresh);
      setAuthoritySigs(sigs);
      if (sigs.length > 0) {
        setSelectedSigningSigId(prev => {
          if (prev && sigs.some(s => s.id === prev)) return prev;
          const def = sigs.find(s => s.isDefault) || sigs[0];
          return def.id;
        });
      }
    } finally {
      if (forceFresh) setTimeout(() => setIsSyncingSigs(false), 300);
    }
  };

  const handleSelectSigningOfficer = (sig: AuthoritySignature) => {
    setSelectedSigningSigId(sig.id);
    setAdminName(sig.name);
    if (sig.title) {
      setAdminTitle(sig.title);
      setClosureOfficerTitle(sig.title);
    }
  };

  useEffect(() => {
    loadSignatures();

    const handleSigUpdate = () => {
      loadSignatures();
    };
    window.addEventListener('kdb_authority_signatures_updated', handleSigUpdate);
    return () => {
      window.removeEventListener('kdb_authority_signatures_updated', handleSigUpdate);
    };
  }, []);

  const handleToggleModule = (moduleKey: keyof EnabledModules) => {
    const currentModules = staffConfig.enabledModules || {
      levyAgreement: true,
      businessClosure: true,
    };

    const updatedConfig: StaffConfig = {
      ...staffConfig,
      enabledModules: {
        ...currentModules,
        [moduleKey]: !currentModules[moduleKey],
      },
    };

    onStaffUpdate(updatedConfig);
  };

  const handleToggleAllModules = (enable: boolean) => {
    const updatedConfig: StaffConfig = {
      ...staffConfig,
      enabledModules: {
        levyAgreement: enable,
        businessClosure: enable,
      },
    };

    onStaffUpdate(updatedConfig);
  };

  const [newDebtor, setNewDebtor] = useState<Partial<DebtorRecord>>({
    dboName: '',
    premiseName: '',
    permitNo: '',
    county: '',
    location: '',
    totalArrears: 0,
    tel: '',
    debitNoteNo: '',
    arrearsBreakdown: [],
    installments: [{ no: 1, period: '', dueDate: '', amount: 0 }]
  });

  const addInstallmentRow = () => {
    const current = newDebtor.installments || [];
    setNewDebtor({
      ...newDebtor,
      installments: [
        ...current,
        { no: current.length + 1, period: '', dueDate: '', amount: 0 }
      ]
    });
  };

  const removeInstallmentRow = (index: number) => {
    const current = [...(newDebtor.installments || [])];
    current.splice(index, 1);
    // Re-number
    const renumbered = current.map((inst, i) => ({ ...inst, no: i + 1 }));
    setNewDebtor({ ...newDebtor, installments: renumbered });
  };

  const updateInstallmentRow = (index: number, field: keyof Installment, value: any) => {
    const current = [...(newDebtor.installments || [])];
    current[index] = { ...current[index], [field]: value };
    setNewDebtor({ ...newDebtor, installments: current });
  };
  
  const selectedReview = agreements.find(a => a.id === selectedReviewId);
  const selectedClosure = closures.find(c => c.id === selectedClosureId);

  const handleApproveClosure = async () => {
    const activeSig = authoritySigs.find(s => s.id === selectedSigningSigId) || authoritySigs.find(s => s.isDefault) || authoritySigs[0];
    const signatureToUse = activeSig?.signature || staffConfig.officialSignature;
    if (!adminName && !activeSig?.name) return alert("Please enter your name for authorization.");
    if (!closureOfficerTitle && !activeSig?.title) return alert("Please enter your official title for authorization.");
    if (!signatureToUse) return alert("Please select or upload an official signature in Staff Setup first.");
    
    setIsApprovingClosure(true);
    const steps = [
      'Authenticating Credentials...',
      'Verifying Premise Dossier...',
      'Signing Decommissioning Notice...',
      'Finalizing Cessation...'
    ];

    for (const s of steps) {
      setClosureApprovalStatus(s);
      await new Promise(r => setTimeout(r, 800));
    }

    if (!selectedClosure) return;
    onClosureAction(selectedClosure.id, 'approve', { 
      signature: signatureToUse, 
      name: adminName || activeSig?.name || 'Authorized Officer',
      title: closureOfficerTitle || activeSig?.title || 'Compliance Officer',
      comments: closureOfficerComments
    });
    setIsApprovingClosure(false);
    setAdminName('');
    setClosureOfficerTitle('');
    setClosureOfficerComments('');
  };

  const handleRejectClosure = () => {
    if (!closureRejectionReason) return alert("Please provide a reason for rejection.");
    if (selectedClosure) {
      onClosureAction(selectedClosure.id, 'reject', { signature: '', name: 'KDB Admin', reason: closureRejectionReason });
    }
    setIsRejectingClosure(false);
    setClosureRejectionReason('');
  };

  const exportLedgerCSV = () => {
    if (debtors.length === 0) {
      alert("No debtors in the ledger to export.");
      return;
    }
    const headers = [
      'DBO Name',
      'Premise Name',
      'Permit No',
      'Location',
      'County',
      'Arrears Periods',
      'Outstanding Balance (KES)',
      'Debit Note No',
      'Telephone'
    ];
    const rows = debtors.map(d => [
      d.dboName,
      d.premiseName,
      d.permitNo,
      d.location,
      d.county,
      d.arrearsPeriod,
      d.totalArrears,
      d.debitNoteNo,
      d.tel
    ]);
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const formatted = row.map(val => {
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(formatted.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kdb_debtors_ledger_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSignatureUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onStaffUpdate({ officialSignature: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleAddAuthoritySignature = async () => {
    let sigData = newSigImage;
    if (newSigMode === 'draw' && newSigCanvasRef.current) {
      if (newSigCanvasRef.current.isEmpty()) {
        alert('Please draw an authority signature on the canvas or switch to upload mode.');
        return;
      }
      sigData = newSigCanvasRef.current.toDataURL('image/png');
    }

    if (!newSigName.trim()) {
      alert('Please enter the officer name for this signature.');
      return;
    }
    if (!sigData) {
      alert('Please provide a signature (either draw live or upload an image file).');
      return;
    }

    setIsSavingSig(true);
    try {
      const updated = await DBService.addAuthoritySignature({
        name: newSigName.trim(),
        title: newSigTitle.trim() || undefined,
        signature: sigData,
        isDefault: authoritySigs.length === 0
      });
      setAuthoritySigs(updated);
      if (authoritySigs.length === 0 || !staffConfig.officialSignature) {
        onStaffUpdate({
          ...staffConfig,
          authoritySignatures: updated,
          officialSignature: sigData,
          officialName: newSigName.trim(),
          officialTitle: newSigTitle.trim() || staffConfig.officialTitle
        });
      } else {
        onStaffUpdate({
          ...staffConfig,
          authoritySignatures: updated
        });
      }
      setNewSigName('');
      setNewSigTitle('');
      setNewSigImage('');
      setShowAddSigModal(false);
    } catch (err: any) {
      alert('Failed to save signature: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingSig(false);
    }
  };

  const handleDeleteAuthoritySignature = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this authority signature?')) return;
    const updated = await DBService.deleteAuthoritySignature(id);
    setAuthoritySigs(updated);
    if (updated.length > 0) {
      const def = updated.find(s => s.isDefault) || updated[0];
      onStaffUpdate({
        ...staffConfig,
        authoritySignatures: updated,
        officialSignature: def.signature,
        officialName: def.name,
        officialTitle: def.title || staffConfig.officialTitle
      });
    } else {
      onStaffUpdate({
        ...staffConfig,
        authoritySignatures: [],
        officialSignature: ''
      });
    }
  };

  const handleSetDefaultAuthoritySignature = async (sig: AuthoritySignature) => {
    const updated = authoritySigs.map(s => ({
      ...s,
      isDefault: s.id === sig.id
    }));
    await DBService.saveAuthoritySignatures(updated);
    setAuthoritySigs(updated);
    onStaffUpdate({
      ...staffConfig,
      authoritySignatures: updated,
      officialSignature: sig.signature,
      officialName: sig.name,
      officialTitle: sig.title || staffConfig.officialTitle
    });
  };

  const handleMoveAuthoritySignature = async (id: string, direction: 'up' | 'down') => {
    const updated = await DBService.moveAuthoritySignature(id, direction);
    setAuthoritySigs(updated);
    onStaffUpdate({
      ...staffConfig,
      authoritySignatures: updated
    });
  };

  const handleMoveToTop = async (id: string) => {
    const index = authoritySigs.findIndex(s => s.id === id);
    if (index <= 0) return;
    const reordered = [...authoritySigs];
    const [item] = reordered.splice(index, 1);
    reordered.unshift(item);
    await DBService.saveAuthoritySignatures(reordered);
    setAuthoritySigs(reordered);
    onStaffUpdate({
      ...staffConfig,
      authoritySignatures: reordered
    });
  };

  const handleMoveToBottom = async (id: string) => {
    const index = authoritySigs.findIndex(s => s.id === id);
    if (index === -1 || index === authoritySigs.length - 1) return;
    const reordered = [...authoritySigs];
    const [item] = reordered.splice(index, 1);
    reordered.push(item);
    await DBService.saveAuthoritySignatures(reordered);
    setAuthoritySigs(reordered);
    onStaffUpdate({
      ...staffConfig,
      authoritySignatures: reordered
    });
  };

  const handleFileChangeForNewSig = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setNewSigImage(canvas.toDataURL('image/png', 0.85));
        } else {
          setNewSigImage(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditAuthoritySignature = (sig: AuthoritySignature) => {
    setEditingSig(sig);
    setEditSigName(sig.name);
    setEditSigTitle(sig.title || '');
    setEditSigImage(sig.signature);
    setEditSigIsDefault(!!sig.isDefault);
    setEditSigMode('upload');
  };

  const handleFileChangeForEditSig = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setEditSigImage(canvas.toDataURL('image/png', 0.85));
        } else {
          setEditSigImage(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditAuthoritySignature = async () => {
    if (!editingSig) return;
    if (!editSigName.trim()) {
      alert('Please provide the officer name.');
      return;
    }

    let sigData = editSigImage;
    if (editSigMode === 'draw' && editSigCanvasRef.current) {
      if (!editSigCanvasRef.current.isEmpty()) {
        sigData = editSigCanvasRef.current.toDataURL('image/png');
      }
    }

    if (!sigData) {
      alert('Signature image cannot be empty.');
      return;
    }

    setIsSavingEditSig(true);
    try {
      const updatedItem: AuthoritySignature = {
        ...editingSig,
        name: editSigName.trim(),
        title: editSigTitle.trim() || undefined,
        signature: sigData,
        isDefault: editSigIsDefault
      };
      const updated = await DBService.updateAuthoritySignature(updatedItem);
      setAuthoritySigs(updated);

      if (editSigIsDefault || staffConfig.officialSignature === editingSig.signature) {
        onStaffUpdate({
          ...staffConfig,
          authoritySignatures: updated,
          officialSignature: sigData,
          officialName: editSigName.trim(),
          officialTitle: editSigTitle.trim() || staffConfig.officialTitle
        });
      } else {
        onStaffUpdate({
          ...staffConfig,
          authoritySignatures: updated
        });
      }

      setEditingSig(null);
    } catch (err: any) {
      alert('Failed to update signature: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingEditSig(false);
    }
  };

  const handleApprove = async () => {
    const activeSig = authoritySigs.find(s => s.id === selectedSigningSigId) || authoritySigs.find(s => s.isDefault) || authoritySigs[0];
    const signatureToUse = activeSig?.signature || staffConfig.officialSignature;
    if (!adminName && !activeSig?.name) return alert("Please enter your name for authorization.");
    if (!signatureToUse) return alert("Please select or upload an official signature in Staff Setup first.");
    
    setIsApproving(true);
    const steps = [
      'Authenticating Credentials...',
      'Applying Digital Signature...',
      'Generating Execution PDF...',
      'Finalizing Approval...'
    ];

    for (const s of steps) {
      setApprovalStatus(s);
      await new Promise(r => setTimeout(r, 800));
    }

    if (!selectedReview) return;
    onAction(selectedReview.id, 'approve', { signature: signatureToUse, name: adminName || activeSig?.name || 'Authorized Officer' });
    setIsApproving(false);
    setAdminName('');
  };

  const handleReject = () => {
    if (!rejectionReason) return alert("Please provide a reason.");
    if (selectedReview) {
      onAction(selectedReview.id, 'reject', { signature: '', name: 'KDB Admin', reason: rejectionReason });
    }
    setIsRejecting(false);
    setRejectionReason('');
  };

  const [isSavingDebtor, setIsSavingDebtor] = useState(false);

  const handleAddDebtor = async () => {
    if (!newDebtor.dboName || !newDebtor.permitNo || !newDebtor.totalArrears) {
      return alert("Please fill in all required fields.");
    }

    setIsSavingDebtor(true);
    try {
      const finalInstallments = newDebtor.installments || [];
      const totalFromInst = finalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const totalArrears = totalFromInst || newDebtor.totalArrears || 0;
      
      const arrearsPeriod = finalInstallments.map(i => i.period).filter(Boolean).join(', ') || 'Current';

      if (editingDebtorId) {
        const updatedDebtors = debtors.map(d => d.id === editingDebtorId ? {
          ...(newDebtor as DebtorRecord),
          id: editingDebtorId,
          totalArrears,
          totalArrearsWords: numberToWords(totalArrears),
          installments: finalInstallments,
          arrearsPeriod
        } : d);
        await onDebtorUpdate(updatedDebtors);
      } else {
        const id = `D${Math.floor(Math.random() * 10000).toString().padStart(3, '0')}`;
        const debtor: DebtorRecord = {
          ...(newDebtor as DebtorRecord),
          id,
          totalArrears,
          arrearsBreakdown: finalInstallments.map((inst, i) => ({ id: String(i), month: inst.period, amount: inst.amount })),
          totalArrearsWords: numberToWords(totalArrears),
          arrearsPeriod,
          installments: finalInstallments
        };
        await onDebtorUpdate([...debtors, debtor]);
      }

    } catch (error: any) {
      console.error("Error in handleAddDebtor:", error);
      alert("Failed to save entry: " + error.message);
    } finally {
      setIsSavingDebtor(false);
      setIsAddingDebtor(false);
      setEditingDebtorId(null);
      setNewDebtor({
        dboName: '',
        premiseName: '',
        permitNo: '',
        county: '',
        location: '',
        totalArrears: 0,
        tel: '',
        debitNoteNo: '',
        arrearsBreakdown: [],
        installments: [{ no: 1, period: '', dueDate: '', amount: 0 }]
      });
    }
  };

  const handleEditDebtor = (debtor: DebtorRecord) => {
    setEditingDebtorId(debtor.id);
    setNewDebtor(debtor);
    setIsAddingDebtor(true);
  };

  const handleDownloadPDF = async () => {
    if (!selectedReview) return;
    await downloadAgreementPDF(selectedReview, 'formal-agreement-hidden');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-0 py-2 sm:py-4">
      {/* Hidden PDF Generation Container - Moved off-screen but kept in layout for html2canvas */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', width: '1024px', zIndex: -1000, overflow: 'hidden' }}>
        {selectedReview && (
          <PDFPreview agreement={selectedReview} onClose={() => {}} isHidden />
        )}
        {selectedClosure && (
          <ClosurePDFPreview closure={selectedClosure} onClose={() => {}} isHidden />
        )}
      </div>

      {showPreview && selectedReview && (
        <PDFPreview agreement={selectedReview} onClose={() => setShowPreview(false)} />
      )}

      {showClosurePreview && selectedClosure && (
        <ClosurePDFPreview closure={selectedClosure} onClose={() => setShowClosurePreview(false)} />
      )}

      {isAddingDebtor && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-2xl w-full space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingDebtorId ? 'Edit Ledger Entry' : 'Add New Ledger Entry'}</h3>
              <button onClick={() => { setIsAddingDebtor(false); setEditingDebtorId(null); }} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Dairy Business Operator (DBO) Name</label>
                <input value={newDebtor.dboName} onChange={e => setNewDebtor({...newDebtor, dboName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="e.g. Sunrise Dairy" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Premise Name</label>
                <input value={newDebtor.premiseName} onChange={e => setNewDebtor({...newDebtor, premiseName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="e.g. Sunrise Depot" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Permit No</label>
                <input value={newDebtor.permitNo} onChange={e => setNewDebtor({...newDebtor, permitNo: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="KDB/MB/..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">County</label>
                <input value={newDebtor.county} onChange={e => setNewDebtor({...newDebtor, county: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="e.g. Kericho" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                <input value={newDebtor.location} onChange={e => setNewDebtor({...newDebtor, location: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="e.g. Thika Rd" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Total Arrears Amount</label>
                <input type="number" value={newDebtor.totalArrears} onChange={e => setNewDebtor({...newDebtor, totalArrears: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Phone No (Secret)</label>
                <input value={newDebtor.tel} onChange={e => setNewDebtor({...newDebtor, tel: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="07..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Debit Note No (Alt Secret)</label>
                <input value={newDebtor.debitNoteNo} onChange={e => setNewDebtor({...newDebtor, debitNoteNo: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="DN/..." />
              </div>
              <div className="md:col-span-2 border-t pt-4 mt-2">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Installment Configuration</h4>
                  <button onClick={addInstallmentRow} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center">
                    <Plus className="w-3 h-3 mr-1" /> Add Installment
                  </button>
                </div>
                <div className="space-y-3">
                  {newDebtor.installments?.map((inst, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="md:col-span-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">No.</label>
                        <div className="text-xs font-bold text-slate-600 px-2">{inst.no}</div>
                      </div>
                      <div className="md:col-span-6">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">CSL Period (e.g. Jan 2024)</label>
                        <input value={inst.period} onChange={e => updateInstallmentRow(idx, 'period', e.target.value)} className="w-full px-3 py-2 bg-white border rounded-lg font-bold text-xs" placeholder="Jan 2024" />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount (KES)</label>
                        <input type="number" value={inst.amount} onChange={e => updateInstallmentRow(idx, 'amount', Number(e.target.value))} className="w-full px-3 py-2 bg-white border rounded-lg font-bold text-xs" placeholder="0.00" />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <button onClick={() => removeInstallmentRow(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button 
              disabled={isSavingDebtor}
              onClick={handleAddDebtor} 
              className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center disabled:opacity-50"
            >
              {isSavingDebtor ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingDebtorId ? 'Update Ledger Entry' : 'Save to Ledger'
              )}
            </button>
          </div>
        </div>
      )}

      {isApproving && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-8">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-slate-800">Review in Progress</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium">{approvalStatus}</p>
            </div>
          </div>
        </div>
      )}

      {isApprovingClosure && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-8">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <Loader2 className="w-16 h-16 text-red-600 animate-spin mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-slate-800">Cessation Processing</h3>
              <p className="text-sm text-slate-500 mt-2 font-medium">{closureApprovalStatus}</p>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE HAMBURGER MENU NAVIGATION BAR (Visible on Mobile & Tablet) */}
      <div className="lg:hidden bg-white p-3 rounded-none sm:rounded-2xl border-y sm:border border-slate-200 shadow-sm mb-4 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center shadow-md active:scale-95"
              title="Toggle Workspace Navigation"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800">{getTabLabel(tab)}</span>
              {tab === 'requests_to_approve' && pendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 text-[9px] bg-rose-500 text-white rounded-full font-black animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isSyncing}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200"
                title="Refresh Data"
              >
                <Loader2 className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Hamburger Dropdown / Drawer */}
        {isMobileMenuOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 animate-in slide-in-from-top-3 duration-200">
            <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Select Module</div>
            
            <button 
              onClick={() => changeTab('data_validation')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${tab === 'data_validation' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <FileCheck className="w-4 h-4 mr-3 shrink-0" />
                Data Validation Form
              </div>
              {tab === 'data_validation' && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            <button 
              onClick={() => changeTab('scope_disclosure')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${tab === 'scope_disclosure' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-3 shrink-0" />
                Scope Disclosure Form
              </div>
              {tab === 'scope_disclosure' && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            <button 
              onClick={() => changeTab('requests_to_approve')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${tab === 'requests_to_approve' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <FileCheck className="w-4 h-4 mr-3 shrink-0" />
                Requests to Approve
              </div>
              {pendingRequestsCount > 0 ? (
                <span className="px-2 py-0.5 text-[9px] bg-rose-500 text-white rounded-full font-black animate-pulse">
                  {pendingRequestsCount} Pending
                </span>
              ) : tab === 'requests_to_approve' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : null}
            </button>

            <button 
              onClick={() => changeTab('clients_returns')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${(tab === 'clients_returns' || tab === 'clients' || tab === 'returns') ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <Building className="w-4 h-4 mr-3 shrink-0" />
                Clients & Returns Hub
              </div>
              {(tab === 'clients_returns' || tab === 'clients' || tab === 'returns') && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            <button 
              onClick={() => changeTab('reports')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${tab === 'reports' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-3 shrink-0" />
                Compliance Reports
              </div>
              {tab === 'reports' && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            <button 
              onClick={() => changeTab('settings')} 
              className={`px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-between w-full text-left ${tab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-3 shrink-0" />
                System Settings
              </div>
              {tab === 'settings' && <Check className="w-4 h-4 text-emerald-400" />}
            </button>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigate('/'); }} 
                className="px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 w-full text-left"
              >
                <Globe className="w-4 h-4 mr-3 shrink-0" />
                Return to Client Portal
              </button>

              {user && (
                <button 
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
                    await signOut();
                    navigate('/');
                  }} 
                  className="px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 w-full text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-3 shrink-0" />
                  <span className="truncate">Sign Out ({user.user_metadata?.full_name || user.email})</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* DESKTOP SIDEBAR (Visible on Desktop) */}
        <aside className={`hidden lg:flex flex-col gap-6 lg:sticky lg:top-24 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm print:hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'} shrink-0`}>
          <div className="flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Admin Workspace</h2>
                  {onRefresh && (
                    <button 
                      onClick={onRefresh}
                      disabled={isSyncing}
                      className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-emerald-600"
                      title="Refresh Data"
                    >
                      <Loader2 className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                  )}
                </div>
                <p className="text-slate-400 font-medium text-[10px] mt-0.5">Operational control for levy compliance.</p>
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all ${isSidebarCollapsed ? 'mx-auto' : ''}`}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <button 
              onClick={() => changeTab('data_validation')} 
              title="Data Validation Form"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${tab === 'data_validation' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileCheck className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Data Validation Form</span>}
            </button>

            <button 
              onClick={() => changeTab('scope_disclosure')} 
              title="Scope Disclosure Form"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${tab === 'scope_disclosure' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileText className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Scope Disclosure Form</span>}
            </button>

            <button 
              onClick={() => navigate('/')} 
              title="Client Portal"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center text-emerald-600 hover:bg-emerald-50 border border-emerald-100 ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'}`}
            >
              <Globe className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Client Portal</span>}
            </button>

            <div className="h-px bg-slate-100 my-1"></div>

            <button 
              onClick={() => changeTab('requests_to_approve')} 
              title="Requests to Approve"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center relative ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${tab === 'requests_to_approve' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileCheck className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed ? (
                <>
                  <span>Requests to Approve</span>
                  {pendingRequestsCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[8px] bg-rose-500 text-white rounded-full font-bold animate-pulse">
                      {pendingRequestsCount}
                    </span>
                  )}
                </>
              ) : (
                pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                    {pendingRequestsCount}
                  </span>
                )
              )}
            </button>

            <button 
              onClick={() => changeTab('clients_returns')} 
              title="Clients & Returns Hub"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${(tab === 'clients_returns' || tab === 'clients' || tab === 'returns') ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Building className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Clients & Returns</span>}
            </button>

            <button 
              onClick={() => changeTab('reports')} 
              title="Compliance Reports"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${tab === 'reports' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Reports</span>}
            </button>

            <button 
              onClick={() => changeTab('settings')} 
              title="System Settings"
              className={`px-3 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'w-full text-left'} ${tab === 'settings' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Settings className={`w-3.5 h-3.5 shrink-0 ${isSidebarCollapsed ? '' : 'mr-2.5'}`} />
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
          </div>

          {/* Admin User Profile Card in Sidebar */}
          {user && (
            <div className="pt-4 mt-auto border-t border-slate-100 flex flex-col gap-2">
              {!isSidebarCollapsed ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 truncate" title={user?.email || ''}>
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'}
                      </p>
                      <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">
                        Supabase Auth
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate('/');
                    }}
                    className="w-full mt-2.5 py-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                  }}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all cursor-pointer mx-auto"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </aside>

        {/* RIGHT CONTENT AREA */}
        <div className="flex-1 min-w-0 w-full">

      {tab === 'requests_to_approve' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex bg-slate-100 p-1 rounded-2xl max-w-4xl border border-slate-200 overflow-x-auto">
            <button 
              onClick={() => { setApprovalSubTab('agreements'); }}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2 whitespace-nowrap ${approvalSubTab === 'agreements' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <FileCheck className="w-4 h-4" /> Submitted Debt Agreements
              {agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length > 0 && (
                <span className="px-1.5 py-0.5 text-[8px] bg-rose-500 text-white rounded-full font-black">
                  {agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length}
                </span>
              )}
            </button>
            <button 
              onClick={() => { setApprovalSubTab('cessations'); }}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2 whitespace-nowrap ${approvalSubTab === 'cessations' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Briefcase className="w-4 h-4" /> Submitted Cessations
              {closures.filter(c => c.status === 'submitted').length > 0 && (
                <span className="px-1.5 py-0.5 text-[8px] bg-rose-500 text-white rounded-full font-black animate-pulse">
                  {closures.filter(c => c.status === 'submitted').length}
                </span>
              )}
            </button>
          </div>

          {approvalSubTab === 'agreements' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-300">
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.3em]">Submissions Inbox</h3>
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black">{agreements.length} Total</span>
            </div>
            {agreements.length === 0 ? (
              <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-slate-200 text-center text-slate-400 text-sm font-medium">No documents awaiting review</div>
            ) : (
              agreements.map(a => (
                <div key={a.id} className="relative group">
                  <button onClick={() => { setSelectedReviewId(a.id); setIsRejecting(false); }} className={`w-full p-6 rounded-[32px] border text-left transition-all ${selectedReviewId === a.id ? 'border-emerald-600 bg-emerald-50/50 shadow-xl' : 'border-white bg-white hover:border-emerald-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold text-slate-800 block truncate leading-tight">{a.dboName}</span>
                      <div className={`w-2 h-2 rounded-full ${a.status === 'submitted' ? 'bg-amber-400' : a.status === 'resubmission_requested' ? 'bg-purple-500 animate-pulse' : a.status === 'approved' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {a.county}</span>
                      <span>•</span>
                      <span className={a.status === 'resubmission_requested' ? 'text-purple-600 font-black' : ''}>
                        {a.status === 'resubmission_requested' ? 'Resubmission Request' : new Date(a.date).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteAgreement?.(a.id); }}
                    className="absolute top-4 right-4 p-2 bg-white text-rose-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 border border-rose-100 z-10"
                    title="Delete Submission"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-8">
            {selectedReview ? (
              <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="p-10 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{selectedReview.dboName}</h3>
                    <div className="flex items-center space-x-3 mt-1 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        <span>Permit: {selectedReview.permitNo}</span>
                        <span>|</span>
                        <span>{selectedReview.county} County</span>
                    </div>
                  </div>
                  <button onClick={() => setShowPreview(true)} className="flex items-center text-slate-600 font-black bg-slate-50 px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100">
                    <FileSearch className="w-4 h-4 mr-2" /> View Document
                  </button>
                </div>

                <div className="p-10 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><Briefcase className="w-3 h-3 mr-2" /> Profile Highlights</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Contact Email</span><span className="text-xs font-bold text-slate-700">{selectedReview.clientEmail}</span></div>
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Phone Number</span><span className="text-xs font-bold text-slate-700">{selectedReview.tel}</span></div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><FileText className="w-3 h-3 mr-2" /> Arrears Summary</h4>
                      <div className="p-6 bg-slate-900 rounded-[32px] text-white shadow-lg">
                        <div className="text-[9px] text-emerald-400 font-black uppercase tracking-widest mb-1">Total Obligation</div>
                        <div className="text-3xl font-black">KES {selectedReview.totalArrears.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><Calendar className="w-3 h-3 mr-2" /> Agreed Payment Schedule</h4>
                      <div className="border rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-50 font-black text-slate-400 uppercase text-[9px] tracking-widest">
                            <tr>
                              <th className="px-6 py-4">Inst.</th>
                              <th className="px-6 py-4">Period</th>
                              <th className="px-6 py-4">Due Date</th>
                              <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {selectedReview.installments.map((inst, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold">{inst.no}</td>
                                <td className="px-6 py-4 text-slate-500">{inst.period}</td>
                                <td className="px-6 py-4 font-black text-slate-700">{inst.dueDate || 'TBD'}</td>
                                <td className="px-6 py-4 text-right font-black text-emerald-600">KES {inst.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  </div>

                  <div className="space-y-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution Progress</h4>
                    <div className="flex items-center space-x-4">
                        <div className={`flex-1 h-2 rounded-full ${selectedReview.status !== 'draft' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                        <div className={`flex-1 h-2 rounded-full ${selectedReview.status === 'approved' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                        <div className={`flex-1 h-2 rounded-full ${selectedReview.status === 'approved' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Submitted</span>
                        <span>Review</span>
                        <span>Dispatched</span>
                    </div>
                  </div>

                  <div className="pt-10 border-t flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="space-y-5">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dairy Business Operator (DBO) Signatory</h4>
                      <div className="flex items-center space-x-5 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
                        <img src={selectedReview.clientSignature} className="h-20 w-32 object-contain bg-white rounded-2xl shadow-sm border border-slate-100 p-2" />
                        <div>
                          <div className="text-sm font-black text-slate-800">{selectedReview.clientName}</div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{selectedReview.clientTitle}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-grow max-w-sm w-full">
                      {selectedReview.status === 'submitted' ? (
                        <div className="space-y-4 bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 shadow-xl">
                          <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                            {isRejecting ? 'Provide Rejection Reason' : 'Countersign Agreement'}
                          </h4>
                          {isRejecting ? (
                            <div className="space-y-3">
                              <textarea 
                                placeholder="Enter reason for rejection or resubmission request..." 
                                className="w-full px-4 py-3 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm h-24 resize-none"
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                              />
                              <div className="flex gap-3">
                                <button onClick={() => setIsRejecting(false)} className="flex-1 py-3 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-white border border-slate-200 rounded-2xl">Cancel</button>
                                <button onClick={handleReject} className="flex-1 py-3 bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg hover:bg-rose-700">Submit Reject</button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {authoritySigs.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" /> Saved Signatures (Supabase)
                                    </span>
                                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded-full">
                                      Cloud Synced
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {authoritySigs.map((sig) => {
                                      const isSelected = selectedSigningSigId === sig.id || (!selectedSigningSigId && (sig.isDefault || sig.signature === staffConfig.officialSignature));
                                      return (
                                        <button
                                          key={sig.id}
                                          type="button"
                                          onClick={() => handleSelectSigningOfficer(sig)}
                                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                            isSelected 
                                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-300' 
                                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-7 bg-white rounded border border-slate-100 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                              <img src={sig.signature} alt={sig.name} className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs truncate">{sig.name}</p>
                                              <p className="text-[10px] text-slate-500 truncate font-normal">{sig.title || 'Authorized Officer'}</p>
                                            </div>
                                          </div>
                                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <input placeholder="Enter Authorized Name *" className="w-full px-6 py-4 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm" value={adminName} onChange={e => setAdminName(e.target.value)} />
                              <div className="flex gap-3">
                                <button onClick={() => setIsRejecting(true)} className="flex-1 py-4 text-rose-600 font-bold text-[10px] uppercase tracking-widest bg-white border border-rose-100 rounded-2xl hover:bg-rose-50 transition-all">Reject</button>
                                <button onClick={handleApprove} className="flex-2 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:bg-emerald-700 transition-all">Sign & Approve</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : selectedReview.status === 'resubmission_requested' ? (
                        <div className="space-y-6 bg-purple-50 p-8 rounded-[40px] border border-purple-100 shadow-xl">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Resubmission Request</h4>
                            <div className="p-4 bg-white rounded-2xl border border-purple-100 text-xs text-slate-600 italic leading-relaxed">
                              "{selectedReview.resubmissionReason}"
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={() => onAction(selectedReview.id, 'reject', { signature: '', name: 'KDB Admin', reason: 'Your request for re-submission has been declined.' })} 
                              className="flex-1 py-4 text-rose-600 font-bold text-[10px] uppercase tracking-widest bg-white border border-rose-100 rounded-2xl hover:bg-rose-50 transition-all"
                            >
                              Decline
                            </button>
                            <button 
                              onClick={() => onAction(selectedReview.id, 'reject', { signature: '', name: 'KDB Admin', reason: 'Re-submission request approved. You can now submit a new agreement.' })} 
                              className="flex-2 py-4 bg-purple-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:bg-purple-700 transition-all"
                            >
                              Allow Resubmission
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KDB Execution</h4>
                            <div className="flex items-center space-x-5 bg-emerald-50/50 p-6 rounded-[32px] border border-emerald-100">
                              <img src={selectedReview.officialSignature} className="h-20 w-32 object-contain" />
                              <div>
                                <div className="text-sm font-black text-slate-800">{selectedReview.officialName}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-emerald-600">Authorized & Sent</div>
                              </div>
                            </div>
                          </div>
                          
                          {selectedReview.status === 'approved' && (
                            <button 
                              onClick={handleDownloadPDF}
                              className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center"
                            >
                              <Download className="w-4 h-4 mr-2" /> Download Signed PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] text-slate-300 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                <Mail className="w-20 h-20 opacity-10 mb-8" />
                <p className="text-[10px] font-black tracking-[0.5em] uppercase text-center px-10">Inbox Empty. Waiting for operator submissions.</p>
              </div>
            )}
          </div>
        </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-300">
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.3em]">Submitted Cessations</h3>
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[9px] font-black">{closures?.length || 0} Total</span>
            </div>
            {(!closures || closures.length === 0) ? (
              <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-slate-200 text-center text-slate-400 text-sm font-medium">No business cessation notices</div>
            ) : (
              closures.map(c => (
                <div key={c.id} className="relative group">
                  <button onClick={() => { setSelectedClosureId(c.id); setIsRejectingClosure(false); }} className={`w-full p-6 rounded-[32px] border text-left transition-all ${selectedClosureId === c.id ? 'border-red-600 bg-red-50/50 shadow-xl' : 'border-white bg-white hover:border-red-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold text-slate-800 block truncate leading-tight w-[70%]">{c.dboName}</span>
                      <div className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${c.status === 'submitted' ? 'bg-amber-100 text-amber-700 animate-pulse' : c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {c.status}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {c.county}</span>
                      <span>•</span>
                      <span>{new Date(c.submittedAt || '').toLocaleDateString()}</span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteClosure?.(c.id); }}
                    className="absolute top-4 right-4 p-2 bg-white text-rose-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 border border-rose-100 z-10"
                    title="Delete Notice"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-8">
            {selectedClosure ? (
              <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-right-4 duration-300">
                <div className="p-10 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{selectedClosure.dboName}</h3>
                    <div className="flex items-center space-x-3 mt-1 text-slate-400 text-xs font-bold uppercase tracking-widest">
                      <span>Permit: {selectedClosure.permitNo}</span>
                      <span>|</span>
                      <span>{selectedClosure.county} County</span>
                    </div>
                  </div>
                  <button onClick={() => setShowClosurePreview(true)} className="flex items-center text-slate-600 font-black bg-slate-50 px-5 py-3 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-100">
                    <FileSearch className="w-4 h-4 mr-2" /> View Notice PDF
                  </button>
                </div>

                <div className="p-10 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><Briefcase className="w-3 h-3 mr-2" /> Premise Profile</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Premise Name</span><span className="text-xs font-bold text-slate-700">{selectedClosure.premiseName}</span></div>
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Business / Permit Type</span><span className="text-xs font-bold text-slate-700">{selectedClosure.permitType}</span></div>
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Phone Number</span><span className="text-xs font-bold text-slate-700">{selectedClosure.tel}</span></div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><AlertCircle className="w-3 h-3 mr-2" /> Cessation Specifics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center"><span className="text-xs text-slate-400 font-medium">Official Closure Date</span><span className="text-xs font-bold text-slate-700">{selectedClosure.closureDate}</span></div>
                      </div>
                    </div>
                  </div>

                  {selectedClosure.status === 'rejected' && selectedClosure.rejectionReason && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Rejection Details</h4>
                      <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-sm text-rose-700 italic font-medium leading-relaxed">
                        &quot;{selectedClosure.rejectionReason}&quot;
                      </div>
                    </div>
                  )}

                  <div className="pt-10 border-t flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="space-y-5">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator Signatory</h4>
                      <div className="flex items-center space-x-5 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
                        <img src={selectedClosure.clientSignature} className="h-20 w-32 object-contain bg-white rounded-2xl shadow-sm border border-slate-100 p-2" />
                        <div>
                          <div className="text-sm font-black text-slate-800">{selectedClosure.clientName}</div>
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DBO Applicant</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-grow max-w-sm w-full">
                      {selectedClosure.status === 'submitted' ? (
                        <div className="space-y-4 bg-red-50/60 p-8 rounded-[40px] border border-red-100 shadow-xl">
                          <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest">
                            {isRejectingClosure ? 'Provide Rejection Reason' : 'Countersign notice'}
                          </h4>
                          {isRejectingClosure ? (
                            <div className="space-y-3">
                              <textarea 
                                placeholder="Enter reason for rejecting this notification..." 
                                className="w-full px-4 py-3 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm h-24 resize-none"
                                value={closureRejectionReason}
                                onChange={e => setClosureRejectionReason(e.target.value)}
                              />
                              <div className="flex gap-3">
                                <button onClick={() => setIsRejectingClosure(false)} className="flex-1 py-3 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-white border border-slate-200 rounded-2xl">Cancel</button>
                                <button onClick={handleRejectClosure} className="flex-1 py-3 bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg hover:bg-rose-700">Submit Reject</button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {authoritySigs.length > 0 && (
                                <div className="space-y-1.5 mb-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" /> Saved Signatures (Supabase)
                                    </span>
                                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded-full">
                                      Cloud Synced
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {authoritySigs.map((sig) => {
                                      const isSelected = selectedSigningSigId === sig.id || (!selectedSigningSigId && (sig.isDefault || sig.signature === staffConfig.officialSignature));
                                      return (
                                        <button
                                          key={sig.id}
                                          type="button"
                                          onClick={() => handleSelectSigningOfficer(sig)}
                                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                            isSelected 
                                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-300' 
                                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-10 h-7 bg-white rounded border border-slate-100 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                                              <img src={sig.signature} alt={sig.name} className="max-h-full max-w-full object-contain" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs truncate">{sig.name}</p>
                                              <p className="text-[10px] text-slate-500 truncate font-normal">{sig.title || 'Authorized Officer'}</p>
                                            </div>
                                          </div>
                                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <input 
                                placeholder="Enter Authorized Name *" 
                                className="w-full px-6 py-4 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm" 
                                value={adminName} 
                                onChange={e => setAdminName(e.target.value)} 
                              />
                              <input 
                                placeholder="Enter Official Title (e.g. Compliance Officer) *" 
                                className="w-full px-6 py-4 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm" 
                                value={closureOfficerTitle} 
                                onChange={e => setClosureOfficerTitle(e.target.value)} 
                              />
                              <textarea 
                                placeholder="Enter Receipt Comments (Optional)" 
                                className="w-full px-6 py-3 border rounded-2xl text-xs bg-white font-bold outline-none shadow-sm h-20 resize-none" 
                                value={closureOfficerComments} 
                                onChange={e => setClosureOfficerComments(e.target.value)} 
                              />
                              <div className="flex gap-3 pt-2">
                                <button onClick={() => setIsRejectingClosure(true)} className="flex-1 py-4 text-rose-600 font-bold text-[10px] uppercase tracking-widest bg-white border border-rose-100 rounded-2xl hover:bg-rose-50 transition-all">Reject</button>
                                <button onClick={handleApproveClosure} className="flex-2 py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-[0.1em] rounded-2xl shadow-lg hover:bg-red-700 transition-all">Countersign notice</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {selectedClosure.status === 'approved' && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KDB Authorized Execution</h4>
                              <div className="flex items-center space-x-5 bg-emerald-50/50 p-6 rounded-[32px] border border-emerald-100">
                                <img src={selectedClosure.officialSignature} className="h-20 w-32 object-contain font-bold" />
                                <div>
                                  <div className="text-sm font-black text-slate-800">{selectedClosure.officialName}</div>
                                  {selectedClosure.officialTitle && (
                                    <div className="text-xs font-bold text-slate-500">{selectedClosure.officialTitle}</div>
                                  )}
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-emerald-600 mt-0.5">Deregistered & Filed</div>
                                </div>
                              </div>
                              {selectedClosure.officialComments && (
                                <div className="p-5 bg-amber-50/70 border border-amber-100 rounded-3xl text-xs text-amber-800 italic leading-relaxed font-bold">
                                  <strong className="not-italic font-black text-[9px] uppercase tracking-wider text-amber-500 block mb-1">Receipt Comments:</strong>
                                  &quot;{selectedClosure.officialComments}&quot;
                                </div>
                              )}
                            </div>
                          )}
                          
                          {selectedClosure.status === 'approved' && (
                            <button 
                              onClick={() => downloadClosurePDF(selectedClosure, 'closure-certificate-hidden')}
                              className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center"
                            >
                              <Download className="w-4 h-4 mr-2" /> Download Notification PDF
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] text-slate-300 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                <Briefcase className="w-20 h-20 opacity-10 mb-8" />
                <p className="text-[10px] font-black tracking-[0.5em] uppercase text-center px-10">Cessation Inbox Empty. Waiting for notifications.</p>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}

      {(tab === 'clients_returns' || tab === 'clients' || tab === 'returns') && (
        <div className="animate-in fade-in duration-300">
          <ClientsAndReturnsHub 
            initialTab={tab === 'returns' ? 'returns' : 'clients'} 
            debtors={debtors} 
            onDebtorUpdate={onDebtorUpdate} 
            onRefresh={onRefresh}
          />
        </div>
      )}

      {tab === 'data_validation' && (
        <div className="animate-in fade-in duration-500">
          <DataValidationModule />
        </div>
      )}

      {tab === 'scope_disclosure' && (
        <div className="animate-in fade-in duration-500">
          <ScopeDisclosureModule isAdmin={true} isStandalone={false} />
        </div>
      )}

      {tab === 'reports' && (
        <div className="animate-in fade-in duration-500">
          <ReportsModule />
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl space-y-10">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">KDB Execution Setup</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Manage your official digital identity and public client module availability.</p>
            </div>
            
            <div className="space-y-6">
                {/* Module Toggles Section */}
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200/80 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Globe className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">Client Portal Module Controls</h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Toggle public client-facing service modules on or off in the Client Portal.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAllModules(true)}
                        className="px-3 py-1.5 bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200/80 border border-emerald-300/80 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Show All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAllModules(false)}
                        className="px-3 py-1.5 bg-rose-100/80 text-rose-800 hover:bg-rose-200/80 border border-rose-300/80 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        Hide All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Module 1: Levy Payment Agreement */}
                    <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      staffConfig.enabledModules?.levyAgreement !== false ? 'bg-white border-emerald-200 shadow-sm' : 'bg-slate-100/80 border-slate-200 opacity-75'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-xl ${
                          staffConfig.enabledModules?.levyAgreement !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">Levy Arrears Payment Portal</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              staffConfig.enabledModules?.levyAgreement !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {staffConfig.enabledModules?.levyAgreement !== false ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Enable debtors to view arrears breakdown and propose payment schedules.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleModule('levyAgreement')}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          staffConfig.enabledModules?.levyAgreement !== false ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                        role="switch"
                        aria-checked={staffConfig.enabledModules?.levyAgreement !== false}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            staffConfig.enabledModules?.levyAgreement !== false ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Module 4: Business Closure Notification */}
                    <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      staffConfig.enabledModules?.businessClosure !== false ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-100/80 border-slate-200 opacity-75'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 rounded-xl ${
                          staffConfig.enabledModules?.businessClosure !== false ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">Business Closure & Cessation</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              staffConfig.enabledModules?.businessClosure !== false ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {staffConfig.enabledModules?.businessClosure !== false ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Allow licensees to formally notify KDB of business cessation or closures.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleModule('businessClosure')}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          staffConfig.enabledModules?.businessClosure !== false ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                        role="switch"
                        aria-checked={staffConfig.enabledModules?.businessClosure !== false}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            staffConfig.enabledModules?.businessClosure !== false ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`p-6 rounded-[32px] border flex flex-col space-y-4 transition-all ${systemHealth.clientSupabase ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Activity className={`w-5 h-5 ${systemHealth.clientSupabase ? 'text-emerald-500' : 'text-rose-500'}`} />
                            <div>
                              <span className={`text-xs font-bold block ${systemHealth.clientSupabase ? 'text-emerald-700' : 'text-rose-700'}`}>Cloud Persistence</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Supabase Integration Status</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {systemHealth.clientSupabase ? (
                              <div className="flex items-center space-x-3">
                                <span className="text-[9px] font-black text-emerald-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100">CLIENT: CONNECTED</span>
                              </div>
                          ) : (
                              <div className="flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                                <span className="text-[9px] font-black text-rose-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-rose-100 uppercase tracking-tight">CLIENT: OFFLINE</span>
                              </div>
                          )}
                          {systemHealth && (
                            <div className="flex items-center space-x-2">
                              {systemHealth.backendSupabase ? (
                                <span className="text-[9px] font-black text-emerald-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-emerald-100">BACKEND: CONNECTED</span>
                              ) : (
                                <span className="text-[9px] font-black text-rose-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-rose-100 uppercase tracking-tight">BACKEND: OFFLINE</span>
                              )}
                            </div>
                          )}
                        </div>
                    </div>

                    {!systemHealth.clientSupabase && (
                      <div className="p-4 bg-white/50 rounded-2xl border border-rose-200 space-y-2">
                        <p className="text-[10px] font-bold text-rose-700 uppercase tracking-tight">Missing Configuration:</p>
                        <ul className="text-[9px] text-rose-600 space-y-1 list-disc ml-4 font-medium">
                          <li>VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set in environment</li>
                        </ul>
                        <p className="text-[9px] text-slate-500 italic mt-2">Add these to your project settings to enable Cloud Sync.</p>
                      </div>
                    )}

                    {systemHealth?.status === 'error' && (
                      <div className="p-5 bg-rose-50 rounded-[32px] border border-rose-200 space-y-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Supabase Connection Error</p>
                            <p className="text-[11px] text-rose-600 font-bold leading-relaxed">{systemHealth.message}</p>
                            {systemHealth.details && <p className="text-[9px] text-rose-500 font-medium italic mt-1">{systemHealth.details}</p>}
                          </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-rose-100 space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Database Schema</p>
                          <p className="text-[10px] text-slate-600 font-medium">If you haven't set up your tables yet, copy and run this SQL in your Supabase SQL Editor:</p>
                          
                          <div className="relative group">
                            <div className="bg-slate-900 rounded-xl p-3 overflow-x-auto max-h-[200px] scrollbar-thin scrollbar-thumb-slate-700">
                              <pre className="text-[9px] text-emerald-400 font-mono leading-relaxed">
{`CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  clientemail TEXT,
  pobox TEXT,
  code TEXT,
  clientsignature TEXT,
  officialsignature TEXT,
  officialname TEXT,
  rejectionreason TEXT,
  resubmissionreason TEXT,
  clientname TEXT,
  clienttitle TEXT,
  submittedat TEXT,
  approvedat TEXT,
  dboname TEXT,
  premisename TEXT,
  permitno TEXT,
  location TEXT,
  county TEXT,
  totalarrears NUMERIC,
  totalarrearswords TEXT,
  arrearsperiod TEXT,
  debitnoteno TEXT,
  tel TEXT,
  arrearsbreakdown JSONB,
  installments JSONB
);

CREATE TABLE IF NOT EXISTS debtors (
  id TEXT PRIMARY KEY,
  dboname TEXT NOT NULL,
  premisename TEXT,
  permitno TEXT,
  location TEXT,
  county TEXT,
  totalarrears NUMERIC,
  totalarrearswords TEXT,
  arrearsperiod TEXT,
  debitnoteno TEXT,
  tel TEXT,
  arrearsbreakdown JSONB,
  installments JSONB
);

-- Note: To drop uniqueness constraint from an existing database, run:
-- ALTER TABLE debtors DROP CONSTRAINT IF EXISTS debtors_permitno_key;

CREATE TABLE IF NOT EXISTS staff_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  officialsignature TEXT
);

CREATE TABLE IF NOT EXISTS closures (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  submittedat TEXT,
  approvedat TEXT,
  dboname TEXT,
  permitno TEXT,
  premisename TEXT,
  permittype TEXT,
  county TEXT,
  subcounty TEXT,
  location TEXT,
  tel TEXT,
  closuredate TEXT,
  closurereason TEXT,
  permitstatusintent TEXT,
  declarationagreed BOOLEAN,
  clientsignature TEXT,
  clientname TEXT,
  officialsignature TEXT,
  officialname TEXT,
  rejectionreason TEXT
);

CREATE TABLE IF NOT EXISTS scope_disclosures (
  id TEXT PRIMARY KEY,
  dboname TEXT,
  permitno TEXT,
  premisename TEXT,
  location TEXT,
  category TEXT,
  signername TEXT,
  signerdesignation TEXT,
  signature TEXT,
  signeddate TEXT,
  status TEXT DEFAULT 'draft',
  createdat TEXT,
  updatedat TEXT,
  signedat TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policies for anonymous access if needed
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON agreements FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON debtors FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE staff_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON staff_config FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON closures FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE scope_disclosures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON scope_disclosures FOR ALL USING (true) WITH CHECK (true);`}
                              </pre>
                            </div>
                            <button 
                              onClick={() => {
                                const sql = `CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  clientemail TEXT,
  pobox TEXT,
  code TEXT,
  clientsignature TEXT,
  officialsignature TEXT,
  officialname TEXT,
  rejectionreason TEXT,
  resubmissionreason TEXT,
  clientname TEXT,
  clienttitle TEXT,
  submittedat TEXT,
  approvedat TEXT,
  dboname TEXT,
  premisename TEXT,
  permitno TEXT,
  location TEXT,
  county TEXT,
  totalarrears NUMERIC,
  totalarrearswords TEXT,
  arrearsperiod TEXT,
  debitnoteno TEXT,
  tel TEXT,
  arrearsbreakdown JSONB,
  installments JSONB
);

CREATE TABLE IF NOT EXISTS debtors (
  id TEXT PRIMARY KEY,
  dboname TEXT NOT NULL,
  premisename TEXT,
  permitno TEXT,
  location TEXT,
  county TEXT,
  totalarrears NUMERIC,
  totalarrearswords TEXT,
  arrearsperiod TEXT,
  debitnoteno TEXT,
  tel TEXT,
  arrearsbreakdown JSONB,
  installments JSONB
);

-- Note: To drop uniqueness constraint from an existing database, run:
-- ALTER TABLE debtors DROP CONSTRAINT IF EXISTS debtors_permitno_key;

CREATE TABLE IF NOT EXISTS staff_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  officialsignature TEXT
);

CREATE TABLE IF NOT EXISTS closures (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  submittedat TEXT,
  approvedat TEXT,
  dboname TEXT,
  permitno TEXT,
  premisename TEXT,
  permittype TEXT,
  county TEXT,
  subcounty TEXT,
  location TEXT,
  tel TEXT,
  closuredate TEXT,
  closurereason TEXT,
  permitstatusintent TEXT,
  declarationagreed BOOLEAN,
  clientsignature TEXT,
  clientname TEXT,
  officialsignature TEXT,
  officialname TEXT,
  rejectionreason TEXT
);

CREATE TABLE IF NOT EXISTS scope_disclosures (
  id TEXT PRIMARY KEY,
  dboname TEXT,
  permitno TEXT,
  premisename TEXT,
  location TEXT,
  category TEXT,
  signername TEXT,
  signerdesignation TEXT,
  signature TEXT,
  signeddate TEXT,
  status TEXT DEFAULT 'draft',
  createdat TEXT,
  updatedat TEXT,
  signedat TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON agreements FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON debtors FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE staff_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON staff_config FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON closures FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE scope_disclosures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON scope_disclosures FOR ALL USING (true) WITH CHECK (true);`;
                                navigator.clipboard.writeText(sql);
                                alert("SQL copied to clipboard!");
                              }}
                              className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest transition-colors"
                            >
                              Copy SQL
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {systemHealth.clientSupabase ? (
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="text-[10px] font-bold text-emerald-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-emerald-100">
                          Primary Data Store: Supabase Cloud
                        </div>
                      </div>
                    ) : null}
                </div>

                {/* Multi-Authority Signatures Registry */}
                <div className="space-y-6 bg-slate-50 p-6 sm:p-8 rounded-[32px] border border-slate-100">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="font-bold text-slate-800 text-base">Authority Signatures Registry</h4>
                        <span className="text-[10px] font-black text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                          {authoritySigs.length} Registered
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Supabase Cloud Synced
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Signatures are stored directly in Supabase Cloud for easy multi-device signing retrieval and real-time synchronization.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        disabled={isSyncingSigs}
                        onClick={() => loadSignatures(true)}
                        className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        title="Re-sync authority signatures from Supabase Cloud"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingSigs ? 'animate-spin' : ''}`} />
                        <span>{isSyncingSigs ? 'Syncing...' : 'Sync Cloud'}</span>
                      </button>
                      {authoritySigs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setShowReorderModal(true)}
                          className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                          title="Reorder priority of authority signatures"
                        >
                          <ArrowUpDown className="w-4 h-4 text-blue-600" />
                          <span>Reorder Priority</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAddSigModal(true)}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" /> Add Authority Signature
                      </button>
                    </div>
                  </div>

                  {/* Reorder Signatures Modal */}
                  {showReorderModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
                      <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-slate-200 shadow-2xl space-y-5">
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                                <ArrowUpDown className="w-4 h-4" />
                              </span>
                              <h4 className="font-bold text-slate-900 text-base">Reorder Authority Signatures</h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Arrange the display priority. Signatures at position #1 will appear first in Data Validation selection and official documents.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowReorderModal(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                          {authoritySigs.map((sig, index) => {
                            const isDefault = sig.isDefault || (!authoritySigs.some(s => s.isDefault) && sig.signature === staffConfig.officialSignature);
                            const isFirst = index === 0;
                            const isLast = index === authoritySigs.length - 1;
                            return (
                              <div
                                key={sig.id}
                                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                  isDefault ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-7 h-7 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black shrink-0">
                                    #{index + 1}
                                  </span>
                                  <div className="w-16 h-10 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-1 overflow-hidden shrink-0">
                                    <img src={sig.signature} alt={sig.name} className="max-h-full max-w-full object-contain" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900 truncate">{sig.name}</span>
                                      {isDefault && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {sig.title || 'Authorized Officer'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditAuthoritySignature(sig)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit this signature"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isFirst}
                                    onClick={() => handleMoveToTop(sig.id)}
                                    className="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[10px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move directly to top (#1)"
                                  >
                                    Top
                                  </button>
                                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
                                    <button
                                      type="button"
                                      disabled={isFirst}
                                      onClick={() => handleMoveAuthoritySignature(sig.id, 'up')}
                                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                      title="Move up one position"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLast}
                                      onClick={() => handleMoveAuthoritySignature(sig.id, 'down')}
                                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                      title="Move down one position"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isLast}
                                    onClick={() => handleMoveToBottom(sig.id)}
                                    className="px-2 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[10px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                                    title="Move directly to bottom"
                                  >
                                    Bottom
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-400">
                            Changes are auto-saved in real time
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowReorderModal(false)}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Done Reordering
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add Signature Inline Form */}
                  {showAddSigModal && (
                    <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">New Authority Signature Profile</h5>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddSigModal(false);
                            setNewSigName('');
                            setNewSigTitle('');
                            setNewSigImage('');
                          }}
                          className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Officer Full Name *</label>
                          <input
                            type="text"
                            value={newSigName}
                            onChange={(e) => setNewSigName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation / Title (Optional)</label>
                          <input
                            type="text"
                            value={newSigTitle}
                            onChange={(e) => setNewSigTitle(e.target.value)}
                            placeholder="e.g. Compliance Officer"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Signature Input *</label>
                          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => setNewSigMode('upload')}
                              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                newSigMode === 'upload' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500'
                              }`}
                            >
                              Upload File
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewSigMode('draw')}
                              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                newSigMode === 'draw' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500'
                              }`}
                            >
                              Draw Live
                            </button>
                          </div>
                        </div>

                        {newSigMode === 'upload' ? (
                          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                            <div className="w-36 h-20 bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                              {newSigImage ? (
                                <img src={newSigImage} alt="Preview" className="max-h-full max-w-full object-contain" />
                              ) : (
                                <Upload className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChangeForNewSig(e.target.files?.[0] || null)}
                                className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                              />
                              <p className="text-[10px] text-slate-400 mt-1">PNG or JPEG format with transparent or white background.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-1 bg-slate-50">
                              <SignatureCanvas
                                ref={newSigCanvasRef}
                                penColor="#0f172a"
                                canvasProps={{
                                  className: 'w-full h-28 bg-white rounded-lg border border-slate-100 cursor-crosshair'
                                }}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => newSigCanvasRef.current?.clear()}
                                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 cursor-pointer"
                              >
                                Clear Canvas
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddSigModal(false);
                            setNewSigName('');
                            setNewSigTitle('');
                            setNewSigImage('');
                          }}
                          className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingSig}
                          onClick={handleAddAuthoritySignature}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Save Signature
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit Signature Modal */}
                  {editingSig && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4">
                      <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-2xl max-w-lg w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-blue-600" />
                            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Edit Authority Signature Profile</h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingSig(null)}
                            className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Officer Full Name *</label>
                            <input
                              type="text"
                              value={editSigName}
                              onChange={(e) => setEditSigName(e.target.value)}
                              placeholder="e.g. Officer John Doe"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Designation / Title (Optional)</label>
                            <input
                              type="text"
                              value={editSigTitle}
                              onChange={(e) => setEditSigTitle(e.target.value)}
                              placeholder="e.g. Compliance Officer"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none text-xs"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Signature (Replace or Keep)</label>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => setEditSigMode('upload')}
                                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                  editSigMode === 'upload' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500'
                                }`}
                              >
                                Upload File
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditSigMode('draw')}
                                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                  editSigMode === 'draw' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-500'
                                }`}
                              >
                                Draw Live
                              </button>
                            </div>
                          </div>

                          {editSigMode === 'upload' ? (
                            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                              <div className="w-36 h-20 bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                                {editSigImage ? (
                                  <img src={editSigImage} alt="Preview" className="max-h-full max-w-full object-contain" />
                                ) : (
                                  <Upload className="w-5 h-5 text-slate-300" />
                                )}
                              </div>
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChangeForEditSig(e.target.files?.[0] || null)}
                                  className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Upload to replace existing signature image, or keep as-is.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="border-2 border-dashed border-slate-200 rounded-xl p-1 bg-slate-50">
                                <SignatureCanvas
                                  ref={editSigCanvasRef}
                                  penColor="#0f172a"
                                  canvasProps={{
                                    className: 'w-full h-28 bg-white rounded-lg border border-slate-100 cursor-crosshair'
                                  }}
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-400">Leave blank to keep existing signature image</span>
                                <button
                                  type="button"
                                  onClick={() => editSigCanvasRef.current?.clear()}
                                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 cursor-pointer"
                                >
                                  Clear Canvas
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="checkbox"
                            id="editSigDefault"
                            checked={editSigIsDefault}
                            onChange={(e) => setEditSigIsDefault(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label htmlFor="editSigDefault" className="text-xs text-slate-700 cursor-pointer font-medium">
                            Set as Default Authority Signature
                          </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingSig(null)}
                            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEditSig}
                            onClick={handleSaveEditAuthoritySignature}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSavingEditSig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Signatures List Grid */}
                  {authoritySigs.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {authoritySigs.map((sig, index) => {
                        const isDefault = sig.isDefault || (!authoritySigs.some(s => s.isDefault) && sig.signature === staffConfig.officialSignature);
                        const isFirst = index === 0;
                        const isLast = index === authoritySigs.length - 1;
                        return (
                          <div
                            key={sig.id}
                            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-xs ${
                              isDefault ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/20' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black shrink-0" title={`Position #${index + 1}`}>
                                  #{index + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate" title={sig.name}>
                                    {sig.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {sig.title || 'Authorized Officer'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {authoritySigs.length > 1 && (
                                  <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 border border-slate-200/60">
                                    <button
                                      type="button"
                                      disabled={isFirst}
                                      onClick={() => handleMoveAuthoritySignature(sig.id, 'up')}
                                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                                      title={isFirst ? "First item" : "Move up / earlier"}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLast}
                                      onClick={() => handleMoveAuthoritySignature(sig.id, 'down')}
                                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                                      title={isLast ? "Last item" : "Move down / later"}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAuthoritySignature(sig)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer ml-0.5"
                                  title="Edit this signature"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAuthoritySignature(sig.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-0.5"
                                  title="Delete this signature"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center p-2 overflow-hidden">
                              <img src={sig.signature} alt={sig.name} className="max-h-full max-w-full object-contain" />
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              {isDefault ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> Default Stamp
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAuthoritySignature(sig)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                >
                                  Set as Default
                                </button>
                              )}
                              <span className="text-[9px] text-slate-400 font-mono">
                                ID: {sig.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Legacy fallback when no authority signatures exist yet */
                    <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-6 rounded-2xl border border-dashed border-slate-200">
                      <div className="w-32 h-20 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                        {staffConfig.officialSignature ? (
                          <img src={staffConfig.officialSignature} className="max-h-full max-w-full object-contain p-2" alt="Stamp" />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-2">
                        <div className="text-xs font-bold text-slate-800">No multi-officer signatures registered yet</div>
                        <p className="text-[11px] text-slate-500">
                          Add your compliance officer authority signatures to easily pick between officers in Data Validation and official approvals.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAddSigModal(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add First Authority Signature
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* General System Access QR Code (Permanent / No Expiration Timer) */}
                <GeneralAccessQrCard />

                {/* Security & Access Controls Checklist (Bot Blocking, HTTP Headers, MFA, IP Whitelisting & Rate Limiting) */}
                <SecuritySettingsCard />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Server className="w-3 h-3 mr-2" /> Cloud Connection
                    </h4>
                    <button onClick={checkHealth} className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline">
                      Test Connection
                    </button>
                  </div>
                  <div className="bg-slate-900 rounded-[32px] p-6 text-white space-y-4 shadow-xl">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest block">Supabase Status</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${systemHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <span className="text-xs font-bold">{systemHealth?.status === 'ok' ? 'Operational' : 'Disconnected'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest block">Data Sync</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${systemHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <span className="text-xs font-bold">Real-time</span>
                        </div>
                      </div>
                    </div>

                    {systemHealth.tables && (
                      <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className={`text-[8px] font-black uppercase mb-1 ${systemHealth.tables.agreements ? 'text-emerald-500' : 'text-rose-500'}`}>Agreements</div>
                          <div className={`w-1.5 h-1.5 rounded-full mx-auto ${systemHealth.tables.agreements ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        </div>
                        <div className="text-center">
                          <div className={`text-[8px] font-black uppercase mb-1 ${systemHealth.tables.debtors ? 'text-emerald-500' : 'text-rose-500'}`}>Debtors</div>
                          <div className={`w-1.5 h-1.5 rounded-full mx-auto ${systemHealth.tables.debtors ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        </div>
                        <div className="text-center">
                          <div className={`text-[8px] font-black uppercase mb-1 ${systemHealth.tables.staff ? 'text-emerald-500' : 'text-rose-500'}`}>Staff</div>
                          <div className={`w-1.5 h-1.5 rounded-full mx-auto ${systemHealth.tables.staff ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
