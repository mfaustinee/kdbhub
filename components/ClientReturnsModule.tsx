import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DBService } from '../services/db';
import { LicensedClient, ClientReturn, DebtorRecord, Installment, ArrearItem, formatDateToDDMMYYYY } from '../types';
import { numberToWords } from '../utils/numberToWords';
import { areNamesMatching, searchMatches, normalizeAlphanumeric, cleanPermitNumber } from './lib/nameMatching';
import { autoProvisionClientStub } from '../services/clientReturnsPipeline';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Database, 
  Upload, 
  Download, 
  Search, 
  X, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Briefcase, 
  MapPin, 
  Phone, 
  Loader2, 
  Printer, 
  ChevronRight, 
  ChevronLeft,
  Edit2,
  FileSpreadsheet, 
  HelpCircle,
  Clock,
  ArrowUpRight,
  Filter,
  DollarSign,
  ExternalLink,
  UserPlus,
  PenTool
} from 'lucide-react';

export interface ClientReturnsModuleProps {
  debtors?: DebtorRecord[];
  onDebtorUpdate?: (updated: DebtorRecord[]) => void;
  onRefresh?: () => void;
  clients?: LicensedClient[];
  returns?: ClientReturn[];
  loading?: boolean;
  onReturnsChange?: (returns: ClientReturn[]) => void;
  onClientsChange?: (clients: LicensedClient[]) => void;
  defaultSubTab?: 'registry' | 'debtors' | 'statements';
  standalone?: boolean;
  hideNavigationHeader?: boolean;
  debtorsOnly?: boolean;
}

