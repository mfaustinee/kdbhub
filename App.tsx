
import DataValidationModule from './components/DataValidationModule';
import { ScopeDisclosureModule } from './components/ScopeDisclosureModule';
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AgreementForm } from './components/AgreementForm.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SuccessScreen } from './components/SuccessScreen.tsx';
import { PortalHub } from './components/PortalHub.tsx';
import { ClosureForm } from './components/ClosureForm.tsx';
import { ComplaintForm } from './components/ComplaintForm.tsx';
import { InquiryForm } from './components/InquiryForm.tsx';
import { DboSigningPortal } from './components/DboSigningPortal.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { useAuth } from './src/contexts/AuthContext.tsx';
import { AgreementData, DebtorRecord, ArrearItem, StaffConfig, ClosureNotificationData, LicensedClient, ComplaintData, InquiryData } from './types.ts';
import { ShieldCheck, User, ClipboardList, Cloud, CloudOff, Loader2, LogOut, Lock, ClipboardCheck, ArrowUp } from 'lucide-react';
import { DBService } from './services/db.ts';
import { numberToWords } from './utils/numberToWords.ts';
import { ScrollToTopButton } from './components/ScrollToTopButton.tsx';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [agreements, setAgreements] = useState<AgreementData[]>([]);
  const [closures, setClosures] = useState<ClosureNotificationData[]>([]);
  const [complaints, setComplaints] = useState<ComplaintData[]>([]);
  const [inquiries, setInquiries] = useState<InquiryData[]>([]);
  const [debtors, setDebtors] = useState<DebtorRecord[]>([]);
  const [clients, setClients] = useState<LicensedClient[]>([]);
  const unreadCount = useMemo(() => {
    const unreadAgreements = agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length;
    const unreadClosures = closures.filter(c => c.status === 'submitted').length;
    const unreadComplaints = complaints.filter(co => co.status === 'submitted').length;
    const unreadInquiries = inquiries.filter(inq => inq.status === 'submitted').length;
    return unreadAgreements + unreadClosures + unreadComplaints + unreadInquiries;
  }, [agreements, closures, complaints, inquiries]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [staffConfig, setStaffConfig] = useState<StaffConfig>({
    officialSignature: '',
    enabledModules: {
      levyAgreement: true,
      businessClosure: true,
      clientInquiry: true,
      stakeholderComplaint: true,
    }
  });
  const [currentAgreement, setCurrentAgreement] = useState<AgreementData | null>(null);
  const { user, isAuthenticated: isAdminAuthenticated, signOut } = useAuth();

  useEffect(() => {
    loadDatabase();
  }, []);

  // Cross-device synchronization engine: Supabase Realtime channel + focus/visibility revalidation + heartbeat
  useEffect(() => {
    let channel: any = null;
    let isSubscribed = true;

    const setupRealtimeSync = async () => {
      try {
        const client = await DBService.getSupabaseClient();
        if (!client || !isSubscribed) return;

        channel = client.channel('kdb-cross-device-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'agreements' }, () => {
            loadDatabase(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'closures' }, () => {
            loadDatabase(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
            loadDatabase(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => {
            loadDatabase(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_config' }, () => {
            loadDatabase(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kdb_validations' }, () => {
            loadDatabase(true);
          })
          .subscribe();
      } catch (err) {
        console.warn("[App] Supabase realtime sync notice:", err);
      }
    };

    setupRealtimeSync();

    // Auto-sync when window regains focus or tab becomes visible (cross-device wake)
    let lastFocusSync = 0;
    const handleSyncTrigger = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && (now - lastFocusSync > 5000)) {
        lastFocusSync = now;
        loadDatabase(true);
      }
    };

    window.addEventListener('visibilitychange', handleSyncTrigger);
    window.addEventListener('focus', handleSyncTrigger);

    // Periodic heartbeat to guarantee freshness across devices even without websocket
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDatabase(true);
      }
    }, 20000);

    return () => {
      isSubscribed = false;
      if (channel) {
        channel.unsubscribe();
      }
      window.removeEventListener('visibilitychange', handleSyncTrigger);
      window.removeEventListener('focus', handleSyncTrigger);
      clearInterval(heartbeatInterval);
    };
  }, [isAdminAuthenticated, location.pathname]);

  // Lazy-load client & debtor data only when needed
  useEffect(() => {
    const needsAdminData = isAdminAuthenticated || location.pathname === '/admin' || location.pathname === '/payment-agreement';
    if (needsAdminData && (debtors.length === 0 || clients.length === 0)) {
      loadAdminData();
    }
  }, [location.pathname, isAdminAuthenticated]);

  const handleAdminAccess = () => {
    navigate('/admin');
  };

  const handleAdminLogout = async () => {
    await signOut();
    navigate('/');
  };

  const loadAdminData = async (forceFresh = false) => {
    try {
      const [storedDebtors, storedReturns, storedClients] = await Promise.all([
        DBService.getDebtors(forceFresh),
        DBService.getReturns(forceFresh),
        DBService.getClients(forceFresh)
      ]);

      setClients(storedClients || []);

      let baseDebtors = storedDebtors;
      if (baseDebtors.length === 0) {
        baseDebtors = [
          {
            id: 'D001',
            dboName: 'Sunrise Dairy Ltd',
            premiseName: 'Sunrise Main Depot',
            permitNo: 'KDB/MB/0001234/2025',
            location: 'Thika Road, Ruiru',
            county: 'Kiambu',
            arrearsBreakdown: [{ id: '1', month: 'January 2024', amount: 150000 }],
            totalArrears: 150000,
            totalArrearsWords: 'One Hundred and Fifty Thousand Shillings Only',
            arrearsPeriod: 'Jan 2024',
            debitNoteNo: 'DN/2024/552',
            tel: '0712345678',
            installments: [{ no: 1, period: 'Jan 2024', dueDate: '', amount: 150000 }]
          }
        ];
        await DBService.saveDebtors(baseDebtors);
      }

      // Group returns with outstandingBalance > 0 by client
      const outstandingByClient: Record<string, any[]> = {};
      (storedReturns || []).forEach(ret => {
        if (ret.outstandingBalance > 0) {
          if (!outstandingByClient[ret.clientId]) {
            outstandingByClient[ret.clientId] = [];
          }
          outstandingByClient[ret.clientId].push(ret);
        }
      });

      const integrated: DebtorRecord[] = JSON.parse(JSON.stringify(baseDebtors));

      Object.entries(outstandingByClient).forEach(([clientId, rets]) => {
        const client = (storedClients || []).find(c => c.id === clientId);
        const clientName = client ? client.clientName : rets[0].clientName;
        const premiseName = client ? client.premiseName : 'Unknown Premise';
        const location = client ? client.location : 'Unknown Location';
        const county = client ? client.county : 'Unknown County';
        const tel = client ? client.tel : 'No Phone';

        const arrearsBreakdown: ArrearItem[] = rets.map((r, i) => ({
          id: `ret-arr-${r.id || i}`,
          month: `${r.period} ${r.year}`,
          amount: r.outstandingBalance
        }));

        const totalArrears = rets.reduce((sum, r) => sum + r.outstandingBalance, 0);
        const totalArrearsWords = numberToWords(totalArrears);
        const arrearsPeriod = rets.map(r => `${(r.period || '').substring(0,3)} ${r.year}`).join(', ');

        // Check if existing
        const existingIndex = integrated.findIndex(d => 
          (d.dboName || '').toLowerCase() === (clientName || '').toLowerCase() ||
          d.id === clientId ||
          (d.permitNo || '') === clientId ||
          (d.permitNo || '') === `KDB/LC/${clientId}`
        );

        if (existingIndex !== -1) {
          const existing = integrated[existingIndex];
          const combinedBreakdown = [...existing.arrearsBreakdown];
          arrearsBreakdown.forEach(arr => {
            const duplicate = combinedBreakdown.find(eb => eb.month === arr.month);
            if (duplicate) {
              duplicate.amount = arr.amount;
            } else {
              combinedBreakdown.push(arr);
            }
          });

          const newTotal = combinedBreakdown.reduce((sum, item) => sum + item.amount, 0);

          let finalInstallments = existing.installments || [];
          if (finalInstallments.length <= 1 || existing.debitNoteNo?.startsWith('DN/RET/')) {
            finalInstallments = combinedBreakdown.map((item, idx) => ({
              no: idx + 1,
              period: item.month,
              dueDate: new Date().toISOString().slice(0, 10),
              amount: item.amount
            }));
          }

          integrated[existingIndex] = {
            ...existing,
            arrearsBreakdown: combinedBreakdown,
            totalArrears: newTotal,
            totalArrearsWords: numberToWords(newTotal),
            arrearsPeriod: combinedBreakdown.map(b => b.month).join(', '),
            installments: finalInstallments,
          };
        } else {
          integrated.push({
            id: clientId,
            dboName: clientName,
            premiseName: premiseName,
            permitNo: `KDB/LC/${clientId}`,
            location: location,
            county: county,
            arrearsBreakdown,
            totalArrears,
            totalArrearsWords,
            arrearsPeriod,
            debitNoteNo: `DN/RET/${clientId}`,
            tel: tel,
            installments: arrearsBreakdown.map((item, idx) => ({
              no: idx + 1,
              period: item.month,
              dueDate: new Date().toISOString().slice(0, 10),
              amount: item.amount
            }))
          });
        }
      });

      const uniqueDebtors = Array.from(new Map(integrated.map(d => [d.id, d])).values());
      setDebtors(uniqueDebtors);
    } catch (err) {
      console.error("[App] Failed to load admin debtor data:", err);
    }
  };

  const loadDatabase = async (forceFresh = false) => {
    if (forceFresh) {
      DBService.clearMemoryCache();
    }
    setIsSyncing(true);
    try {
      const [storedAgreements, storedStaff, storedClosures, storedComplaints, storedInquiries] = await Promise.all([
        DBService.getAgreements(forceFresh),
        DBService.getStaffConfig(),
        DBService.getClosures(forceFresh),
        DBService.getComplaints(forceFresh),
        DBService.getInquiries(forceFresh)
      ]);

      const uniqueAgreements = Array.from(new Map(storedAgreements.map(a => [a.id, a])).values());
      setAgreements(uniqueAgreements);

      const uniqueClosures = Array.from(new Map(storedClosures.map(c => [c.id, c])).values());
      setClosures(uniqueClosures);

      const uniqueComplaints = Array.from(new Map(storedComplaints.map(co => [co.id, co])).values());
      setComplaints(uniqueComplaints);

      const uniqueInquiries = Array.from(new Map(storedInquiries.map(inq => [inq.id, inq])).values());
      setInquiries(uniqueInquiries);
      
      // Check for direct link ID
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      if (id) {
        const found = uniqueAgreements.find(a => a.id === id);
        if (found) {
          setCurrentAgreement(found);
          navigate('/success');
        }
      }
      
      setStaffConfig(storedStaff);

      const needsAdminData = isAdminAuthenticated || location.pathname === '/admin' || location.pathname === '/payment-agreement';
      if (needsAdminData) {
        await loadAdminData(forceFresh);
      }
    } catch (error) {
      console.error("[App] Failed to load database:", error);
    } finally {
      setTimeout(() => setIsSyncing(false), 300);
    }
  };

  const handleClientSubmit = async (data: AgreementData) => {
    setIsSyncing(true);
    try {
      const submission = { ...data, submittedAt: new Date().toISOString() };
      await DBService.saveAgreement(submission);
      
      setAgreements(prev => {
        const filtered = prev.filter(a => a.id !== submission.id);
        return [submission, ...filtered];
      });
      
      setCurrentAgreement(submission);
      navigate('/success');
    } catch (error: any) {
      console.error("Submission failed:", error);
      alert(`Submission failed: ${error.message || 'Please try again.'}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClosureSubmit = async (data: ClosureNotificationData) => {
    setIsSyncing(true);
    try {
      const submission = { ...data, submittedAt: data.submittedAt || new Date().toISOString() };
      await DBService.saveClosure(submission);
      
      setClosures(prev => {
        const filtered = prev.filter(c => c.id !== submission.id);
        return [submission, ...filtered];
      });
    } catch (error: any) {
      console.error("Closure submission failed:", error);
      alert(`Cessation notification submission failed: ${error.message || 'Please try again.'}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleComplaintSubmit = async (data: ComplaintData) => {
    setIsSyncing(true);
    try {
      const submission = { ...data, submittedAt: data.submittedAt || new Date().toISOString() };
      await DBService.saveComplaint(submission);
      
      setComplaints(prev => {
        const filtered = prev.filter(co => co.id !== submission.id);
        return [submission, ...filtered];
      });
    } catch (error: any) {
      console.error("Complaint submission failed:", error);
      alert(`Complaint submission failed: ${error.message || 'Please try again.'}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInquirySubmit = async (data: InquiryData) => {
    setIsSyncing(true);
    try {
      const submission = { ...data, submittedAt: data.submittedAt || new Date().toISOString() };
      await DBService.saveInquiry(submission);
      
      setInquiries(prev => {
        const filtered = prev.filter(inq => inq.id !== submission.id);
        return [submission, ...filtered];
      });
    } catch (error: any) {
      console.error("Inquiry submission failed:", error);
      alert(`Inquiry submission failed: ${error.message || 'Please try again.'}`);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdminAction = async (id: string, action: 'approve' | 'reject', adminData?: { signature: string; name: string; reason?: string }) => {
    setIsSyncing(true);
    try {
      const updates: Partial<AgreementData> = action === 'approve' 
        ? { status: 'approved', officialSignature: adminData?.signature, officialName: adminData?.name, approvedAt: new Date().toISOString() }
        : { status: 'rejected', rejectionReason: adminData?.reason };

      await DBService.updateAgreement(id, updates);
      setAgreements(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    } catch (err) {
      console.error("Admin action failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClosureAction = async (id: string, action: 'approve' | 'reject', adminData?: { signature: string; name: string; reason?: string; title?: string; comments?: string }) => {
    setIsSyncing(true);
    try {
      const updates: Partial<ClosureNotificationData> = action === 'approve'
        ? { 
            status: 'approved', 
            officialSignature: adminData?.signature, 
            officialName: adminData?.name, 
            officialTitle: adminData?.title,
            officialComments: adminData?.comments,
            approvedAt: new Date().toISOString() 
          }
        : { status: 'rejected', rejectionReason: adminData?.reason };

      await DBService.updateClosure(id, updates);
      setClosures(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      
      // Automatically update relevant client's dates of cessation in the clients list
      const closure = closures.find(c => c.id === id);
      if (action === 'approve' && closure) {
        try {
          const clientList = clients.length > 0 ? clients : await DBService.getClients();
          let clientId = '';
          if (closure.permitNo && closure.permitNo.includes('KDB/LC/')) {
            clientId = closure.permitNo.split('KDB/LC/')[1];
          }
          
          const client = clientList.find(c => c.id === clientId) || 
                         clientList.find(c => String(c.clientName || '').toLowerCase() === String(closure.dboName || '').toLowerCase()) ||
                         clientList.find(c => c.tel === closure.tel);
                         
          if (client) {
            const dateObj = new Date(closure.closureDate);
            const year = isNaN(dateObj.getTime()) ? null : dateObj.getFullYear();
            const monthsList = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const month = isNaN(dateObj.getTime()) ? null : monthsList[dateObj.getMonth()];

            const updatedClient = {
              ...client,
              operationalStatus: 'closed' as const,
              levyInfo: 'DNQ-R' as const,
              endYear: year,
              endMonth: month
            };
            await DBService.saveClient(updatedClient);
            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
            console.log(`[App] Automatically updated client ${client.clientName} status to closed with endYear=${year}, endMonth=${month}`);
          }
        } catch (err) {
          console.error("[App] Failed to auto-update client cessation status:", err);
        }
      }
    } catch (err) {
      console.error("Closure action failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAgreement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this submission? This action cannot be undone.")) return;
    
    setIsSyncing(true);
    try {
      await DBService.deleteAgreement(id);
      setAgreements(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteClosure = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this cessation notice? This action cannot be undone.")) return;
    
    setIsSyncing(true);
    try {
      await DBService.deleteClosure(id);
      setClosures(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Cessation deletion failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleComplaintAction = async (id: string, updates: Partial<ComplaintData>) => {
    setIsSyncing(true);
    try {
      await DBService.updateComplaint(id, updates);
      setComplaints(prev => prev.map(co => co.id === id ? { ...co, ...updates } : co));
    } catch (error) {
      console.error("Complaint action failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this complaint? This action cannot be undone.")) return;
    
    setIsSyncing(true);
    try {
      await DBService.deleteComplaint(id);
      setComplaints(prev => prev.filter(co => co.id !== id));
    } catch (error) {
      console.error("Complaint deletion failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInquiryAction = async (id: string, updates: Partial<InquiryData>) => {
    setIsSyncing(true);
    try {
      await DBService.updateInquiry(id, updates);
      setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, ...updates } : inq));
    } catch (error) {
      console.error("Inquiry action failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this inquiry? This action cannot be undone.")) return;
    
    setIsSyncing(true);
    try {
      await DBService.deleteInquiry(id);
      setInquiries(prev => prev.filter(inq => inq.id !== id));
    } catch (error) {
      console.error("Inquiry deletion failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDebtorUpdate = async (updated: DebtorRecord[]) => {
    setDebtors(updated);
    await DBService.saveDebtors(updated);
  };

  const handleStaffUpdate = async (config: StaffConfig) => {
    setStaffConfig(config);
    await DBService.saveStaffConfig(config);
  };

  const isSigningPortal = location.pathname.startsWith('/sign-validation');
  const isStandaloneRoute = isSigningPortal || location.pathname === '/data-validation';

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#f5f5f4] text-[#1a1a1a]">
      {!isSigningPortal && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="flex justify-between h-14 items-center">
              <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate('/')}>
                <div className="bg-emerald-600 p-1.5 rounded-lg flex items-center shadow-sm">
                  <ShieldCheck className="text-white w-4 h-4" />
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800">KDB Hub</span>
                    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border ${isSyncing ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      {isSyncing ? (
                        <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                      ) : (
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      )}
                      <span className={`text-[9px] font-bold uppercase tracking-tight ${isSyncing ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isSyncing ? 'Syncing...' : 'Connected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <nav className="flex items-center space-x-1">
                {isAdminAuthenticated && (
                  <>
                    <button 
                      onClick={() => navigate('/')}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${['/', '/portal'].includes(location.pathname) ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <User className="w-3.5 h-3.5 mr-1.5" />
                      Public Portals
                    </button>

                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="max-w-[140px] truncate" title={user?.email || 'Admin'}>
                        {user?.user_metadata?.full_name || user?.email || 'Officer'}
                      </span>
                    </div>

                    <button 
                      onClick={handleAdminAccess}
                      className={`relative flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${location.pathname === '/admin' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                      Admin
                      {unreadCount > 0 && location.pathname !== '/admin' && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] flex items-center justify-center rounded-full border border-white animate-bounce font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={handleAdminLogout}
                      className="flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Sign out of administrative session"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1.5" />
                      Logout
                    </button>
                  </>
                )}
              </nav>
            </div>
          </div>
        </header>
      )}

      <main className="w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-0 sm:py-6 flex-grow">
        <Routes>
          <Route path="/sign-validation/:draftId" element={<DboSigningPortal />} />
          <Route path="/sign-validation" element={<DboSigningPortal />} />
          <Route path="/" element={
            <PortalHub 
              onSelectPaymentPortal={() => navigate('/payment-agreement')} 
              onSelectClosurePortal={() => navigate('/closure-notice')}
              onSelectComplaintPortal={() => navigate('/complaints')}
              onSelectInquiryPortal={() => navigate('/inquiries')}
              unreadAgreementsCount={agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length}
              unreadClosuresCount={closures.filter(c => c.status === 'submitted').length}
              enabledModules={staffConfig.enabledModules}
            />
          } />
          <Route path="/data-validation" element={
            isAdminAuthenticated ? <DataValidationModule /> : <AdminLogin returnTo="/data-validation" />
          } />
          <Route path="/scope-disclosure" element={<ScopeDisclosureModule isStandalone={true} isAdmin={false} />} />
          <Route path="/sign-scope-disclosure" element={<ScopeDisclosureModule isStandalone={true} isAdmin={false} />} />
          <Route path="/portal" element={
            <PortalHub 
              onSelectPaymentPortal={() => navigate('/payment-agreement')} 
              onSelectClosurePortal={() => navigate('/closure-notice')}
              onSelectComplaintPortal={() => navigate('/complaints')}
              onSelectInquiryPortal={() => navigate('/inquiries')}
              unreadAgreementsCount={agreements.filter(a => a.status === 'submitted' || a.status === 'resubmission_requested').length}
              unreadClosuresCount={closures.filter(c => c.status === 'submitted').length}
              enabledModules={staffConfig.enabledModules}
            />
          } />
          <Route path="/payment-agreement" element={
            staffConfig.enabledModules?.levyAgreement !== false ? (
              <AgreementForm agreements={agreements} debtors={debtors} clients={clients} onSubmit={handleClientSubmit} />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-100">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800">Levy Payment Portal Offline</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    This portal module is currently offline or under administrative review. Please check back later or contact Kenya Dairy Board support.
                  </p>
                </div>
                <button onClick={() => navigate('/')} className="w-full py-3.5 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                  Return to Portal Hub
                </button>
              </div>
            )
          } />
          <Route path="/closure-notice" element={
            staffConfig.enabledModules?.businessClosure !== false ? (
              <ClosureForm onSubmit={handleClosureSubmit} onBack={() => navigate('/')} />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-100">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800">Business Closure Portal Offline</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    This portal module is currently offline or under administrative review. Please check back later or contact Kenya Dairy Board support.
                  </p>
                </div>
                <button onClick={() => navigate('/')} className="w-full py-3.5 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                  Return to Portal Hub
                </button>
              </div>
            )
          } />
          <Route path="/complaints" element={
            staffConfig.enabledModules?.stakeholderComplaint !== false ? (
              <ComplaintForm onSubmit={handleComplaintSubmit} onBack={() => navigate('/')} />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-100">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800">Complaints Portal Offline</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    This portal module is currently offline or under administrative review. Please check back later or contact Kenya Dairy Board support.
                  </p>
                </div>
                <button onClick={() => navigate('/')} className="w-full py-3.5 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                  Return to Portal Hub
                </button>
              </div>
            )
          } />
          <Route path="/inquiries" element={
            staffConfig.enabledModules?.clientInquiry !== false ? (
              <InquiryForm onSubmit={handleInquirySubmit} onBack={() => navigate('/')} />
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-6">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-100">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-800">Inquiries Portal Offline</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    This portal module is currently offline or under administrative review. Please check back later or contact Kenya Dairy Board support.
                  </p>
                </div>
                <button onClick={() => navigate('/')} className="w-full py-3.5 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest">
                  Return to Portal Hub
                </button>
              </div>
            )
          } />
          <Route path="/admin" element={
            isAdminAuthenticated ? (
              <AdminDashboard 
                agreements={agreements} 
                closures={closures}
                complaints={complaints}
                inquiries={inquiries}
                debtors={debtors}
                staffConfig={staffConfig}
                isSyncing={isSyncing}
                onRefresh={() => loadDatabase(true)}
                onAction={handleAdminAction} 
                onDeleteAgreement={handleDeleteAgreement}
                onClosureAction={handleClosureAction}
                onDeleteClosure={handleDeleteClosure}
                onComplaintAction={handleComplaintAction}
                onDeleteComplaint={handleDeleteComplaint}
                onInquiryAction={handleInquiryAction}
                onDeleteInquiry={handleDeleteInquiry}
                onDebtorUpdate={handleDebtorUpdate}
                onStaffUpdate={handleStaffUpdate}
              />
            ) : (
              <AdminLogin returnTo="/admin" />
            )
          } />
          <Route path="/success" element={
            currentAgreement ? (
              <SuccessScreen 
                agreement={currentAgreement} 
                onReturn={() => navigate(currentAgreement.adminBypassed ? '/admin' : '/')} 
              />
            ) : (
              <Navigate to="/" replace />
            )
          } />
        </Routes>
      </main>

      <ScrollToTopButton />
    </div>
  );
};

export default App;