export const ClientReturnsModule: React.FC<ClientReturnsModuleProps> = ({
  debtors: propDebtors,
  onDebtorUpdate,
  onRefresh,
  clients: propClients,
  returns: propReturns,
  loading: propLoading,
  onReturnsChange,
  onClientsChange,
  defaultSubTab = 'registry',
  standalone = true,
  hideNavigationHeader = false,
  debtorsOnly = false
}) => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<LicensedClient[]>(propClients || []);
  const [returns, setReturns] = useState<ClientReturn[]>(propReturns || []);
  const [localDebtors, setLocalDebtors] = useState<DebtorRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(propLoading !== undefined ? propLoading : (standalone || !propClients || !propReturns));
  const [activeSubTab, setActiveSubTab] = useState<'registry' | 'debtors' | 'statements'>(debtorsOnly ? 'debtors' : defaultSubTab);

  // Sync state when props update
  useEffect(() => {
    if (propClients !== undefined) {
      setClients(propClients);
      if (propClients.length > 0 && !selectedStatementClientId) {
        setSelectedStatementClientId(propClients[0].id);
      }
    }
  }, [propClients]);

  useEffect(() => {
    if (propReturns !== undefined) {
      setReturns(propReturns);
    }
  }, [propReturns]);

  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    }
  }, [propLoading]);

  useEffect(() => {
    if (debtorsOnly) {
      setActiveSubTab('debtors');
    } else if (defaultSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab, debtorsOnly]);

  // Search & Filter state for returns registry
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // New/Edit Return modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingReturn, setEditingReturn] = useState<ClientReturn | null>(null);

  // Form Fields
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [returnYear, setReturnYear] = useState<number>(new Date().getFullYear());
  const [returnPeriod, setReturnPeriod] = useState<string>('January');
  const [qty, setQty] = useState<number>(0);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [txnRef, setTxnRef] = useState<string>('');
  const [lessCF, setLessCF] = useState<number>(0);
  const [comments, setComments] = useState<string>('');
  const [overrideStatus, setOverrideStatus] = useState<'Fully Paid' | 'Partially Paid' | 'Unpaid' | 'Auto'>('Auto');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // CSV Bulk Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedReturns, setParsedReturns] = useState<ClientReturn[]>([]);
  const [newlyProvisionedClients, setNewlyProvisionedClients] = useState<LicensedClient[]>([]);
  const [autoProvisionClients, setAutoProvisionClients] = useState<boolean>(true);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState<boolean>(false);

  // Debtor Determination state
  const [debtorFilterYear, setDebtorFilterYear] = useState<string>('All');
  const [debtorFilterMonth, setDebtorFilterMonth] = useState<string>('All');
  const [debtorSearchQuery, setDebtorSearchQuery] = useState<string>('');

  // Pagination states for Debtors Ledger
  const [debtorsBatchSize, setDebtorsBatchSize] = useState<10 | 25 | 50 | 100>(25);
  const [debtorsCurrentPage, setDebtorsCurrentPage] = useState<number>(1);

  useEffect(() => {
    setDebtorsCurrentPage(1);
  }, [debtorSearchQuery, debtorFilterYear, debtorFilterMonth]);

  // Debtors CSV Import state
  const [isDebtorImportModalOpen, setIsDebtorImportModalOpen] = useState<boolean>(false);
  const [debtorCsvFile, setDebtorCsvFile] = useState<File | null>(null);
  const [parsedDebtors, setParsedDebtors] = useState<DebtorRecord[]>([]);
  const [debtorImportErrors, setDebtorImportErrors] = useState<string[]>([]);
  const [debtorImportWarnings, setDebtorImportWarnings] = useState<string[]>([]);
  const [isImportingDebtors, setIsImportingDebtors] = useState<boolean>(false);
  const [debtorImportMode, setDebtorImportMode] = useState<'append' | 'replace'>('append');

  // Track deleted debtor keys (by id, permitNo, or dboName) so deletions apply to both manual and derived debtors
  const [deletedDebtorKeys, setDeletedDebtorKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kdb_deleted_debtor_keys');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Multi-select batch state for debtors ledger
  const [selectedDebtorIds, setSelectedDebtorIds] = useState<string[]>([]);

  // Statement client selection state
  const [selectedStatementClientId, setSelectedStatementClientId] = useState<string>('');
  const [statementFilterYear, setStatementFilterYear] = useState<string>('All');
  const [statementSearchQuery, setStatementSearchQuery] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  // Ensure we cover up to currentYear + 2 so future years are always active and ready as soon as we cross over, down to 2022
  const yearsList = Array.from(
    { length: Math.max(5, (currentYear + 2) - 2022 + 1) },
    (_, i) => (currentYear + 2) - i
  );

  const getIntegratedDebtors = (): DebtorRecord[] => {
    const baseDebtors = propDebtors || localDebtors;
    const outstandingByClient: Record<string, ClientReturn[]> = {};
    
    returns.forEach(ret => {
      if (ret.outstandingBalance > 0) {
        if (!outstandingByClient[ret.clientId]) {
          outstandingByClient[ret.clientId] = [];
        }
        outstandingByClient[ret.clientId].push(ret);
      }
    });

    const integrated: DebtorRecord[] = JSON.parse(JSON.stringify(baseDebtors));

    Object.entries(outstandingByClient).forEach(([clientId, rets]) => {
      const client = clients.find(c => c.id === clientId);
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
        areNamesMatching(d.dboName, clientName) ||
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

    const unique = Array.from(new Map(integrated.map(d => [d.id, d])).values());
    return unique.filter(d => 
      !deletedDebtorKeys.includes(d.id) && 
      !deletedDebtorKeys.includes(d.permitNo) && 
      !deletedDebtorKeys.includes(d.dboName)
    );
  };

  // Batching & Pagination states for Returns filings list (10, 25, 50 & 100 batch options)
  const [batchSize, setBatchSize] = useState<10 | 25 | 50 | 100>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalReturnsCount, setTotalReturnsCount] = useState<number>(0);
  const [totalReturnsPages, setTotalReturnsPages] = useState<number>(1);
  const [registryView, setRegistryView] = useState<'returns-list' | 'client-summaries'>('returns-list');
  const [returnsSummary, setReturnsSummary] = useState<{
    totalQty: number;
    totalInvoicedAmt: number;
    totalPaidAmt: number;
    totalLessCFAmt: number;
    totalOutstanding: number;
  }>({ totalQty: 0, totalInvoicedAmt: 0, totalPaidAmt: 0, totalLessCFAmt: 0, totalOutstanding: 0 });

  const fetchReturnsBatch = useCallback(async (page: number = currentPage, size: 10 | 25 | 50 | 100 = batchSize) => {
    setLoading(true);
    try {
      const [res, fetchedClients, fetchedDebtors] = await Promise.all([
        DBService.getReturnsPaginated({
          page,
          pageSize: size,
          search: searchQuery,
          year: filterYear,
          month: filterMonth,
          status: filterStatus
        }),
        clients.length === 0 ? DBService.getClients(false) : Promise.resolve(clients),
        localDebtors.length === 0 ? DBService.getDebtors(false) : Promise.resolve(localDebtors)
      ]);

      setReturns(res.data);
      const total = res.count ?? res.totalCount ?? res.data.length;
      setTotalReturnsCount(total);
      setTotalReturnsPages(res.totalPages || Math.ceil(total / size) || 1);
      setCurrentPage(page);
      if (res.summary) {
        setReturnsSummary(res.summary);
      }
      onReturnsChange?.(res.data);

      if (fetchedClients && fetchedClients.length > 0 && clients.length === 0) {
        setClients(fetchedClients);
        onClientsChange?.(fetchedClients);
        if (!selectedStatementClientId) {
          setSelectedStatementClientId(fetchedClients[0].id);
        }
      }
      if (fetchedDebtors && fetchedDebtors.length > 0 && localDebtors.length === 0) {
        setLocalDebtors(fetchedDebtors);
      }
      onRefresh?.();
    } catch (error) {
      console.error("Error fetching returns batch:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, batchSize, searchQuery, filterYear, filterMonth, filterStatus, clients, localDebtors, onReturnsChange, onClientsChange, onRefresh, selectedStatementClientId]);

  // Fetch only the selected batch on filter/batch changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReturnsBatch(1, batchSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, filterYear, filterMonth, filterStatus, batchSize]);

  const handleBatchSizeChange = (newSize: 10 | 25 | 50 | 100) => {
    setBatchSize(newSize);
    setCurrentPage(1);
    fetchReturnsBatch(1, newSize);
  };

  const handlePageChange = (newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalReturnsPages));
    setCurrentPage(validPage);
    fetchReturnsBatch(validPage, batchSize);
  };

  const fetchData = async () => {
    await fetchReturnsBatch(currentPage, batchSize);
  };

  // Pre-fill return values based on select client in the form
  useEffect(() => {
    if (selectedClientId && !editingReturn) {
      // Find latest return for client to help autocomplete fields
      const clientReturns = returns.filter(r => r.clientId === selectedClientId);
      if (clientReturns.length > 0) {
        // Sort by date/year/period descending
        const latest = clientReturns[0]; // just as a reference
        setComments(`Return for ${latest.clientName}`);
      }
    }
  }, [selectedClientId]);

  const openAddModal = (clientId?: string, year?: number, month?: string) => {
    setEditingReturn(null);
    setSelectedClientId(clientId || (clients[0]?.id || ''));
    setReturnYear(year || new Date().getFullYear());
    setReturnPeriod(month || 'January');
    setQty(0);
    setInvoiceAmount(0);
    setReturnDate(new Date().toISOString().slice(0, 10));
    setPaymentAmount(0);
    setPaymentDate('');
    setTxnRef('');
    setLessCF(0);
    setComments('');
    setOverrideStatus('Auto');
    setOverrideReason('');
    setIsModalOpen(true);
  };

  const openEditModal = (ret: ClientReturn) => {
    setEditingReturn(ret);
    setSelectedClientId(ret.clientId);
    setReturnYear(ret.year);
    setReturnPeriod(ret.period);
    setQty(ret.qty);
    setInvoiceAmount(ret.invoiceAmount);
    setReturnDate(ret.returnDate);
    setPaymentAmount(ret.paymentAmount);
    setPaymentDate(ret.paymentDate || '');
    setTxnRef(ret.txnRef);
    setLessCF(ret.lessCF);
    setComments(ret.comments);
    
    const calculatedOutstanding = ret.invoiceAmount - ret.paymentAmount - ret.lessCF;
    if (calculatedOutstanding > 0 && calculatedOutstanding < 100) {
      const defaultStatus = ret.paymentAmount > 0 ? 'Partially Paid' : 'Unpaid';
      if (ret.paymentStatus !== defaultStatus) {
        setOverrideStatus(ret.paymentStatus);
        const match = ret.comments.match(/\[Override Reason: (.*?)\]/);
        setOverrideReason(match ? match[1] : '');
      } else {
        setOverrideStatus('Auto');
        setOverrideReason('');
      }
    } else {
      setOverrideStatus('Auto');
      setOverrideReason('');
    }
    
    setIsModalOpen(true);
  };

  const handleDeleteReturn = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this return record?")) return;
    try {
      await DBService.deleteReturn(id);
      await fetchData();
    } catch (error) {
      console.error("Failed to delete return:", error);
      alert("Error deleting return record.");
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      alert("Please select a client.");
      return;
    }

    const clientObj = clients.find(c => c.id === selectedClientId);
    if (!clientObj) {
      alert("Selected client is invalid.");
      return;
    }

    // Dynamic calculations
    let outstanding = invoiceAmount - paymentAmount - lessCF;
    const calculatedOutstanding = outstanding;
    const isEligibleForOverride = calculatedOutstanding > 0 && calculatedOutstanding < 100;
    
    // Determine payment status
    let status: 'Fully Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (outstanding <= 0) {
      status = 'Fully Paid';
    } else if (paymentAmount > 0) {
      status = 'Partially Paid';
    }

    let finalComments = comments || `Filing return for ${returnPeriod} ${returnYear}`;
    if (isEligibleForOverride && overrideStatus !== 'Auto') {
      status = overrideStatus as 'Fully Paid' | 'Partially Paid' | 'Unpaid';
      if (overrideStatus === 'Fully Paid') {
        outstanding = 0; // write off the small balance!
      }
      
      const overrideTag = `[Override Status: ${overrideStatus}] [Override Reason: ${overrideReason}]`;
      if (!finalComments.includes(overrideTag)) {
        finalComments = finalComments ? `${finalComments} ${overrideTag}` : overrideTag;
      }
    }

    // Calculate aging days
    let aging = 0;
    if (outstanding > 0 && returnDate) {
      const retDateObj = new Date(returnDate);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - retDateObj.getTime());
      aging = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const returnObj: ClientReturn = {
      id: editingReturn ? editingReturn.id : `RET-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      clientId: selectedClientId,
      clientName: clientObj.clientName,
      year: returnYear,
      period: returnPeriod,
      qty,
      invoiceAmount,
      returnDate,
      paymentAmount,
      paymentDate,
      txnRef,
      lessCF,
      outstandingBalance: outstanding,
      agingDays: aging,
      paymentStatus: status,
      comments: finalComments
    };

    try {
      await DBService.saveReturn(returnObj);
      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("Failed to save return:", error);
      alert("Error saving return details. Please try again.");
    }
  };

  // CSV Parsing
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setImportErrors(["The uploaded file is empty or missing data lines."]);
        setParsedReturns([]);
        return;
      }

      const expectedHeaders = [
        'clientname',
        'year',
        'period',
        'qty',
        'invoiceamount',
        'returndate',
        'paymentamount',
        'paymentdate',
        'txnref',
        'lesscf',
        'outstandingbalance',
        'agingdays',
        'paymentstatus',
        'comments'
      ];

      const cleanHeader = (h: string) => h.replace(/^["']|["']$/g, '').toLowerCase().replace(/[\s_-]+/g, '');
      const headers = parseCSVLine(lines[0]).map(cleanHeader);
      const expectedClean = expectedHeaders.map(cleanHeader);
      
      if (headers.length < expectedClean.length || !expectedClean.every((h, idx) => headers[idx] === h)) {
        setImportErrors([
          `Invalid CSV columns or order. The CSV must contain these 14 columns in order:\n` +
          expectedHeaders.join(', ')
        ]);
        setParsedReturns([]);
        return;
      }

      const records: ClientReturn[] = [];
      const errors: string[] = [];
      const newlyCreated: LicensedClient[] = [];
      const workingClientsPool = [...clients];
      const csvKeys = new Set<string>();

      // Helper to match full month names
      const normalizePeriod = (val: string): string => {
        if (!val) return 'January';
        const trimmed = val.trim().toLowerCase();
        const match = monthsList.find(m => m.toLowerCase() === trimmed || m.toLowerCase().slice(0, 3) === trimmed);
        return match || 'January';
      };

      const parseCleanFloat = (val: string): number => {
        if (!val) return 0;
        const clean = val.replace(/,/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^["']|["']$/g, '').trim());
        if (values.length < expectedHeaders.length) continue;

        const rowNum = i + 1;
        const csvClientName = values[0];
        
        const rawYear = values[1];
        let yearVal = parseInt(rawYear.replace(/,/g, ''));
        if (isNaN(yearVal)) {
          const match = rawYear.match(/\b(19|20)\d{2}\b/);
          if (match) {
            yearVal = parseInt(match[0]);
          }
        }

        const rawPeriod = values[2];
        const periodVal = normalizePeriod(rawPeriod);

        const qtyVal = parseCleanFloat(values[3]);
        const invoiceVal = parseCleanFloat(values[4]);
        const retDateVal = values[5] || new Date().toISOString().slice(0, 10);
        const payVal = parseCleanFloat(values[6]);
        const payDateVal = values[7] || null;
        const refVal = values[8];
        const cfVal = parseCleanFloat(values[9]);
        const rawOutstanding = values[10];
        const rawAging = values[11];
        const rawPayStatus = values[12];
        const commsVal = values[13];

        if (!csvClientName) {
          errors.push(`Row ${rowNum}: Client Name is required.`);
          continue;
        }

        // Match against existing licensed clients (Permit number, Exact DBO, Exact Premise, Branch Premise, Normalized Stem, Substring)
        const cleanPermit = (s: string) => cleanPermitNumber(s);
        const csvPermitClean = cleanPermit(csvClientName);

        // 1. Exact or Cleaned Permit match (highest priority)
        let matchedClient = csvPermitClean ? workingClientsPool.find(c => 
          cleanPermit(c.permitNumber) === csvPermitClean || 
          cleanPermit(c.id) === csvPermitClean ||
          (c.branches && c.branches.some(b => cleanPermit(b.permitNumber) === csvPermitClean || cleanPermit(b.id) === csvPermitClean))
        ) : undefined;

        // 2. Flexible Name / Premise / Branch Premise match (case-insensitive, variable spacing resilient)
        if (!matchedClient) {
          matchedClient = workingClientsPool.find(c => 
            areNamesMatching(c.clientName, csvClientName) ||
            areNamesMatching(c.premiseName, csvClientName) ||
            (c.branches && c.branches.some(b => areNamesMatching(b.premiseName, csvClientName)))
          );
        }

        // 3. Flexible search/substring match as fallback
        if (!matchedClient) {
          matchedClient = workingClientsPool.find(c => 
            searchMatches(c.clientName, csvClientName) ||
            searchMatches(c.premiseName, csvClientName) ||
            (c.branches && c.branches.some(b => searchMatches(b.premiseName, csvClientName)))
          );
        }

        // 4. Loose substring / alphanumeric stem containment fallback
        if (!matchedClient) {
          const csvAlpha = normalizeAlphanumeric(csvClientName);
          if (csvAlpha.length >= 4) {
            matchedClient = workingClientsPool.find(c => {
              const cAlpha = normalizeAlphanumeric(c.clientName);
              const pAlpha = normalizeAlphanumeric(c.premiseName);
              return cAlpha.includes(csvAlpha) || csvAlpha.includes(cAlpha) ||
                     pAlpha.includes(csvAlpha) || csvAlpha.includes(pAlpha);
            });
          }
        }

        // Option B: Auto-Discovery Pipeline for Returns Ingestion
        if (!matchedClient) {
          if (autoProvisionClients) {
            const existingNew = newlyCreated.find(c => 
              areNamesMatching(c.clientName, csvClientName) || 
              areNamesMatching(c.premiseName, csvClientName)
            );
            if (existingNew) {
              matchedClient = existingNew;
            } else {
              const stub = autoProvisionClientStub(csvClientName, yearVal, periodVal);
              newlyCreated.push(stub);
              workingClientsPool.push(stub);
              matchedClient = stub;
            }
          } else {
            errors.push(`Row ${rowNum}: Could not find a registered client matching "${csvClientName}". Go to the Clients tab to add them first.`);
            continue;
          }
        }

        if (isNaN(yearVal) || yearVal < 1980 || yearVal > 2030) {
          errors.push(`Row ${rowNum}: Invalid Year "${rawYear}". Must be a number between 1980 and 2030.`);
          continue;
        }

        if (!monthsList.includes(periodVal)) {
          errors.push(`Row ${rowNum}: Invalid Period "${rawPeriod}". Must be a valid month (e.g., January, February).`);
          continue;
        }

        // Outstanding balance calculation
        const outstanding = rawOutstanding ? parseCleanFloat(rawOutstanding) : (invoiceVal - payVal - cfVal);
        
        // Aging Days calculation
        let aging = 0;
        if (rawAging) {
          aging = parseInt(rawAging.replace(/,/g, '')) || 0;
        } else if (outstanding > 0 && retDateVal) {
          const retDateObj = new Date(retDateVal);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - retDateObj.getTime());
          aging = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        // Payment status calculation
        let status: 'Fully Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
        if (rawPayStatus && ['Fully Paid', 'Partially Paid', 'Unpaid'].includes(rawPayStatus)) {
          status = rawPayStatus as any;
        } else {
          if (outstanding <= 0) {
            status = 'Fully Paid';
          } else if (payVal > 0) {
            status = 'Partially Paid';
          }
        }

        // Check if a return already exists in the database for this client and period.
        // As mandated: latest input acts as absolute source of truth, so we overwrite/update rather than error.
        const existingReturn = returns.find(r => 
          (r.clientId === matchedClient.id || areNamesMatching(r.clientName, matchedClient.clientName)) && 
          r.year === yearVal && 
          (r.period || '').trim().toLowerCase() === periodVal.toLowerCase()
        );

        const returnId = existingReturn 
          ? existingReturn.id 
          : `RET-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        const newReturnRecord: ClientReturn = {
          id: returnId,
          clientId: matchedClient.id,
          clientName: matchedClient.clientName,
          year: yearVal,
          period: periodVal,
          qty: isNaN(qtyVal) ? 0 : qtyVal,
          invoiceAmount: isNaN(invoiceVal) ? 0 : invoiceVal,
          returnDate: retDateVal,
          paymentAmount: isNaN(payVal) ? 0 : payVal,
          paymentDate: payDateVal,
          txnRef: refVal,
          lessCF: isNaN(cfVal) ? 0 : cfVal,
          outstandingBalance: outstanding,
          agingDays: aging,
          paymentStatus: status,
          comments: commsVal || `Imported return for ${periodVal} ${yearVal}`
        };

        // If duplicate appears within the same CSV, latest row in CSV acts as source of truth
        const existingInCsvIdx = records.findIndex(r => 
          r.clientId === matchedClient.id && 
          r.year === yearVal && 
          (r.period || '').trim().toLowerCase() === periodVal.toLowerCase()
        );

        if (existingInCsvIdx >= 0) {
          records[existingInCsvIdx] = newReturnRecord;
        } else {
          records.push(newReturnRecord);
        }
      }

      setParsedReturns(records);
      setNewlyProvisionedClients(newlyCreated);
      setImportErrors(errors);
    };
    reader.readAsText(file);
  };

  const downloadReturnsTemplate = () => {
    const headers = [
      'clientname',
      'year',
      'period',
      'qty',
      'invoiceamount',
      'returndate',
      'paymentamount',
      'paymentdate',
      'txnref',
      'lesscf',
      'outstandingbalance',
      'agingdays',
      'paymentstatus',
      'comments'
    ];
    const rows = [
      [
        'Brookside Kericho Depot',
        '2026',
        'March',
        '12000',
        '24000',
        '2026-03-15',
        '24000',
        '2026-03-20',
        'MPESA-REF123',
        '0',
        '0',
        '0',
        'Fully Paid',
        'Paid in full'
      ],
      [
        'Kapsoit Milk Bar',
        '2026',
        'April',
        '4500',
        '9000',
        '2026-04-10',
        '5000',
        '2026-04-12',
        'MR-10022',
        '0',
        '4000',
        '15',
        'Partially Paid',
        'Balance outstanding'
      ]
    ];
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const formatted = row.map(val => {
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(formatted.join(','));
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "kdb_returns_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImportSubmit = async () => {
    if (parsedReturns.length === 0) {
      alert("No valid records to import.");
      return;
    }
    setImporting(true);
    try {
      // 1. If any new client profiles were auto-discovered in the returns sheet, persist them
      if (newlyProvisionedClients.length > 0) {
        await DBService.saveClientsBulk(newlyProvisionedClients);
        const updatedClientsList = [...clients, ...newlyProvisionedClients];
        onClientsChange?.(updatedClientsList);
      }

      // 2. Persist returns in bulk
      await DBService.saveReturnsBulk(parsedReturns);
      const totalImported = parsedReturns.length;
      const totalNewClients = newlyProvisionedClients.length;

      setIsImportModalOpen(false);
      setCsvFile(null);
      setParsedReturns([]);
      setNewlyProvisionedClients([]);
      setImportErrors([]);
      await fetchData();

      const successMessage = totalNewClients > 0
        ? `Successfully imported ${totalImported} returns and auto-registered ${totalNewClients} new client profile(s) into Clients Registry!`
        : `Successfully imported ${totalImported} returns!`;
      alert(successMessage);
    } catch (error: any) {
      console.error("Bulk import failed:", error);
      alert(`Bulk import issue: ${error?.message || "Please check connection and try again."}`);
    } finally {
      setImporting(false);
    }
  };

  const exportAllReturnsCSV = () => {
    if (returns.length === 0) {
      alert("No returns to export.");
      return;
    }
    const headers = [
      'id',
      'clientId',
      'clientName',
      'year',
      'period',
      'qty',
      'invoiceAmount',
      'returnDate',
      'paymentAmount',
      'paymentDate',
      'txnRef',
      'lessCF',
      'outstandingBalance',
      'agingDays',
      'paymentStatus',
      'comments'
    ];
    const rows = returns.map(ret => [
      ret.id,
      ret.clientId,
      ret.clientName,
      ret.year,
      ret.period,
      ret.qty,
      ret.invoiceAmount,
      ret.returnDate,
      ret.paymentAmount,
      ret.paymentDate || '',
      ret.txnRef,
      ret.lessCF,
      ret.outstandingBalance,
      ret.agingDays,
      ret.paymentStatus,
      ret.comments
    ]);
    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      const formatted = row.map(val => {
        const escaped = ('' + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(formatted.join(','));
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kdb_returns_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportNonFilersCSV = (missingList: { client: LicensedClient; missingPeriods: { year: number; month: string }[] }[]) => {
    if (missingList.length === 0) {
      alert("No non-filers to export.");
      return;
    }
    const headers = [
      'Client Name',
      'Premise Name',
      'Contact Person',
      'Phone Number',
      'Location',
      'County',
      'Premise Category',
      'Missing Periods'
    ];
    const rows = missingList.map(item => [
      item.client.clientName,
      item.client.premiseName,
      item.client.contactPerson,
      item.client.tel || '',
      item.client.location,
      item.client.county,
      item.client.premiseCategory,
      item.missingPeriods.map(p => `${p.month} ${p.year}`).join(', ')
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
    link.setAttribute("download", `kdb_non_filers_${debtorFilterMonth}_${debtorFilterYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportReturnsDebtorsCSV = () => {
    const debtorClients: { clientName: string; premiseName: string; tel: string; location: string; county: string; outstandingBalance: number; periods: string }[] = [];
    
    const outstandingByClient: Record<string, any[]> = {};
    returns.forEach(r => {
      if (r.outstandingBalance > 0) {
        if (!outstandingByClient[r.clientId]) {
          outstandingByClient[r.clientId] = [];
        }
        outstandingByClient[r.clientId].push(r);
      }
    });

    Object.entries(outstandingByClient).forEach(([clientId, rets]) => {
      const client = clients.find(c => c.id === clientId);
      const totalOutstanding = rets.reduce((sum, r) => sum + r.outstandingBalance, 0);
      if (totalOutstanding > 0) {
        debtorClients.push({
          clientName: client ? client.clientName : rets[0].clientName,
          premiseName: client ? client.premiseName : 'Unknown Premise',
          tel: client ? client.tel : 'No Phone',
          location: client ? client.location : 'Unknown Location',
          county: client ? client.county : 'Unknown County',
          outstandingBalance: totalOutstanding,
          periods: rets.map(r => `${r.period} ${r.year}`).join('; ')
        });
      }
    });

    if (debtorClients.length === 0) {
      alert("No returns debtors to export.");
      return;
    }

    const headers = [
      'Client Name',
      'Premise Name',
      'Phone Number',
      'Location',
      'County',
      'Outstanding Balance (KES)',
      'Debtor Periods'
    ];

    const rows = debtorClients.map(d => [
      d.clientName,
      d.premiseName,
      d.tel,
      d.location,
      d.county,
      d.outstandingBalance,
      d.periods
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
    link.setAttribute("download", `kdb_returns_debtors_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to determine if client is marked/considered closed
  const isClosedClient = (c?: LicensedClient | null): boolean => {
    if (!c) return true;
    const op = String(c.operationalStatus || '').toLowerCase().trim();
    const permit = String(c.permitStatus || '').toLowerCase().trim();
    const closedKeywords = ['closed', 'closed down', 'closeddown', 'cessation', 'ceased', 'inactive', 'non-operational', 'non operational'];
    if (closedKeywords.includes(op) || op.includes('close') || op.includes('ceas')) return true;
    if (closedKeywords.includes(permit) || permit.includes('close') || permit.includes('ceas')) return true;
    return false;
  };

  // Helper to determine if client is marked/considered DNQ-R (Does not qualify to file returns)
  const isDnqClient = (c?: LicensedClient | null): boolean => {
    if (!c) return true;
    const levy = String(c.levyInfo || '').toUpperCase().trim();
    return levy === 'DNQ-R' || levy === 'DNQ' || levy.includes('DNQ') || levy.includes('DOES NOT QUALIFY') || levy !== 'QFR';
  };

  // Helper to check if client is active, operating, and qualifying for returns
  const isQualifyingOperatingClient = (c?: LicensedClient | null): boolean => {
    if (!c) return false;
    if (isClosedClient(c)) return false;
    if (isDnqClient(c)) return false;
    if (c.levyInfo !== 'QFR') return false;
    if (c.operationalStatus !== 'operating') return false;
    return true;
  };

  // Determine Unfiled Periods for a client
  const getUnfiledPeriodsForClient = (client: LicensedClient) => {
    // Exclude clients marked/considered closed or DNQ-R or both
    if (!client || !isQualifyingOperatingClient(client)) return [];

    let startY = client.startYear || 2024;
    if (startY < 2015 || startY > new Date().getFullYear() + 2) {
      startY = 2024; // Guard against invalid start years
    }
    const startMIdx = Math.max(0, monthsList.indexOf(client.startMonth || 'January'));
    
    const today = new Date();
    const currentY = today.getFullYear();
    const currentMIdx = today.getMonth(); // 0 - 11 (e.g. August = 7)

    // Missing periods should show up to the current month less one.
    // e.g. If we are in August 2026, the missing period should not show August 2026 since data collection is still running.
    let endY = currentY;
    let endMIdx = currentMIdx - 1;
    if (endMIdx < 0) {
      endY = currentY - 1;
      endMIdx = 11; // December of previous year
    }

    // If client start is after the cutoff period, return empty
    if (startY > endY || (startY === endY && startMIdx > endMIdx)) {
      return [];
    }

    const unfiledList: { year: number; month: string }[] = [];

    // Loop through year by year, month by month since client start up to (current month - 1)
    for (let y = startY; y <= endY; y++) {
      const startM = (y === startY) ? startMIdx : 0;
      const endM = (y === endY) ? endMIdx : 11;

      for (let m = startM; m <= endM; m++) {
        const monthName = monthsList[m];
        
        // Ensure client has not closed operations by this period
        if (client.endYear) {
          const endYClient = client.endYear;
          const endMIdxClient = Math.max(0, monthsList.indexOf(client.endMonth || 'December'));
          const hasClosed = (y > endYClient) || (y === endYClient && m > endMIdxClient);
          if (hasClosed) continue;
        }

        // Check if there is a filed return for this client, year, month
        const returnExists = returns.some(r => 
          r.clientId === client.id && 
          r.year === y && 
          r.period === monthName
        );

        if (!returnExists) {
          unfiledList.push({ year: y, month: monthName });
        }
      }
    }

    return unfiledList;
  };

  // Determine ALL clients who have not filed returns for a specific target Year and Month
  const getUnfiledReturnsByPeriod = (year: number, month: string) => {
    const today = new Date();
    const currentY = today.getFullYear();
    const currentMIdx = today.getMonth();
    const targetMIdx = monthsList.indexOf(month);

    // If checking a period in the current month or future, data collection is ongoing
    if (month !== 'All' && targetMIdx !== -1) {
      if (year > currentY || (year === currentY && targetMIdx >= currentMIdx)) {
        return [];
      }
    }

    const qfrClients = clients.filter(c => isQualifyingOperatingClient(c));
    
    return qfrClients.filter(client => {
      // Ensure client had started operations by this period
      let startY = client.startYear || 2024;
      if (startY < 2015 || startY > new Date().getFullYear() + 2) {
        startY = 2024;
      }
      const startMIdx = Math.max(0, monthsList.indexOf(client.startMonth || 'January'));

      const hasStarted = (year > startY) || (year === startY && targetMIdx >= startMIdx);
      if (!hasStarted) return false;

      // Ensure client has not closed operations by this period
      if (client.endYear) {
        const endY = client.endYear;
        const endMIdx = Math.max(0, monthsList.indexOf(client.endMonth || 'December'));
        const hasClosed = (year > endY) || (year === endY && targetMIdx > endMIdx);
        if (hasClosed) return false;
      }

      // If they have not filed a return in our registry, they are a debtor/non-filer
      const returnExists = returns.some(r => 
        r.clientId === client.id && 
        r.year === year && 
        (month === 'All' ? true : r.period === month)
      );

      return !returnExists;
    });
  };

  // Filter returns for general display table
  const filteredReturns = returns.filter(ret => {
    if (!ret) return false;
    const qSafe = String(searchQuery || '').trim().toLowerCase();
    const matchesSearch = !qSafe ||
      searchMatches(ret.clientName, qSafe) ||
      searchMatches(ret.txnRef, qSafe) ||
      searchMatches(ret.comments, qSafe) ||
      searchMatches(ret.period, qSafe) ||
      searchMatches(String(ret.year), qSafe);
    
    const matchesYear = filterYear === 'All' || String(ret.year).trim() === filterYear.trim();
    const matchesMonth = filterMonth === 'All' || (ret.period || '').trim().toLowerCase() === filterMonth.trim().toLowerCase();
    const matchesStatus = filterStatus === 'All' || ret.paymentStatus === filterStatus;

    return matchesSearch && matchesYear && matchesMonth && matchesStatus;
  });

  // Group returns by client for the single-entry Returns Registry view
  const clientSummaries = clients.map(client => {
    const clientReturns = returns.filter(ret => {
      const isClientMatch = ret.clientId === client.id || areNamesMatching(ret.clientName, client.clientName);
      if (!isClientMatch) return false;
      const matchesYear = filterYear === 'All' || String(ret.year).trim() === filterYear.trim();
      const matchesMonth = filterMonth === 'All' || (ret.period || '').trim().toLowerCase() === filterMonth.trim().toLowerCase();
      return matchesYear && matchesMonth;
    });

    const totalQty = clientReturns.reduce((sum, r) => sum + r.qty, 0);
    const totalInvoicedAmt = clientReturns.reduce((sum, r) => sum + r.invoiceAmount, 0);
    const totalPaidAmt = clientReturns.reduce((sum, r) => sum + r.paymentAmount, 0);
    const totalLessCFAmt = clientReturns.reduce((sum, r) => sum + r.lessCF, 0);
    const outstandingBal = clientReturns.reduce((sum, r) => sum + r.outstandingBalance, 0);

    return {
      client,
      returnsCount: clientReturns.length,
      totalQty,
      totalInvoicedAmt,
      totalPaidAmt,
      totalLessCFAmt,
      outstandingBal,
      clientReturns
    };
  });

  const filteredClientSummaries = clientSummaries.filter(summary => {
    if (!summary || !summary.client) return false;
    const qSafe = String(searchQuery || '').trim().toLowerCase();
    const matchesSearch = !qSafe ||
      searchMatches(summary.client.clientName, qSafe) ||
      searchMatches(summary.client.premiseName, qSafe) ||
      searchMatches(summary.client.location, qSafe) ||
      searchMatches(summary.client.id, qSafe) ||
      searchMatches(summary.client.permitNumber, qSafe);

    let matchesStatusFilter = true;
    if (filterStatus !== 'All') {
      if (filterStatus === 'Fully Paid') {
        matchesStatusFilter = summary.outstandingBal <= 0 && summary.returnsCount > 0;
      } else if (filterStatus === 'Partially Paid') {
        matchesStatusFilter = summary.outstandingBal > 0 && summary.totalPaidAmt > 0;
      } else if (filterStatus === 'Unpaid') {
        matchesStatusFilter = summary.outstandingBal > 0 && summary.totalPaidAmt === 0;
      }
    }

    return matchesSearch && matchesStatusFilter;
  });

  const handleViewStatement = (clientId: string) => {
    setSelectedStatementClientId(clientId);
    setActiveSubTab('statements');
  };

  // Calculations for registry sub-tab summary
  const totalInvoiced = returnsSummary.totalInvoicedAmt || returns.reduce((sum, r) => sum + r.invoiceAmount, 0);
  const totalPaid = returnsSummary.totalPaidAmt || returns.reduce((sum, r) => sum + r.paymentAmount, 0);
  const totalLessCF = returnsSummary.totalLessCFAmt || returns.reduce((sum, r) => sum + r.lessCF, 0);
  const totalOutstanding = returnsSummary.totalOutstanding || returns.reduce((sum, r) => sum + r.outstandingBalance, 0);

  // Client Statement calculations
  const statementClientObj = clients.find(c => c.id === selectedStatementClientId);
  const statementReturns = returns
    .filter(r => r.clientId === selectedStatementClientId || (statementClientObj && areNamesMatching(r.clientName, statementClientObj.clientName)))
    .sort((a, b) => b.year - a.year || monthsList.indexOf(b.period) - monthsList.indexOf(a.period));

  const filteredStatementReturns = statementReturns.filter(r => {
    const matchesYear = statementFilterYear === 'All' || r.year.toString() === statementFilterYear;
    if (!matchesYear) return false;

    const qSafe = (statementSearchQuery || '').trim().toLowerCase();
    if (qSafe === '') return true;
    return (
      (r.period || '').toLowerCase().includes(qSafe) ||
      (r.year || '').toString().includes(qSafe) ||
      (r.txnRef && r.txnRef.toLowerCase().includes(qSafe)) ||
      (r.comments && r.comments.toLowerCase().includes(qSafe)) ||
      (r.qty || '').toString().includes(qSafe) ||
      (r.invoiceAmount || '').toString().includes(qSafe) ||
      (r.paymentAmount || '').toString().includes(qSafe) ||
      (r.paymentDate && r.paymentDate.toLowerCase().includes(qSafe))
    );
  });

  const stmtTotalQty = filteredStatementReturns.reduce((sum, r) => sum + r.qty, 0);
  const stmtTotalInvoiced = filteredStatementReturns.reduce((sum, r) => sum + r.invoiceAmount, 0);
  const stmtTotalPaid = filteredStatementReturns.reduce((sum, r) => sum + r.paymentAmount, 0);
  const stmtTotalLessCF = filteredStatementReturns.reduce((sum, r) => sum + r.lessCF, 0);
  const stmtTotalOutstanding = filteredStatementReturns.reduce((sum, r) => sum + r.outstandingBalance, 0);
  
  const stmtUnfiledPeriods = statementClientObj ? getUnfiledPeriodsForClient(statementClientObj) : [];
  const stmtTotalMonths = (statementReturns.length + stmtUnfiledPeriods.length) || 1;
  const complianceRate = Math.round((statementReturns.length / stmtTotalMonths) * 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);
  };

  // Debtor/Ledger CRUD states and handlers
  const [isAddingDebtor, setIsAddingDebtor] = useState(false);
  const [editingDebtorId, setEditingDebtorId] = useState<string | null>(null);
  const [isSavingDebtor, setIsSavingDebtor] = useState(false);
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
    const renumbered = current.map((inst, i) => ({ ...inst, no: i + 1 }));
    setNewDebtor({ ...newDebtor, installments: renumbered });
  };

  const updateInstallmentRow = (index: number, field: keyof Installment, value: any) => {
    const current = [...(newDebtor.installments || [])];
    current[index] = { ...current[index], [field]: value };
    setNewDebtor({ ...newDebtor, installments: current });
  };

  const handleEditDebtor = (debtor: DebtorRecord) => {
    setEditingDebtorId(debtor.id);
    setNewDebtor(debtor);
    setIsAddingDebtor(true);
  };

  const handleAddDebtor = async () => {
    if (!newDebtor.dboName || !newDebtor.permitNo || !newDebtor.totalArrears) {
      return alert("Please fill in all required fields (DBO Name, Permit No, and Total Arrears).");
    }

    setIsSavingDebtor(true);
    try {
      const finalInstallments = newDebtor.installments || [];
      const totalFromInst = finalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const totalArrears = totalFromInst || newDebtor.totalArrears || 0;
      
      const arrearsPeriod = finalInstallments.map(i => i.period).filter(Boolean).join(', ') || 'Current';
      
      const manualDebtors = propDebtors || localDebtors;

      if (editingDebtorId) {
        const exists = manualDebtors.some(d => d.id === editingDebtorId);
        let updatedDebtors;
        if (exists) {
          updatedDebtors = manualDebtors.map(d => d.id === editingDebtorId ? {
            ...(newDebtor as DebtorRecord),
            id: editingDebtorId,
            totalArrears,
            totalArrearsWords: numberToWords(totalArrears),
            installments: finalInstallments,
            arrearsPeriod
          } : d);
        } else {
          updatedDebtors = [
            ...manualDebtors,
            {
              ...(newDebtor as DebtorRecord),
              id: editingDebtorId,
              totalArrears,
              totalArrearsWords: numberToWords(totalArrears),
              installments: finalInstallments,
              arrearsPeriod
            }
          ];
        }
        if (onDebtorUpdate) {
          await onDebtorUpdate(updatedDebtors);
        } else {
          setLocalDebtors(updatedDebtors);
        }
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
        const updatedDebtors = [...manualDebtors, debtor];
        if (onDebtorUpdate) {
          await onDebtorUpdate(updatedDebtors);
        } else {
          setLocalDebtors(updatedDebtors);
        }
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

  const exportLedgerCSV = () => {
    const activeDebtors = getIntegratedDebtors();
    if (activeDebtors.length === 0) {
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
    const rows = activeDebtors.map(d => [
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
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
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

  const handleDeleteDebtor = async (item: DebtorRecord) => {
    if (!confirm(`Are you sure you want to delete debtor "${item.dboName}"?`)) return;
    
    const key = item.id || item.permitNo || item.dboName;
    const newDeleted = Array.from(new Set([...deletedDebtorKeys, key, item.permitNo, item.dboName, item.id].filter(Boolean)));
    setDeletedDebtorKeys(newDeleted);
    try {
      localStorage.setItem('kdb_deleted_debtor_keys', JSON.stringify(newDeleted));
    } catch {}

    const activeList = getIntegratedDebtors();
    const updated = activeList.filter(d => d.id !== item.id && d.permitNo !== item.permitNo && d.dboName !== item.dboName);
    
    if (onDebtorUpdate) {
      await onDebtorUpdate(updated);
    }
    setLocalDebtors(updated);
    
    try {
      if (item.id) {
        await DBService.deleteDebtor(item.id);
      }
    } catch (err) {
      console.warn("DBService.deleteDebtor notice:", err);
    }
    onRefresh?.();
  };

  const handleDeleteAllDebtors = async () => {
    const activeList = getIntegratedDebtors();
    if (activeList.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${activeList.length} debtor entries? This will clear the debtors ledger.`)) return;
    
    const allKeys = activeList.flatMap(d => [d.id, d.permitNo, d.dboName]).filter(Boolean);
    const newDeleted = Array.from(new Set([...deletedDebtorKeys, ...allKeys]));
    setDeletedDebtorKeys(newDeleted);
    try {
      localStorage.setItem('kdb_deleted_debtor_keys', JSON.stringify(newDeleted));
    } catch {}

    if (onDebtorUpdate) {
      await onDebtorUpdate([]);
    }
    setLocalDebtors([]);
    try {
      await DBService.saveDebtors([]);
    } catch (err) {
      console.warn("Notice saving empty debtors:", err);
    }
    onRefresh?.();
  };

  const handleDeleteSelectedDebtors = async () => {
    if (selectedDebtorIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDebtorIds.length} selected debtor entry(s)?`)) return;

    const activeList = getIntegratedDebtors();
    const selectedSet = new Set(selectedDebtorIds);
    const toDelete = activeList.filter(d => selectedSet.has(d.id));
    const allKeys = toDelete.flatMap(d => [d.id, d.permitNo, d.dboName]).filter(Boolean);
    const newDeleted = Array.from(new Set([...deletedDebtorKeys, ...allKeys]));
    setDeletedDebtorKeys(newDeleted);
    try {
      localStorage.setItem('kdb_deleted_debtor_keys', JSON.stringify(newDeleted));
    } catch {}

    const remaining = activeList.filter(d => !selectedSet.has(d.id));
    if (onDebtorUpdate) {
      await onDebtorUpdate(remaining);
    }
    setLocalDebtors(remaining);
    setSelectedDebtorIds([]);

    try {
      for (const d of toDelete) {
        if (d.id) {
          await DBService.deleteDebtor(d.id);
        }
      }
    } catch (err) {
      console.warn("Notice deleting selected debtors:", err);
    }
    onRefresh?.();
  };

  const toggleSelectDebtor = (id: string) => {
    setSelectedDebtorIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDebtors = (list: DebtorRecord[]) => {
    const listIds = list.map(d => d.id);
    const allSelected = listIds.length > 0 && listIds.every(id => selectedDebtorIds.includes(id));
    if (allSelected) {
      setSelectedDebtorIds(prev => prev.filter(id => !listIds.includes(id)));
    } else {
      setSelectedDebtorIds(prev => Array.from(new Set([...prev, ...listIds])));
    }
  };

  const handleDebtorCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDebtorCsvFile(file);
    setDebtorImportErrors([]);
    setDebtorImportWarnings([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setDebtorImportErrors(["The selected file is empty."]);
        setParsedDebtors([]);
        return;
      }

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setDebtorImportErrors(["The file must contain a header row and at least one data row."]);
        setParsedDebtors([]);
        return;
      }

      const cleanHeader = (h: string) => h.replace(/^["']|["']$/g, '').toLowerCase().replace(/[\s_\-()]+/g, '');
      const headerCols = parseCSVLine(lines[0]).map(cleanHeader);

      const findCol = (...candidates: string[]) => {
        for (const cand of candidates) {
          const idx = headerCols.findIndex(h => h.includes(cand));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const dboNameIdx = findCol('dboname', 'clientname', 'dbo', 'operator', 'name');
      const premiseNameIdx = findCol('premisename', 'premise', 'depot', 'facility');
      const permitNoIdx = findCol('permitno', 'permit', 'license', 'licenseno');
      const locationIdx = findCol('location', 'address', 'town');
      const countyIdx = findCol('county');
      const arrearsPeriodIdx = findCol('arrearsperiod', 'period', 'periods', 'month', 'months');
      const totalArrearsIdx = findCol('outstandingbalance', 'totalarrears', 'arrears', 'balance', 'amount', 'total');
      const debitNoteNoIdx = findCol('debitnoteno', 'debitnote', 'dn', 'ref');
      const telIdx = findCol('telephone', 'phone', 'tel', 'mobile', 'contact');

      if (dboNameIdx === -1 && permitNoIdx === -1) {
        setDebtorImportErrors([
          "Could not detect a 'DBO Name' or 'Permit No' column. Please ensure your CSV includes headers such as: DBO Name, Premise Name, Permit No, Location, County, Arrears Periods, Outstanding Balance (KES), Debit Note No, Telephone."
        ]);
        setParsedDebtors([]);
        return;
      }

      const records: DebtorRecord[] = [];
      const warnings: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const rowValues = parseCSVLine(lines[i]);
        if (rowValues.length < 2) continue;

        const rowNum = i + 1;
        const getVal = (idx: number) => (idx !== -1 && rowValues[idx] !== undefined) ? rowValues[idx].replace(/^["']|["']$/g, '').trim() : '';

        const dboName = getVal(dboNameIdx);
        const permitNo = getVal(permitNoIdx);
        const premiseName = getVal(premiseNameIdx) || 'Main Depot';
        const location = getVal(locationIdx) || 'N/A';
        const county = getVal(countyIdx) || 'N/A';
        const arrearsPeriod = getVal(arrearsPeriodIdx) || `${new Date().getFullYear()}`;
        const rawArrears = getVal(totalArrearsIdx);
        const debitNoteNo = getVal(debitNoteNoIdx) || `DN/IMP/${new Date().getFullYear()}/${String(rowNum).padStart(3, '0')}`;
        const tel = getVal(telIdx) || '';

        if (!dboName && !permitNo) {
          warnings.push(`Row ${rowNum}: Skipped because both DBO Name and Permit No are missing.`);
          continue;
        }

        const cleanArrearsStr = rawArrears.replace(/[^0-9.-]/g, '');
        const totalArrears = parseFloat(cleanArrearsStr) || 0;

        if (totalArrears <= 0) {
          warnings.push(`Row ${rowNum} (${dboName || permitNo}): Outstanding arrears amount was 0 or invalid.`);
        }

        const generatedId = `deb-imp-${Date.now()}-${i}`;
        const effectivePermitNo = permitNo || `KDB/MB/${String(1000 + i)}/${new Date().getFullYear()}`;
        const effectiveDboName = dboName || `Operator ${effectivePermitNo}`;

        const installments: Installment[] = [
          {
            no: 1,
            period: arrearsPeriod,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            amount: totalArrears
          }
        ];

        records.push({
          id: generatedId,
          dboName: effectiveDboName,
          premiseName,
          permitNo: effectivePermitNo,
          county,
          location,
          totalArrears,
          totalArrearsWords: numberToWords(totalArrears),
          arrearsPeriod,
          debitNoteNo,
          tel,
          arrearsBreakdown: [{ id: `imp-arr-${i}`, month: arrearsPeriod, amount: totalArrears }],
          installments
        });
      }

      if (records.length === 0) {
        setDebtorImportErrors(["No valid debtor records could be extracted from the file."]);
        setParsedDebtors([]);
        return;
      }

      setParsedDebtors(records);
      setDebtorImportWarnings(warnings);
    };
    reader.readAsText(file);
  };

  const handleConfirmDebtorImport = async () => {
    if (parsedDebtors.length === 0) return;
    setIsImportingDebtors(true);
    try {
      let finalDebtors: DebtorRecord[];
      if (debtorImportMode === 'replace') {
        finalDebtors = parsedDebtors;
        const importedKeys = new Set(parsedDebtors.flatMap(d => [d.id, d.permitNo, d.dboName]));
        setDeletedDebtorKeys(prev => {
          const filtered = prev.filter(k => !importedKeys.has(k));
          try {
            localStorage.setItem('kdb_deleted_debtor_keys', JSON.stringify(filtered));
          } catch {}
          return filtered;
        });
      } else {
        const activeList = getIntegratedDebtors();
        const existingMap = new Map<string, DebtorRecord>();
        activeList.forEach(d => {
          existingMap.set(d.permitNo.toLowerCase(), d);
          existingMap.set(d.dboName.toLowerCase(), d);
        });

        const merged = [...activeList];
        parsedDebtors.forEach(p => {
          const keyPermit = p.permitNo.toLowerCase();
          const keyName = p.dboName.toLowerCase();
          if (existingMap.has(keyPermit)) {
            const idx = merged.findIndex(d => d.permitNo.toLowerCase() === keyPermit);
            if (idx !== -1) merged[idx] = { ...merged[idx], ...p, id: merged[idx].id };
          } else if (existingMap.has(keyName)) {
            const idx = merged.findIndex(d => d.dboName.toLowerCase() === keyName);
            if (idx !== -1) merged[idx] = { ...merged[idx], ...p, id: merged[idx].id };
          } else {
            merged.push(p);
          }
        });
        finalDebtors = merged;
        const importedKeys = new Set(parsedDebtors.flatMap(d => [d.id, d.permitNo, d.dboName]));
        setDeletedDebtorKeys(prev => {
          const filtered = prev.filter(k => !importedKeys.has(k));
          try {
            localStorage.setItem('kdb_deleted_debtor_keys', JSON.stringify(filtered));
          } catch {}
          return filtered;
        });
      }

      if (onDebtorUpdate) {
        await onDebtorUpdate(finalDebtors);
      }
      setLocalDebtors(finalDebtors);
      try {
        await DBService.saveDebtors(finalDebtors);
      } catch (saveErr) {
        console.warn("DBService.saveDebtors notice:", saveErr);
      }

      onRefresh?.();
      setIsDebtorImportModalOpen(false);
      setDebtorCsvFile(null);
      setParsedDebtors([]);
      alert(`Successfully imported ${parsedDebtors.length} debtor entries!`);
    } catch (err: any) {
      console.error("Error importing debtors:", err);
      alert(`Import failed: ${err.message || 'Please check file format and try again.'}`);
    } finally {
      setIsImportingDebtors(false);
    }
  };

  const downloadDebtorSampleCSV = () => {
    const sampleHeaders = [
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
    const sampleRows = [
      [
        'Sunrise Dairy Ltd',
        'Sunrise Main Depot',
        'KDB/MB/0001234/2025',
        'Thika Road, Ruiru',
        'Kiambu',
        'Jan 2025 - Mar 2025',
        '150000',
        'DN/2025/552',
        '0712345678'
      ],
      [
        'Highland Creameries',
        'Eldoret Central Depot',
        'KDB/MB/0004521/2025',
        'Uganda Road, Eldoret',
        'Uasin Gishu',
        'Feb 2025',
        '95000',
        'DN/2025/553',
        '0722998877'
      ]
    ];

    const csvContent = [
      sampleHeaders.join(','),
      ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'kdb_debtors_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Page Header */}
      {!hideNavigationHeader && !debtorsOnly && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> Returns & Ledger Module
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              File monthly levy, monitor collections, and track debtor payment schedules
            </p>
          </div>

          {/* Sub-tab Navigation */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200">
            <button
              onClick={() => setActiveSubTab('registry')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeSubTab === 'registry' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Database size={13} /> Returns Registry
            </button>
            <button
              onClick={() => setActiveSubTab('debtors')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeSubTab === 'debtors' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <AlertTriangle size={13} className="text-amber-500" /> Debtors Ledger
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-md p-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">Loading records & database configurations...</p>
        </div>
      ) : (
        <>
          {/* ==================== SUB-TAB: REGISTRY ==================== */}
          {activeSubTab === 'registry' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-500">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Invoiced</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{formatCurrency(totalInvoiced)}</div>
                  </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-500">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Collections</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{formatCurrency(totalPaid)}</div>
                  </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                  <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Balance</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{formatCurrency(totalOutstanding)}</div>
                  </div>
                </div>
              </div>

              {/* Action Bar & Filters */}
              <div className="bg-white p-4 sm:p-6 rounded-none sm:rounded-2xl md:rounded-3xl border-y sm:border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-grow">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Client Name / Txn ref..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 focus:bg-white transition-all outline-none"
                    />
                  </div>

                  {/* Year filter */}
                  <div>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none"
                    >
                      <option value="All">All Years</option>
                      {yearsList.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {/* Month filter */}
                  <div>
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none"
                    >
                      <option value="All">All Months</option>
                      {monthsList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment status filter */}
                  <div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Fully Paid">Fully Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>
                </div>

                {/* Import/Export buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {returns.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Push all ${returns.length} returns to Supabase now?`)) return;
                        setLoading(true);
                        try {
                          await DBService.saveReturnsBulk(returns);
                          await fetchData();
                          alert(`Successfully pushed ${returns.length} returns to Supabase!`);
                        } catch (err: any) {
                          alert(`Sync failed: ${err?.message || 'Check connection'}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm"
                      title="Push current list of returns directly to Supabase table"
                    >
                      <Database size={13} /> Sync to Supabase
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCsvFile(null);
                      setParsedReturns([]);
                      setImportErrors([]);
                      setIsImportModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm border border-slate-200"
                  >
                    <Upload size={13} /> Import CSV
                  </button>
                  <button
                    onClick={exportAllReturnsCSV}
                    className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm border border-slate-200"
                  >
                    <Download size={13} /> Export CSV
                  </button>
                  <button
                    onClick={() => openAddModal()}
                    className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md"
                  >
                    <Plus size={13} /> File Return
                  </button>
                </div>
              </div>

              {/* Batch Options & Egress Limitation Bar (Dropdown Format: Show ___ entries) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="text-slate-600 font-semibold text-xs">Show</span>
                    <select
                      value={batchSize}
                      onChange={(e) => handleBatchSizeChange(Number(e.target.value) as 10 | 25 | 50 | 100)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 shadow-2xs cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-slate-600 font-semibold text-xs">entries</span>
                  </div>

                  {/* View Mode: Returns List vs Client Summaries */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setRegistryView('returns-list')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        registryView === 'returns-list'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Returns List ({returns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistryView('client-summaries')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        registryView === 'client-summaries'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Client Summaries
                    </button>
                  </div>

                  <div className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Limited Egress: Batch {currentPage} of {totalReturnsPages} (range: {totalReturnsCount === 0 ? 0 : (currentPage - 1) * batchSize + 1}–{Math.min(currentPage * batchSize, totalReturnsCount)})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Showing <span className="font-bold text-slate-900">{totalReturnsCount === 0 ? 0 : (currentPage - 1) * batchSize + 1}</span>–<span className="font-bold text-slate-900">{Math.min(currentPage * batchSize, totalReturnsCount)}</span> of <span className="font-bold text-slate-900">{totalReturnsCount.toLocaleString()}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                      title="Previous batch"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[11px] font-bold text-slate-700 px-2">
                      Page {currentPage} of {totalReturnsPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalReturnsPages || loading}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                      title="Next batch"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Registry Table */}
              <div className="bg-white rounded-none sm:rounded-2xl md:rounded-3xl border-y sm:border border-slate-100 shadow-xl overflow-hidden">
                {registryView === 'returns-list' ? (
                  /* Returns Filings List View */
                  returns.length === 0 ? (
                    <div className="p-20 text-center space-y-4">
                      <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">No return filings found in this batch.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Client & Period</th>
                            <th className="px-6 py-4 text-right">Quantity (L)</th>
                            <th className="px-6 py-4 text-right">Invoiced (KES)</th>
                            <th className="px-6 py-4 text-right">Paid (KES)</th>
                            <th className="px-6 py-4 text-right">Less CF (KES)</th>
                            <th className="px-6 py-4 text-right">Balance (KES)</th>
                            <th className="px-6 py-4">Dates & Ref</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {returns.map((ret) => (
                            <tr key={ret.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4.5">
                                <div className="text-slate-900 font-black">{ret.clientName}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-black text-[9px]">
                                    {ret.period} {ret.year}
                                  </span>
                                  {ret.clientId && <span>• ID: {ret.clientId}</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4.5 text-right text-slate-900 font-extrabold">
                                {Number(ret.qty || 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-4.5 text-right font-black text-slate-900">
                                {formatCurrency(ret.invoiceAmount)}
                              </td>
                              <td className="px-6 py-4.5 text-right font-bold text-emerald-600">
                                {formatCurrency(ret.paymentAmount)}
                              </td>
                              <td className="px-6 py-4.5 text-right font-medium text-slate-500">
                                {formatCurrency(ret.lessCF)}
                              </td>
                              <td className={`px-6 py-4.5 text-right font-black ${ret.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                {formatCurrency(ret.outstandingBalance)}
                              </td>
                              <td className="px-6 py-4.5 text-[10px]">
                                <div className="text-slate-600 font-semibold">
                                  Filed: {ret.returnDate ? formatDateToDDMMYYYY(ret.returnDate) : '—'}
                                </div>
                                {ret.paymentDate && (
                                  <div className="text-slate-400">
                                    Paid: {formatDateToDDMMYYYY(ret.paymentDate)}
                                  </div>
                                )}
                                {ret.txnRef && (
                                  <div className="text-slate-400 truncate max-w-[120px]" title={ret.txnRef}>
                                    Ref: {ret.txnRef}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4.5">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  ret.paymentStatus === 'Fully Paid' || (ret.outstandingBalance <= 0 && ret.paymentAmount > 0)
                                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                                    : ret.paymentStatus === 'Partially Paid' || (ret.outstandingBalance > 0 && ret.paymentAmount > 0)
                                    ? 'bg-amber-50 border border-amber-100 text-amber-600'
                                    : 'bg-rose-50 border border-rose-100 text-rose-600'
                                }`}>
                                  {ret.paymentStatus || (ret.outstandingBalance <= 0 ? 'Fully Paid' : 'Unpaid')}
                                </span>
                              </td>
                              <td className="px-6 py-4.5 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => openEditModal(ret)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                                    title="Edit Return"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReturn(ret.id)}
                                    className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Delete Return"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  /* Client Summaries View */
                  filteredClientSummaries.length === 0 ? (
                    <div className="p-20 text-center space-y-4">
                      <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">No clients matched your filters.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Client / Premise details</th>
                            <th className="px-6 py-4 text-center">Returns Filed</th>
                            <th className="px-6 py-4 text-right">Aggregated QTY</th>
                            <th className="px-6 py-4 text-right">Invoiced Amt</th>
                            <th className="px-6 py-4 text-right">Paid Amt</th>
                            <th className="px-6 py-4 text-right">Outstanding Bal</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {filteredClientSummaries.map(({ client, returnsCount, totalQty, totalInvoicedAmt, totalPaidAmt, totalLessCFAmt, outstandingBal }) => (
                            <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4.5">
                                <div className="text-slate-900 font-black">{client.clientName}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold">{client.premiseCategory}</span>
                                  <span>• {client.premiseName}</span>
                                  <span>• Permit: {client.permitNumber || client.id}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4.5 text-center">
                                <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-full text-[10px] font-black">
                                  {returnsCount}
                                </span>
                              </td>
                              <td className="px-6 py-4.5 text-right text-slate-900 font-extrabold">
                                {totalQty.toLocaleString()}
                              </td>
                              <td className="px-6 py-4.5 text-right font-black text-slate-900">
                                {formatCurrency(totalInvoicedAmt)}
                              </td>
                              <td className="px-6 py-4.5 text-right font-bold text-emerald-600">
                                {formatCurrency(totalPaidAmt)}
                              </td>
                              <td className={`px-6 py-4.5 text-right font-black ${outstandingBal > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                                {formatCurrency(outstandingBal)}
                              </td>
                              <td className="px-6 py-4.5">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  outstandingBal <= 0 && returnsCount > 0
                                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                                    : outstandingBal > 0
                                    ? 'bg-rose-50 border border-rose-100 text-rose-600'
                                    : 'bg-slate-50 border border-slate-100 text-slate-500'
                                }`}>
                                  {outstandingBal <= 0 && returnsCount > 0 ? 'Up to Date' : outstandingBal > 0 ? 'Arrears' : 'No filings'}
                                </span>
                              </td>
                              <td className="px-6 py-4.5 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => openAddModal(client.id)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                                    title="File Return"
                                  >
                                    <Plus size={14} className="text-slate-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* Bottom Pagination & Batch Range Controls */}
                {totalReturnsCount > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-semibold text-xs">Show</span>
                      <select
                        value={batchSize}
                        onChange={(e) => handleBatchSizeChange(Number(e.target.value) as 10 | 25 | 50 | 100)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-slate-600 font-semibold text-xs">entries</span>
                      <span className="text-[11px] text-slate-400 ml-1 font-medium hidden sm:inline">
                        (Showing {totalReturnsCount === 0 ? 0 : (currentPage - 1) * batchSize + 1}–{Math.min(currentPage * batchSize, totalReturnsCount)} of {totalReturnsCount.toLocaleString()} returns)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage <= 1 || loading}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        First
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        <ChevronLeft size={13} /> Prev
                      </button>
                      <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-900 text-[11px] font-black">
                        {currentPage} / {totalReturnsPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalReturnsPages || loading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        Next <ChevronRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePageChange(totalReturnsPages)}
                        disabled={currentPage >= totalReturnsPages || loading}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== SUB-TAB: DEBTORS LEDGER ==================== */}
          {activeSubTab === 'debtors' && (
            <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
              {(() => {
                // Gather combined debtors ledger (manual and returns-based)
                const activeDebtors = getIntegratedDebtors();
                  
                let filteredLedger = activeDebtors;
                const qSafe = (debtorSearchQuery || '').trim().toLowerCase();
                if (qSafe !== '') {
                  filteredLedger = activeDebtors.filter(d => 
                    (d.dboName || '').toLowerCase().includes(qSafe) || 
                    (d.permitNo || '').toLowerCase().includes(qSafe) ||
                    (d.premiseName && d.premiseName.toLowerCase().includes(qSafe)) ||
                    (d.county && d.county.toLowerCase().includes(qSafe)) ||
                    (d.location && d.location.toLowerCase().includes(qSafe))
                  );
                }

                // Filter by selected year
                if (debtorFilterYear !== 'All') {
                  filteredLedger = filteredLedger.filter(d => {
                    const hasYearInInstallment = d.installments?.some(inst => (inst.period || '').includes(debtorFilterYear));
                    const hasYearInPeriod = (d.arrearsPeriod || '').includes(debtorFilterYear);
                    return hasYearInInstallment || hasYearInPeriod;
                  });
                }

                // Filter by selected month
                if (debtorFilterMonth !== 'All') {
                  filteredLedger = filteredLedger.filter(d => {
                    const monthShort = debtorFilterMonth.slice(0, 3);
                    const hasMonthInInstallment = d.installments?.some(inst => 
                      (inst.period || '').toLowerCase().includes(debtorFilterMonth.toLowerCase()) || 
                      (inst.period || '').toLowerCase().includes(monthShort.toLowerCase())
                    );
                    const hasMonthInPeriod = (d.arrearsPeriod || '').toLowerCase().includes(debtorFilterMonth.toLowerCase()) || 
                      (d.arrearsPeriod || '').toLowerCase().includes(monthShort.toLowerCase());
                    return hasMonthInInstallment || hasMonthInPeriod;
                  });
                }

                const totalDebtors = filteredLedger.length;
                const debtorsTotalPages = Math.max(1, Math.ceil(totalDebtors / debtorsBatchSize));
                const safeDebtorsPage = Math.min(Math.max(1, debtorsCurrentPage), debtorsTotalPages);
                const paginatedDebtors = filteredLedger.slice(
                  (safeDebtorsPage - 1) * debtorsBatchSize,
                  safeDebtorsPage * debtorsBatchSize
                );

                const isAllPageSelected = paginatedDebtors.length > 0 && paginatedDebtors.every(d => selectedDebtorIds.includes(d.id));

                return (
                  /* Combined Debtors Ledger Directory Bubble */
                  <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    {/* Header Toolbar */}
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>Debt Recovery & Enforcement</span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                          Debtors Ledger Directory
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold border border-slate-200">
                            {filteredLedger.length}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Filter operators, import CSV records, manage arrears and active payment agreements
                        </p>
                      </div>

                      {/* Header Actions: Import CSV, Export Excel, Add Entry, Delete All */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsDebtorImportModalOpen(true)}
                          className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
                          title="Import Debtors from CSV file"
                        >
                          <Upload size={13} className="text-blue-600" /> Import CSV
                        </button>
                        <button
                          type="button"
                          onClick={exportLedgerCSV}
                          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
                          title="Download Excel list of clients with outstanding debts"
                        >
                          <Download size={13} className="text-amber-500" /> Export Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingDebtor(true)}
                          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                          title="Add a new custom entry to the debtors ledger"
                        >
                          <Plus size={13} /> Add Entry
                        </button>
                        {activeDebtors.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteAllDebtors}
                            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
                            title="Delete all debtor entries from the ledger"
                          >
                            <Trash2 size={13} className="text-rose-600" /> Delete All
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Integrated Filters inside the Combined Bubble */}
                    <div className="p-5 sm:p-6 bg-slate-50/60 border-b border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        {/* Search Bar */}
                        <div className="md:col-span-6 space-y-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Directory</span>
                          <div className="relative">
                            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search client, premise, location, permit no..."
                              value={debtorSearchQuery}
                              onChange={(e) => setDebtorSearchQuery(e.target.value)}
                              className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300 bg-white shadow-2xs"
                            />
                            {debtorSearchQuery && (
                              <button onClick={() => setDebtorSearchQuery('')} className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Years dropdown */}
                        <div className="md:col-span-3 space-y-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Year</span>
                          <select
                            value={debtorFilterYear}
                            onChange={(e) => setDebtorFilterYear(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-700 bg-white outline-none focus:border-slate-300 transition-all cursor-pointer shadow-2xs"
                          >
                            <option value="All">All Years</option>
                            {yearsList.map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>

                        {/* Months dropdown */}
                        <div className="md:col-span-3 space-y-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Month</span>
                          <select
                            value={debtorFilterMonth}
                            onChange={(e) => setDebtorFilterMonth(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-700 bg-white outline-none focus:border-slate-300 transition-all cursor-pointer shadow-2xs"
                          >
                            <option value="All">All Months</option>
                            {monthsList.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Top Batch Options & Pagination Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3 border-b border-slate-200/70 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          <span className="text-slate-600 font-semibold text-xs">Show</span>
                          <select
                            value={debtorsBatchSize}
                            onChange={(e) => {
                              setDebtorsBatchSize(Number(e.target.value) as 10 | 25 | 50 | 100);
                              setDebtorsCurrentPage(1);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 shadow-2xs cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                          <span className="text-slate-600 font-semibold text-xs">entries</span>
                        </div>

                        <div className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>Batch {safeDebtorsPage} of {debtorsTotalPages} (range: {totalDebtors === 0 ? 0 : (safeDebtorsPage - 1) * debtorsBatchSize + 1}–{Math.min(safeDebtorsPage * debtorsBatchSize, totalDebtors)})</span>
                        </div>

                        {selectedDebtorIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleDeleteSelectedDebtors}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                            title="Delete selected debtors"
                          >
                            <Trash2 size={12} />
                            <span>Delete Selected ({selectedDebtorIds.length})</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-[11px] text-slate-500 font-semibold">
                          Showing <span className="font-bold text-slate-900">{totalDebtors === 0 ? 0 : (safeDebtorsPage - 1) * debtorsBatchSize + 1}</span>–<span className="font-bold text-slate-900">{Math.min(safeDebtorsPage * debtorsBatchSize, totalDebtors)}</span> of <span className="font-bold text-slate-900">{totalDebtors.toLocaleString()}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={safeDebtorsPage <= 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                            title="Previous batch"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[11px] font-bold text-slate-700 px-2">
                            Page {safeDebtorsPage} of {debtorsTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(prev => Math.min(debtorsTotalPages, prev + 1))}
                            disabled={safeDebtorsPage >= debtorsTotalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                            title="Next batch"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table View */}
                    {filteredLedger.length === 0 ? (
                      <div className="p-20 text-center space-y-4">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">No debtors found matching criteria!</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 bg-white z-10">
                              <th className="px-4 py-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAllPageSelected}
                                  onChange={() => toggleSelectAllDebtors(paginatedDebtors)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  title="Select all on this page"
                                />
                              </th>
                              <th className="px-6 py-3">Client details</th>
                              <th className="px-6 py-3">Premise Name</th>
                              <th className="px-6 py-3">Permit No</th>
                              <th className="px-6 py-3">Arrears Period(s)</th>
                              <th className="px-6 py-3 text-right">Balance Due</th>
                              <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                            {paginatedDebtors.map((item, idx) => {
                              const isSelected = selectedDebtorIds.includes(item.id);
                              return (
                                <tr key={item.id || idx} className={`transition-colors ${isSelected ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50/50'}`}>
                                  <td className="px-4 py-3.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectDebtor(item.id)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-6 py-3.5">
                                    <div className="text-slate-900 font-black">{item.dboName}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Phone size={10} /> {item.tel || 'No phone'}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3.5">
                                    <div className="text-slate-800">{item.premiseName || 'N/A'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      {item.county || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px]">
                                    {item.permitNo}
                                  </td>
                                  <td className="px-6 py-3.5 text-slate-500 font-medium">
                                    {item.arrearsPeriod || 'Current'}
                                  </td>
                                  <td className="px-6 py-3.5 text-right text-rose-600 font-black">
                                    {formatCurrency(item.totalArrears)}
                                  </td>
                                  <td className="px-6 py-3.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleEditDebtor(item)}
                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                        title="Edit Ledger Entry"
                                      >
                                        <PenTool className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDebtor(item)}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                        title="Delete Ledger Entry"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigate(`/payment-agreement?bypassPermit=${encodeURIComponent(item.permitNo)}`);
                                        }}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                                        title="Bypass login & create debt agreement from admin side"
                                      >
                                        <ExternalLink className="w-3 h-3" /> Bypass & Create Agreement
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Bottom Pagination & Batch Range Controls for Debtors Ledger */}
                    {totalDebtors > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 font-semibold text-xs">Show</span>
                          <select
                            value={debtorsBatchSize}
                            onChange={(e) => {
                              setDebtorsBatchSize(Number(e.target.value) as 10 | 25 | 50 | 100);
                              setDebtorsCurrentPage(1);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-blue-600 shadow-2xs cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                          <span className="text-slate-600 font-semibold text-xs">entries</span>
                          <span className="text-[11px] text-slate-400 ml-1 font-medium hidden sm:inline">
                            (Showing {totalDebtors === 0 ? 0 : (safeDebtorsPage - 1) * debtorsBatchSize + 1}–{Math.min(safeDebtorsPage * debtorsBatchSize, totalDebtors)} of {totalDebtors.toLocaleString()} debtors)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(1)}
                            disabled={safeDebtorsPage <= 1}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            First
                          </button>
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={safeDebtorsPage <= 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <span className="text-[11px] font-bold text-slate-700 px-2">
                            Page {safeDebtorsPage} of {debtorsTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(prev => Math.min(debtorsTotalPages, prev + 1))}
                            disabled={safeDebtorsPage >= debtorsTotalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDebtorsCurrentPage(debtorsTotalPages)}
                            disabled={safeDebtorsPage >= debtorsTotalPages}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            Last
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Add/Edit Debtor Modal */}
              {isAddingDebtor && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                  <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-2xl w-full space-y-6 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingDebtorId ? 'Edit Ledger Entry' : 'Add New Ledger Entry'}</h3>
                      <button onClick={() => { setIsAddingDebtor(false); setEditingDebtorId(null); }} className="p-2 hover:bg-slate-100 rounded-full cursor-pointer"><X className="w-5 h-5" /></button>
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
                          <button onClick={addInstallmentRow} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center cursor-pointer">
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
                                <button onClick={() => removeInstallmentRow(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer">
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
                      className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs flex items-center justify-center disabled:opacity-50 cursor-pointer"
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

              {/* Debtors CSV Import Modal */}
              {isDebtorImportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                  <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-2xl max-w-2xl w-full space-y-5 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-blue-600 mb-0.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Batch Import</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Import Debtors Ledger CSV</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Upload a CSV file containing dairy business operators in arrears
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setIsDebtorImportModalOpen(false);
                          setDebtorCsvFile(null);
                          setParsedDebtors([]);
                          setDebtorImportErrors([]);
                          setDebtorImportWarnings([]);
                        }}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Sample CSV Download Helper */}
                    <div className="flex items-center justify-between bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-blue-900">Need the standard column format?</p>
                          <p className="text-[11px] text-blue-700/80">Download our sample template with standard KDB debtor headers.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={downloadDebtorSampleCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-100/50 text-blue-700 text-xs font-bold border border-blue-200 transition-all shadow-2xs shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Sample CSV</span>
                      </button>
                    </div>

                    {/* Drag & Drop File Input */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                        Select CSV File
                      </label>
                      <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group">
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600">
                          {debtorCsvFile ? debtorCsvFile.name : 'Click to browse or drag and drop CSV file here'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1">
                          Supported headers: DBO Name, Premise Name, Permit No, Location, County, Arrears Periods, Outstanding Balance (KES), Debit Note No, Telephone
                        </span>
                        <input
                          type="file"
                          accept=".csv, .txt"
                          onChange={handleDebtorCSVUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Import Mode Selection */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                        Import Mode
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setDebtorImportMode('append')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            debtorImportMode === 'append'
                              ? 'border-blue-500 bg-blue-50/40 text-blue-900 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-black">Append & Merge</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Keep existing entries, updating matching permit/name records
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDebtorImportMode('replace')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            debtorImportMode === 'replace'
                              ? 'border-rose-500 bg-rose-50/40 text-rose-900 shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-xs font-black">Replace Entire Ledger</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Clear all current records and replace with file entries
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Errors Display */}
                    {debtorImportErrors.length > 0 && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>CSV Import Errors:</span>
                        </div>
                        {debtorImportErrors.map((err, idx) => (
                          <div key={idx} className="text-[11px] pl-5">{err}</div>
                        ))}
                      </div>
                    )}

                    {/* Warnings Display */}
                    {debtorImportWarnings.length > 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs space-y-1 max-h-32 overflow-y-auto">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>CSV Warnings ({debtorImportWarnings.length}):</span>
                        </div>
                        {debtorImportWarnings.slice(0, 5).map((w, idx) => (
                          <div key={idx} className="text-[11px] pl-5">{w}</div>
                        ))}
                        {debtorImportWarnings.length > 5 && (
                          <div className="text-[10px] text-amber-600 pl-5 font-semibold">
                            +{debtorImportWarnings.length - 5} more warnings
                          </div>
                        )}
                      </div>
                    )}

                    {/* Parsed Preview Table */}
                    {parsedDebtors.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Parsed Records Preview ({parsedDebtors.length} total)
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Valid format
                          </span>
                        </div>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="p-2.5">DBO Name</th>
                                <th className="p-2.5">Premise</th>
                                <th className="p-2.5">Permit No</th>
                                <th className="p-2.5 text-right">Arrears (KES)</th>
                                <th className="p-2.5">Period</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {parsedDebtors.slice(0, 6).map((d, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-bold text-slate-900">{d.dboName}</td>
                                  <td className="p-2.5 text-slate-500">{d.premiseName}</td>
                                  <td className="p-2.5 font-mono text-[11px]">{d.permitNo}</td>
                                  <td className="p-2.5 text-right font-black text-rose-600">
                                    {d.totalArrears.toLocaleString()}
                                  </td>
                                  <td className="p-2.5 text-slate-500">{d.arrearsPeriod}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {parsedDebtors.length > 6 && (
                          <p className="text-[10px] text-slate-400 text-center font-medium">
                            Showing first 6 of {parsedDebtors.length} records to be imported
                          </p>
                        )}
                      </div>
                    )}

                    {/* Modal Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDebtorImportModalOpen(false);
                          setDebtorCsvFile(null);
                          setParsedDebtors([]);
                        }}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-600 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={parsedDebtors.length === 0 || isImportingDebtors}
                        onClick={handleConfirmDebtorImport}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                      >
                        {isImportingDebtors ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Import {parsedDebtors.length > 0 ? `${parsedDebtors.length} Debtors` : ''}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </>
      )}

      {/* ==================== MODAL: ADD / EDIT RETURN ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800">{editingReturn ? 'Edit Return Details' : 'File Monthly Return'}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {editingReturn ? `Editing record for ${editingReturn.clientName}` : 'Enter return numbers, invoices, and payments'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm uppercase tracking-widest bg-white border border-slate-150 px-3 py-1.5 rounded-xl shadow-sm transition-all"
              >
                Close
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReturn} className="flex-grow overflow-y-auto p-8 space-y-6">
              
              {/* Select Client */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Client / DBO Name</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={editingReturn !== null}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all"
                  required
                >
                  <option value="" disabled>-- Select Licensed Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.clientName} ({c.premiseName})</option>
                  ))}
                </select>
              </div>

              {/* Period / Year Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Filing Period / Month</label>
                  <select
                    value={returnPeriod}
                    onChange={(e) => setReturnPeriod(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    required
                  >
                    {monthsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Filing Year</label>
                  <select
                    value={returnYear}
                    onChange={(e) => setReturnYear(parseInt(e.target.value))}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    required
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Return Date / QTY Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">QTY (Kgs / Litres)</label>
                  <input
                    type="number"
                    value={qty || ''}
                    onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 5000"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    required
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Invoice Amount (KES)</label>
                  <input
                    type="number"
                    value={invoiceAmount || ''}
                    onChange={(e) => setInvoiceAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 10000"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all"
                    required
                    min="0"
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt & Payment Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Paid Amount (KES)</label>
                    <input
                      type="number"
                      value={paymentAmount === 0 ? '0' : (paymentAmount || '')}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                      placeholder="e.g., 8000"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-400 transition-all"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Less CF Adj (KES)</label>
                    <input
                      type="number"
                      value={lessCF === 0 ? '0' : (lessCF || '')}
                      onChange={(e) => setLessCF(parseFloat(e.target.value) || 0)}
                      placeholder="e.g., 500"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-400 transition-all"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Txn Ref / MR No.</label>
                    <input
                      type="text"
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="e.g., MPESA-REF / MR-X"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-400 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Return Filing Date</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-400 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Payment Date (Optional)</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>

                {/* Display Instant Balance */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Estimated Balance Due:</span>
                  <span className={`text-sm font-black ${(invoiceAmount - paymentAmount - lessCF) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrency(invoiceAmount - paymentAmount - lessCF)}
                  </span>
                </div>

                {/* Manual Status Override (Eligible for balance < 100) */}
                {invoiceAmount - paymentAmount - lessCF > 0 && invoiceAmount - paymentAmount - lessCF < 100 && (
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Manual Balance Override (Small Balance &lt; 100 KES)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Override Status</label>
                        <select
                          value={overrideStatus}
                          onChange={(e) => setOverrideStatus(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-300 transition-all cursor-pointer"
                        >
                          <option value="Auto">Auto (Unpaid / Partially Paid)</option>
                          <option value="Fully Paid">Fully Paid</option>
                          <option value="Partially Paid">Partially Paid</option>
                          <option value="Unpaid">Unpaid</option>
                        </select>
                      </div>
                      {overrideStatus !== 'Auto' && (
                        <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Override Reason</label>
                          <input
                            type="text"
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            placeholder="Reason for change..."
                            required
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-slate-300 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Filing Comments / Remarks</label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Remarks on milk volume, payments, or late returns..."
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-slate-400 focus:bg-white transition-all h-24 resize-none"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-150 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-3 rounded-xl border text-slate-500 hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md"
                >
                  {editingReturn ? 'Update Filing' : 'Save Return'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CSV BULK IMPORT FOR RETURNS ==================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800">Returns CSV Bulk Importer</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Import multiple returns across various clients in one single spreadsheet file
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm uppercase tracking-widest bg-white border border-slate-150 px-3 py-1.5 rounded-xl shadow-sm transition-all"
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-8 space-y-6">
              
              {/* Instructions and template download */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-slate-500" /> Bulk Returns Import Instructions
                </h4>
                <ul className="list-disc pl-5 text-slate-600 text-xs space-y-2 leading-relaxed">
                  <li>Download the pre-formatted returns CSV template below.</li>
                  <li>The <strong>clientname</strong> column can match existing registered clients, or <em>automatically register new client stubs</em> into the Clients Registry.</li>
                  <li>Ensure <strong>period</strong> values are written in full (e.g., <em>January</em>, <em>February</em>, etc).</li>
                  <li>Strictly follow the 14-column layout as outlined in the template.</li>
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    onClick={downloadReturnsTemplate}
                    className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm"
                  >
                    <Download size={14} className="text-emerald-500" /> Download Returns Template (.csv)
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer bg-emerald-50/80 text-emerald-900 border border-emerald-200 px-3 py-2 rounded-xl text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={autoProvisionClients}
                      onChange={(e) => setAutoProvisionClients(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Auto-register new clients into Clients Registry</span>
                  </label>
                </div>
              </div>

              {/* File input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Select Completed CSV File</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-3xl p-8 text-center transition-all bg-slate-50/50 relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2 pointer-events-none">
                    <Upload size={32} className="mx-auto text-slate-400" />
                    <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      {csvFile ? csvFile.name : 'Click to select or drag & drop CSV file here'}
                    </p>
                    <p className="text-[10px] text-slate-400">Supported format: standard comma-separated files (.csv)</p>
                  </div>
                </div>
              </div>

              {/* Auto-Discovery Feedback Banner */}
              {newlyProvisionedClients.length > 0 && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {newlyProvisionedClients.length} New Client Profile(s) Auto-Discovered
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Will Synchronize to Clients Registry
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    The following client profiles were not in your registry and will be automatically created upon saving:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                    {newlyProvisionedClients.map(c => (
                      <span key={c.id} className="text-[10px] bg-white border border-emerald-300 text-emerald-900 px-2.5 py-1 rounded-lg font-bold shadow-xs">
                        {c.clientName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Parsing status / Warning messages */}
              {(parsedReturns.length > 0 || importErrors.length > 0) && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Upload Parsing Results</h4>
                    <span className="text-[10px] bg-slate-100 border text-slate-600 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {parsedReturns.length} Valid Returns Found
                    </span>
                  </div>

                  {/* Errors panel */}
                  {importErrors.length > 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl text-xs space-y-1.5">
                      <p className="font-black uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle size={14} /> Validation Errors Found in CSV File
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-1 font-semibold pl-4 list-decimal">
                        {importErrors.map((err, idx) => (
                          <div key={idx}>{err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid returns preview list */}
                  {parsedReturns.length > 0 && (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                            <th className="px-4 py-2.5">Client</th>
                            <th className="px-4 py-2.5">Period</th>
                            <th className="px-4 py-2.5 text-right">Invoiced</th>
                            <th className="px-4 py-2.5 text-right">Paid</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-700">
                          {parsedReturns.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2">{item.clientName}</td>
                              <td className="px-4 py-2 text-slate-500">{item.period} {item.year}</td>
                              <td className="px-4 py-2 text-right text-slate-900">{formatCurrency(item.invoiceAmount)}</td>
                              <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(item.paymentAmount)}</td>
                              <td className="px-4 py-2">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                                  item.paymentStatus === 'Fully Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {item.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/30 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {parsedReturns.length > 0 ? `${parsedReturns.length} returns ready to save` : 'No file loaded'}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-5 py-3 rounded-xl border text-slate-500 hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedReturns.length === 0 || importing}
                  onClick={handleBulkImportSubmit}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  {importing ? 'Saving records...' : `Save ${parsedReturns.length} Returns`}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
