import React, { useState, useEffect, useMemo } from 'react';
import { 
  LicensedClient, 
  ClientReturn, 
  DataValidation, 
  getIndividualValidationsCount, 
  ALL_PREMISE_CATEGORIES, 
  getClientCategory, 
  isSameCategory 
} from '../types';
import { DBService } from '../services/db';
import { resolvePdfUrl } from './lib/supabase';
import { 
  CheckCircle, 
  Calendar, 
  Building2, 
  Store, 
  Layers, 
  Download, 
  Printer, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  ExternalLink, 
  PieChart,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';

interface ValidationsCounterViewProps {
  clients?: LicensedClient[];
  returns?: ClientReturn[];
  validations?: DataValidation[];
  onRefresh?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ALIASES: Record<string, string> = {
  jan: 'January', january: 'January',
  feb: 'February', february: 'February',
  mar: 'March', march: 'March',
  apr: 'April', april: 'April',
  may: 'May',
  jun: 'June', june: 'June',
  jul: 'July', july: 'July',
  aug: 'August', august: 'August',
  sep: 'September', sept: 'September', september: 'September',
  oct: 'October', october: 'October',
  nov: 'November', november: 'November',
  dec: 'December', december: 'December'
};

interface MonthRecordDetail {
  validationId: string;
  dboName: string;
  premiseName: string;
  permitNo: string;
  category: string;
  location: string;
  county: string;
  isBranch: boolean;
  status: string;
  officer: string;
  validatedAt: string;
  month: string;
  year: number;
  pdfPath?: string;
  rawValidation: DataValidation;
}

interface MonthSummary {
  name: string;
  year: number;
  quarter: string;
  individualCount: number;
  formsCount: number;
  uniquePremisesCount: number;
  mainCount: number;
  branchCount: number;
  categoryCounts: Record<string, number>;
  records: MonthRecordDetail[];
}

interface QuarterSummary {
  id: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  title: string;
  periodDescription: string;
  months: MonthSummary[];
  totalIndividualCount: number;
  totalFormsCount: number;
  uniquePremisesCount: number;
  mainCount: number;
  branchCount: number;
  categoryCounts: Record<string, number>;
}

export const ValidationsCounterView: React.FC<ValidationsCounterViewProps> = ({ 
  clients: initialClients = [], 
  validations: initialValidations = [],
  onRefresh 
}) => {
  const [validationsList, setValidationsList] = useState<DataValidation[]>(initialValidations);
  const [clientsList, setClientsList] = useState<LicensedClient[]>(initialClients);
  const [isLoading, setIsLoading] = useState(false);

  // Fiscal Year Selection
  const [selectedFY, setSelectedFY] = useState<string>(() => {
    const d = new Date();
    const curYear = d.getFullYear();
    const curMonth = d.getMonth() + 1;
    return curMonth >= 7 ? `${curYear}/${curYear + 1}` : `${curYear - 1}/${curYear}`;
  });

  // Filters & State
  const [quarterFilter, setQuarterFilter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [facilityFilter, setFacilityFilter] = useState<'all' | 'main' | 'branch'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Approved'>('Approved');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'quarters' | 'matrix'>('quarters');

  // Branch Station Name
  const [selectedBranch, setSelectedBranch] = useState<string>(() => localStorage.getItem('kdb_report_branch') || 'Kericho');

  // PDF Preview Modal
  const [pdfModalUrl, setPdfModalUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Sync with incoming props or fetch directly
  useEffect(() => {
    if (initialValidations && initialValidations.length > 0) {
      setValidationsList(initialValidations);
    } else {
      fetchValidations();
    }
  }, [initialValidations]);

  useEffect(() => {
    if (initialClients && initialClients.length > 0) {
      setClientsList(initialClients);
    } else {
      DBService.getClients().then(res => setClientsList(Array.isArray(res) ? res : []));
    }
  }, [initialClients]);

  // Synchronize branch from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('kdb_report_branch');
      if (stored && stored !== selectedBranch) {
        setSelectedBranch(stored);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [selectedBranch]);

  // Listen for real-time validation updates from DataValidationModule submission
  useEffect(() => {
    const handleUpdate = () => {
      fetchValidations(true);
    };
    window.addEventListener('kdb_validations_updated', handleUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'kdb_validations_last_updated' || e.key === 'kdb_validations_cache') {
        fetchValidations(true);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('kdb_validations_updated', handleUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const fetchValidations = async (forceRefresh: boolean = true) => {
    setIsLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        DBService.getValidations(forceRefresh),
        DBService.getClients()
      ]);
      setValidationsList(Array.isArray(vRes) ? vRes : []);
      setClientsList(Array.isArray(cRes) ? cRes : []);
    } catch (e) {
      console.error('[ValidationsCounterView] Error fetching data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchValidations(true);
    if (onRefresh) onRefresh();
  };

  // Fiscal Year Start & End Years
  const fyStartYear = useMemo(() => {
    const parts = selectedFY.split('/');
    return parseInt(parts[0], 10) || 2025;
  }, [selectedFY]);

  const fyEndYear = useMemo(() => {
    const parts = selectedFY.split('/');
    return parseInt(parts[1], 10) || (fyStartYear + 1);
  }, [selectedFY, fyStartYear]);

  // Generate list of FY options
  const fyOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [
      `${current + 1}/${current + 2}`,
      `${current}/${current + 1}`,
      `${current - 1}/${current}`,
      `${current - 2}/${current - 1}`,
      `${current - 3}/${current - 2}`
    ];
  }, []);

  // Helper to normalize month string to title case (e.g. "july" -> "July")
  const normalizeMonth = (mStr: string): string | null => {
    if (!mStr || typeof mStr !== 'string') return null;
    const clean = mStr.trim().toLowerCase();
    if (MONTH_ALIASES[clean]) return MONTH_ALIASES[clean];
    const match = MONTH_NAMES.find(m => clean.includes(m.toLowerCase()));
    return match || null;
  };

  // Extract individual validated months from a DataValidation record
  const extractValidatedMonths = (v: DataValidation): { month: string; year: number }[] => {
    const results: { month: string; year: number }[] = [];
    const defaultYear = Number(v.year) || (v.validatedAt ? new Date(v.validatedAt).getFullYear() : fyStartYear);

    // 1. Check sales entries (each row is typically an individual month)
    const salesList = Array.isArray((v as any).sales) && (v as any).sales.length > 0
      ? (v as any).sales
      : (Array.isArray(v.rawData?.sales) && v.rawData.sales.length > 0 ? v.rawData.sales : null);

    if (salesList && salesList.length > 0) {
      salesList.forEach((s: any) => {
        if (s && s.month) {
          const normMonth = normalizeMonth(s.month);
          if (normMonth) {
            const sYear = Number(s.year) || defaultYear;
            results.push({ month: normMonth, year: sYear });
          }
        }
      });
      if (results.length > 0) return results;
    }

    // 2. Parse v.period for quarters (Q1, Q2, Q3, Q4, Q3-Q4)
    if (v.period) {
      const clean = String(v.period).replace(/[*_]/g, ' ').replace(/\s+/g, ' ').trim();
      const qRange = clean.match(/Q([1-4])\s*(?:-|to)\s*Q([1-4])/i);
      if (qRange) {
        const qStart = parseInt(qRange[1], 10);
        const qEnd = parseInt(qRange[2], 10);
        const quarterMonthsMap: Record<number, string[]> = {
          1: ['July', 'August', 'September'],
          2: ['October', 'November', 'December'],
          3: ['January', 'February', 'March'],
          4: ['April', 'May', 'June']
        };
        for (let q = Math.min(qStart, qEnd); q <= Math.max(qStart, qEnd); q++) {
          const mList = quarterMonthsMap[q] || [];
          const qYear = (q === 1 || q === 2) ? fyStartYear : fyEndYear;
          mList.forEach(m => results.push({ month: m, year: qYear }));
        }
        if (results.length > 0) return results;
      }

      // Check single quarter like Q1, Q2, Q3, Q4
      const singleQ = clean.match(/\bQ([1-4])\b/i);
      if (singleQ && !clean.toLowerCase().includes('june') && !clean.toLowerCase().includes('may')) {
        const q = parseInt(singleQ[1], 10);
        const quarterMonthsMap: Record<number, string[]> = {
          1: ['July', 'August', 'September'],
          2: ['October', 'November', 'December'],
          3: ['January', 'February', 'March'],
          4: ['April', 'May', 'June']
        };
        const mList = quarterMonthsMap[q] || [];
        const qYear = (q === 1 || q === 2) ? fyStartYear : fyEndYear;
        mList.forEach(m => results.push({ month: m, year: qYear }));
        if (results.length > 0) return results;
      }

      // 3. Sequential month ranges like "March to May 2026", "July 2025 - July 2026", "Jan-26"
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndexesFound: { index: number; monthName: string; position: number }[] = [];

      monthNames.forEach((m, idx) => {
        const regex = new RegExp(`\\b${m}\\b|\\b${m.slice(0, 3)}\\b`, 'gi');
        let match;
        while ((match = regex.exec(clean)) !== null) {
          monthIndexesFound.push({
            index: idx,
            monthName: MONTH_NAMES[idx],
            position: match.index
          });
        }
      });

      monthIndexesFound.sort((a, b) => a.position - b.position);

      if (monthIndexesFound.length >= 2 && (clean.includes('to') || clean.includes('-') || clean.includes('–'))) {
        const first = monthIndexesFound[0];
        const last = monthIndexesFound[monthIndexesFound.length - 1];

        // Check if explicit years are given for start/end
        const yearMatches = [...clean.matchAll(/\b(20\d{2})\b/g)];
        let startY = defaultYear;
        let endY = defaultYear;
        if (yearMatches.length >= 2) {
          startY = parseInt(yearMatches[0][1], 10);
          endY = parseInt(yearMatches[1][1], 10);
        } else if (yearMatches.length === 1) {
          startY = parseInt(yearMatches[0][1], 10);
          endY = startY;
        }

        let currM = first.index;
        let currY = startY;
        const targetM = last.index;
        const targetY = endY;

        let safety = 0;
        while (safety < 36) {
          results.push({ month: MONTH_NAMES[currM], year: currY });
          if (currM === targetM && currY === targetY) break;
          currM++;
          if (currM > 11) {
            currM = 0;
            currY++;
          }
          safety++;
        }
        if (results.length > 0) return results;
      } else if (monthIndexesFound.length > 0) {
        // Individual month occurrences
        monthIndexesFound.forEach(m => {
          results.push({ month: m.monthName, year: defaultYear });
        });
        if (results.length > 0) return results;
      }

      // Single month alias check
      const norm = normalizeMonth(clean);
      if (norm) {
        results.push({ month: norm, year: defaultYear });
        return results;
      }
    }

    // 4. Final fallback to validatedAt timestamp
    if (results.length === 0 && v.validatedAt) {
      const d = new Date(v.validatedAt);
      if (!isNaN(d.getTime())) {
        results.push({ month: MONTH_NAMES[d.getMonth()], year: d.getFullYear() });
      }
    }

    if (results.length === 0) {
      results.push({ month: 'June', year: defaultYear });
    }

    return results;
  };

  // Compile detailed record mapping for the fiscal year
  const compiledData = useMemo(() => {
    // 1. Filter validations by status if requested
    const filteredValidations = validationsList.filter(v => {
      if (statusFilter === 'Approved' && v.status !== 'Approved') return false;
      return true;
    });

    // 2. Build flat list of individual month records
    const allRecords: MonthRecordDetail[] = [];

    filteredValidations.forEach(v => {
      const monthsValidated = extractValidatedMonths(v);
      const isBranch = Boolean(
        (v as any).isBranchFacility ||
        (v as any).isBranch ||
        v.rawData?.isBranchFacility ||
        v.rawData?.isBranch ||
        v.rawData?.validationPremiseMode === 'branch'
      );

      // Find client profile for robust category identification
      const matchingClient = clientsList.find(c => c.id === v.clientId || c.permitNumber === v.permitNo || c.clientName === v.clientName);
      const rawCat = v.category || (v as any).premisecategory || matchingClient?.premiseCategory || 'Milk Bar';
      
      // Match against ALL_PREMISE_CATEGORIES standard
      const standardCategory = ALL_PREMISE_CATEGORIES.find(cat => isSameCategory(rawCat, cat)) || 'Milk Bar';

      monthsValidated.forEach(m => {
        allRecords.push({
          validationId: v.id,
          dboName: v.clientName || (v as any).dbo_name || (v as any).dboName || 'Unknown DBO',
          premiseName: v.premiseName || (v as any).premise_name || 'Unknown Premise',
          permitNo: v.permitNo || (v as any).permit_no || '-',
          category: standardCategory,
          location: v.location || matchingClient?.location || '-',
          county: (v as any).county || matchingClient?.county || selectedBranch,
          isBranch,
          status: v.status || 'Approved',
          officer: v.validatorName || (v as any).complianceOfficer || '-',
          validatedAt: v.validatedAt || (v as any).date || '',
          month: m.month,
          year: m.year,
          pdfPath: v.pdfPath || (v.rawData as any)?.pdf_path || (v.rawData as any)?.pdfPath,
          rawValidation: v
        });
      });
    });

    // 3. Define the 4 quarters of the selected Fiscal Year
    // Q1: July, August, September (fyStartYear)
    // Q2: October, November, December (fyStartYear)
    // Q3: January, February, March (fyEndYear)
    // Q4: April, May, June (fyEndYear)
    const quarterDefs: { id: 'Q1' | 'Q2' | 'Q3' | 'Q4'; title: string; desc: string; months: { name: string; year: number }[] }[] = [
      {
        id: 'Q1',
        title: 'Quarter 1 (July – September)',
        desc: `Months 1, 2 & 3 of Fiscal Year ${selectedFY}`,
        months: [
          { name: 'July', year: fyStartYear },
          { name: 'August', year: fyStartYear },
          { name: 'September', year: fyStartYear }
        ]
      },
      {
        id: 'Q2',
        title: 'Quarter 2 (October – December)',
        desc: `Months 4, 5 & 6 of Fiscal Year ${selectedFY}`,
        months: [
          { name: 'October', year: fyStartYear },
          { name: 'November', year: fyStartYear },
          { name: 'December', year: fyStartYear }
        ]
      },
      {
        id: 'Q3',
        title: 'Quarter 3 (January – March)',
        desc: `Months 7, 8 & 9 of Fiscal Year ${selectedFY}`,
        months: [
          { name: 'January', year: fyEndYear },
          { name: 'February', year: fyEndYear },
          { name: 'March', year: fyEndYear }
        ]
      },
      {
        id: 'Q4',
        title: 'Quarter 4 (April – June)',
        desc: `Months 10, 11 & 12 of Fiscal Year ${selectedFY}`,
        months: [
          { name: 'April', year: fyEndYear },
          { name: 'May', year: fyEndYear },
          { name: 'June', year: fyEndYear }
        ]
      }
    ];

    // 4. Construct quarters with months and summaries
    const quarters: QuarterSummary[] = quarterDefs.map(qDef => {
      const quarterCategoryCounts: Record<string, number> = {};
      ALL_PREMISE_CATEGORIES.forEach(cat => { quarterCategoryCounts[cat] = 0; });
      const quarterFormIds = new Set<string>();
      const quarterPremiseNames = new Set<string>();
      let quarterMainCount = 0;
      let quarterBranchCount = 0;
      let quarterIndividualCount = 0;

      const monthSummaries: MonthSummary[] = qDef.months.map(m => {
        // Filter records belonging to this specific month and year
        let matchingRecords = allRecords.filter(r => 
          r.month.toLowerCase() === m.name.toLowerCase() && 
          Number(r.year) === Number(m.year)
        );

        // Apply UI Filters: Category
        if (categoryFilter !== 'all') {
          matchingRecords = matchingRecords.filter(r => isSameCategory(r.category, categoryFilter));
        }

        // Apply UI Filters: Facility (Main vs Branch)
        if (facilityFilter === 'main') {
          matchingRecords = matchingRecords.filter(r => !r.isBranch);
        } else if (facilityFilter === 'branch') {
          matchingRecords = matchingRecords.filter(r => r.isBranch);
        }

        // Apply UI Filters: Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          matchingRecords = matchingRecords.filter(r => 
            r.dboName.toLowerCase().includes(q) ||
            r.premiseName.toLowerCase().includes(q) ||
            r.permitNo.toLowerCase().includes(q) ||
            r.location.toLowerCase().includes(q) ||
            r.officer.toLowerCase().includes(q)
          );
        }

        // Compute metrics for this individual month
        const categoryCounts: Record<string, number> = {};
        ALL_PREMISE_CATEGORIES.forEach(cat => { categoryCounts[cat] = 0; });
        const monthFormIds = new Set<string>();
        const monthPremiseNames = new Set<string>();
        let mainCount = 0;
        let branchCount = 0;

        matchingRecords.forEach(r => {
          monthFormIds.add(r.validationId);
          monthPremiseNames.add(r.premiseName.toLowerCase().trim());
          if (r.isBranch) branchCount++;
          else mainCount++;

          if (categoryCounts[r.category] !== undefined) {
            categoryCounts[r.category]++;
          } else {
            categoryCounts[r.category] = 1;
          }

          // Also aggregate into quarter
          quarterFormIds.add(r.validationId);
          quarterPremiseNames.add(r.premiseName.toLowerCase().trim());
          if (r.isBranch) quarterBranchCount++;
          else quarterMainCount++;
          quarterCategoryCounts[r.category] = (quarterCategoryCounts[r.category] || 0) + 1;
        });

        quarterIndividualCount += matchingRecords.length;

        return {
          name: m.name,
          year: m.year,
          quarter: qDef.id,
          individualCount: matchingRecords.length,
          formsCount: monthFormIds.size,
          uniquePremisesCount: monthPremiseNames.size,
          mainCount,
          branchCount,
          categoryCounts,
          records: matchingRecords
        };
      });

      return {
        id: qDef.id,
        title: qDef.title,
        periodDescription: qDef.desc,
        months: monthSummaries,
        totalIndividualCount: quarterIndividualCount,
        totalFormsCount: quarterFormIds.size,
        uniquePremisesCount: quarterPremiseNames.size,
        mainCount: quarterMainCount,
        branchCount: quarterBranchCount,
        categoryCounts: quarterCategoryCounts
      };
    });

    // 5. Grand Totals for the entire Fiscal Year
    const fyTotalIndividual = quarters.reduce((sum, q) => sum + q.totalIndividualCount, 0);
    const fyAllFormIds = new Set<string>();
    const fyAllPremises = new Set<string>();
    const fyCategoryTotals: Record<string, number> = {};
    ALL_PREMISE_CATEGORIES.forEach(cat => { fyCategoryTotals[cat] = 0; });
    let fyMainCount = 0;
    let fyBranchCount = 0;

    quarters.forEach(q => {
      q.months.forEach(m => {
        m.records.forEach(r => {
          fyAllFormIds.add(r.validationId);
          fyAllPremises.add(r.premiseName.toLowerCase().trim());
          if (r.isBranch) fyBranchCount++;
          else fyMainCount++;
          fyCategoryTotals[r.category] = (fyCategoryTotals[r.category] || 0) + 1;
        });
      });
    });

    return {
      quarters,
      fyTotalIndividual,
      fyTotalForms: fyAllFormIds.size,
      fyUniquePremises: fyAllPremises.size,
      fyMainCount,
      fyBranchCount,
      fyCategoryTotals
    };
  }, [validationsList, clientsList, statusFilter, selectedFY, fyStartYear, fyEndYear, categoryFilter, facilityFilter, searchQuery, selectedBranch]);

  // Open PDF viewer
  const handleOpenPdf = async (pathOrId?: string) => {
    if (!pathOrId) return;
    setIsLoadingPdf(true);
    setPdfError(null);
    try {
      if (pathOrId.startsWith('data:') || pathOrId.startsWith('http://') || pathOrId.startsWith('https://')) {
        setPdfModalUrl(pathOrId);
        return;
      }
      const resolved = await resolvePdfUrl(pathOrId);
      if (resolved) {
        setPdfModalUrl(resolved);
      } else {
        // Search in local validations cache
        const match = validationsList.find(v => 
          v.pdfPath === pathOrId || 
          v.id === pathOrId || 
          (v.rawData as any)?.pdf_path === pathOrId
        );
        const inline = match?.pdfPath || (match?.rawData as any)?.pdf || (match?.rawData as any)?.pdfData;
        if (inline) {
          setPdfModalUrl(inline);
        } else {
          setPdfError(`Could not find document for "${pathOrId}".`);
        }
      }
    } catch (err) {
      console.error('Error opening PDF:', err);
      setPdfError('Failed to load PDF preview.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Toggle month accordion
  const toggleMonthExpansion = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Fiscal Year',
      'Quarter',
      'Month',
      'Year',
      'Individual Validations Count',
      'Validation Forms Count',
      'Unique Premises',
      'HQ / Main Premises',
      'Branch Premises',
      ...ALL_PREMISE_CATEGORIES
    ];

    const rows: string[][] = [];

    compiledData.quarters.forEach(q => {
      q.months.forEach(m => {
        const catValues = ALL_PREMISE_CATEGORIES.map(cat => m.categoryCounts[cat] || 0);
        rows.push([
          `"${selectedFY}"`,
          `"${q.id}"`,
          `"${m.name}"`,
          `"${m.year}"`,
          String(m.individualCount),
          String(m.formsCount),
          String(m.uniquePremisesCount),
          String(m.mainCount),
          String(m.branchCount),
          ...catValues.map(String)
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `KDB_Validations_Counter_${selectedFY.replace('/', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered quarters based on quarter selector
  const displayedQuarters = useMemo(() => {
    if (quarterFilter === 'all') return compiledData.quarters;
    return compiledData.quarters.filter(q => q.id === quarterFilter);
  }, [compiledData.quarters, quarterFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. TOP HEADER & CONTROLS BAR (Hidden on Print) */}
      <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-xl space-y-6 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-widest rounded-full">
                Validations Engine
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                • {selectedBranch} Station
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-purple-600" />
              Validations Counter
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
              Deterministic tracking of submitted validation forms and individual months broken down into quarterly fiscal milestones.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Validations"
              id="refresh-validations-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              id="export-validations-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              id="print-validations-report-btn"
            >
              <Printer className="w-3.5 h-3.5 text-purple-400" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Fiscal Year */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Fiscal Year</label>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
              id="fy-selector"
            >
              {fyOptions.map(fy => (
                <option key={fy} value={fy}>FY {fy}</option>
              ))}
            </select>
          </div>

          {/* Quarter Filter */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Quarter Scope</label>
            <select
              value={quarterFilter}
              onChange={(e) => setQuarterFilter(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
              id="quarter-filter-selector"
            >
              <option value="all">All Quarters (Q1 – Q4)</option>
              <option value="Q1">Q1 (July – Sept)</option>
              <option value="Q2">Q2 (Oct – Dec)</option>
              <option value="Q3">Q3 (Jan – Mar)</option>
              <option value="Q4">Q4 (Apr – June)</option>
            </select>
          </div>

          {/* Premise Category */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Premise Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
              id="category-filter-selector"
            >
              <option value="all">All Categories</option>
              {ALL_PREMISE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Facility Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Facility Type</label>
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
              id="facility-filter-selector"
            >
              <option value="all">All Facilities</option>
              <option value="main">Main / HQ Only</option>
              <option value="branch">Branches Only</option>
            </select>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Search DBO / Premise</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search permit, DBO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 outline-none transition-all"
                id="search-input"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('quarters')}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'quarters'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quarterly Breakdown
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'matrix'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Category Matrix Table
          </button>
        </div>
      </div>

      {/* 2. ANNUAL FISCAL YEAR EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Individual Validations */}
        <div className="p-6 bg-purple-50/80 rounded-3xl border border-purple-100 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Validations Counter</span>
              <span className="px-2 py-0.5 bg-purple-200/70 text-purple-900 text-[9px] font-black uppercase rounded-full">FY {selectedFY}</span>
            </div>
            <div className="mt-3">
              <span className="text-3xl sm:text-4xl font-black font-mono text-purple-900 block tracking-tight">
                {compiledData.fyTotalIndividual}
              </span>
              <span className="text-xs font-bold text-purple-700 mt-1 block">
                Individual Month Validations
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-200/50 flex items-center justify-between text-[10px] font-bold text-purple-700">
            <span>Quarterly Breakdown:</span>
            <span>Q1: {compiledData.quarters[0].totalIndividualCount} | Q2: {compiledData.quarters[1].totalIndividualCount} | Q3: {compiledData.quarters[2].totalIndividualCount} | Q4: {compiledData.quarters[3].totalIndividualCount}</span>
          </div>
        </div>

        {/* Total Forms */}
        <div className="p-6 bg-slate-900 text-white rounded-3xl flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Unique Submissions</span>
              <FileText className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-3">
              <span className="text-3xl sm:text-4xl font-black font-mono text-white block tracking-tight">
                {compiledData.fyTotalForms}
              </span>
              <span className="text-xs font-bold text-slate-300 mt-1 block">
                Validation Forms Submitted
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 font-semibold flex items-center justify-between">
            <span>Avg. Months/Form:</span>
            <span className="font-mono font-bold text-white">
              {compiledData.fyTotalForms > 0 ? (compiledData.fyTotalIndividual / compiledData.fyTotalForms).toFixed(1) : '0.0'}
            </span>
          </div>
        </div>

        {/* Distinct Premises Validated */}
        <div className="p-6 bg-emerald-50/80 rounded-3xl border border-emerald-100 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Premises Coverage</span>
              <Store className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-900 block tracking-tight">
                {compiledData.fyUniquePremises}
              </span>
              <span className="text-xs font-bold text-emerald-700 mt-1 block">
                Unique Premises Validated
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-200/50 text-[10px] text-emerald-700 font-bold flex items-center justify-between">
            <span>Total Registered DBOs:</span>
            <span className="font-mono">{clientsList.length} premises</span>
          </div>
        </div>

        {/* Facility Distribution (Main vs Branch) */}
        <div className="p-6 bg-blue-50/80 rounded-3xl border border-blue-100 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Facility Mix</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-black font-mono text-blue-900 block">{compiledData.fyMainCount}</span>
                <span className="text-[10px] font-bold text-blue-700">HQ / Main</span>
              </div>
              <span className="text-slate-300 font-light text-xl">/</span>
              <div>
                <span className="text-2xl font-black font-mono text-blue-800 block">{compiledData.fyBranchCount}</span>
                <span className="text-[10px] font-bold text-blue-700">Branches</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-200/50 text-[10px] text-blue-700 font-bold flex items-center justify-between">
            <span>Branch Ratio:</span>
            <span className="font-mono">
              {compiledData.fyTotalIndividual > 0 ? `${Math.round((compiledData.fyBranchCount / compiledData.fyTotalIndividual) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

      </div>

      {/* 3. MAIN CONTENT TABS */}
      {activeTab === 'quarters' && (
        <div className="space-y-10">
          
          {displayedQuarters.map(quarter => (
            <div 
              key={quarter.id}
              className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden print:shadow-none print:border-none space-y-6 p-6 sm:p-8"
            >
              
              {/* Quarter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
                      {quarter.id}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {quarter.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 text-xs font-semibold mt-1">
                    {quarter.periodDescription}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-purple-50 rounded-2xl border border-purple-100 text-right">
                    <span className="text-[9px] font-black text-purple-700 uppercase tracking-wider block">Quarter Subtotal</span>
                    <span className="text-lg font-black font-mono text-purple-900">
                      {quarter.totalIndividualCount} <span className="text-xs font-bold text-purple-600">Validations</span>
                    </span>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-right">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Unique Forms</span>
                    <span className="text-lg font-black font-mono text-slate-800">
                      {quarter.totalFormsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Individual Months in the Quarter */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {quarter.months.map(month => {
                  const monthKey = `${month.year}-${month.name}`;
                  const isExpanded = !!expandedMonths[monthKey];

                  return (
                    <div 
                      key={monthKey}
                      className="bg-slate-50/70 hover:bg-slate-50 rounded-3xl p-6 border border-slate-200/60 transition-all flex flex-col justify-between space-y-5"
                    >
                      {/* Month Header */}
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Individual Month</span>
                            <h4 className="text-lg font-black text-slate-900 tracking-tight">
                              {month.name} <span className="text-slate-400 font-bold text-sm">{month.year}</span>
                            </h4>
                          </div>
                          <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200/60">
                            <Calendar className="w-4 h-4 text-purple-600" />
                          </div>
                        </div>

                        {/* Month Validations Counter - PRIMARY METRIC */}
                        <div className="mt-4 p-4 bg-white rounded-2xl border border-purple-100 shadow-xs">
                          <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">Validations Counter</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-3xl font-black font-mono text-purple-900 tracking-tight">
                              {month.individualCount}
                            </span>
                            <span className="text-xs font-bold text-purple-600">
                              individual month(s)
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-50 text-[10px] font-medium text-slate-500">
                            <span>Forms: <strong className="text-slate-800 font-bold">{month.formsCount}</strong></span>
                            <span>Premises: <strong className="text-slate-800 font-bold">{month.uniquePremisesCount}</strong></span>
                            <span>Main/Br: <strong className="text-slate-800 font-bold">{month.mainCount}/{month.branchCount}</strong></span>
                          </div>
                        </div>

                        {/* Category Mini Distribution */}
                        <div className="mt-4 space-y-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Category Breakdown</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {ALL_PREMISE_CATEGORIES.map(cat => {
                              const count = month.categoryCounts[cat] || 0;
                              return (
                                <div 
                                  key={cat} 
                                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-between ${
                                    count > 0 
                                      ? 'bg-purple-50 text-purple-900 border border-purple-100' 
                                      : 'bg-white/60 text-slate-400 border border-slate-100'
                                  }`}
                                >
                                  <span className="truncate pr-1">{cat}</span>
                                  <span className="font-mono">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Drill-down Toggle */}
                      <div>
                        <button
                          onClick={() => toggleMonthExpansion(monthKey)}
                          className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 transition-all flex items-center justify-between cursor-pointer active:scale-98"
                        >
                          <span className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-purple-600" />
                            <span>View Records ({month.records.length})</span>
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>

                      {/* Expandable Records List */}
                      {isExpanded && (
                        <div className="pt-2 space-y-2 border-t border-slate-200/60 max-h-72 overflow-y-auto pr-1">
                          {month.records.length === 0 ? (
                            <p className="text-center py-4 text-xs text-slate-400 italic">No validated submissions for this month.</p>
                          ) : (
                            month.records.map((r, idx) => (
                              <div 
                                key={`${r.validationId}-${idx}`}
                                className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-1.5 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-bold text-slate-900 truncate" title={r.premiseName}>
                                    {r.premiseName}
                                  </div>
                                  {r.isBranch && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[8px] font-black uppercase rounded">Branch</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate" title={r.dboName}>
                                  DBO: <span className="font-medium text-slate-700">{r.dboName}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                  <span className="font-mono text-purple-700 font-bold">{r.permitNo}</span>
                                  <span className="truncate">{r.category}</span>
                                </div>
                                {r.pdfPath && (
                                  <button
                                    onClick={() => handleOpenPdf(r.pdfPath)}
                                    className="mt-1 w-full py-1 bg-slate-50 hover:bg-purple-50 text-purple-700 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Preview PDF</span>
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* Quarter Footnote / Subtotal Bar */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-purple-600 text-white font-black text-[10px] uppercase rounded-lg">{quarter.id} Summary</span>
                  <span className="text-slate-300 font-medium">Aggregate of 3 individual fiscal months</span>
                </div>
                <div className="flex items-center gap-6 font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Total Validations</span>
                    <strong className="text-purple-300 text-sm font-bold">{quarter.totalIndividualCount} Individual Months</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Submissions</span>
                    <strong className="text-white text-sm font-bold">{quarter.totalFormsCount} Forms</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Premises</span>
                    <strong className="text-emerald-400 text-sm font-bold">{quarter.uniquePremisesCount} DBOs</strong>
                  </div>
                </div>
              </div>

            </div>
          ))}

        </div>
      )}

      {/* 4. COMPREHENSIVE CATEGORY MATRIX TABLE */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Comprehensive Validations Matrix
              </h3>
              <p className="text-slate-500 text-xs font-semibold mt-1">
                Cross-tabulation of individual validations per premise category across all 12 fiscal months grouped into 4 quarters.
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
              FY {selectedFY} Full Calendar
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 border-r border-slate-800 sticky left-0 bg-slate-900 z-10">Premise Category</th>
                  
                  {/* Q1 Header */}
                  <th colSpan={4} className="p-3 text-center border-r border-slate-800 bg-purple-950/80">
                    Quarter 1 (July – Sept)
                  </th>

                  {/* Q2 Header */}
                  <th colSpan={4} className="p-3 text-center border-r border-slate-800 bg-slate-900">
                    Quarter 2 (Oct – Dec)
                  </th>

                  {/* Q3 Header */}
                  <th colSpan={4} className="p-3 text-center border-r border-slate-800 bg-purple-950/80">
                    Quarter 3 (Jan – Mar)
                  </th>

                  {/* Q4 Header */}
                  <th colSpan={4} className="p-3 text-center border-r border-slate-800 bg-slate-900">
                    Quarter 4 (Apr – June)
                  </th>

                  <th className="p-3.5 text-center bg-purple-900 font-black">FY TOTAL</th>
                </tr>

                <tr className="bg-slate-100 text-slate-700 font-bold text-[9px] uppercase border-b border-slate-200">
                  <th className="p-2.5 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">Facility Type</th>
                  
                  {/* Q1 Months */}
                  <th className="p-2 text-center">Jul</th>
                  <th className="p-2 text-center">Aug</th>
                  <th className="p-2 text-center">Sep</th>
                  <th className="p-2 text-center bg-purple-100/70 text-purple-900 font-black border-r border-slate-200">Q1 Tot</th>

                  {/* Q2 Months */}
                  <th className="p-2 text-center">Oct</th>
                  <th className="p-2 text-center">Nov</th>
                  <th className="p-2 text-center">Dec</th>
                  <th className="p-2 text-center bg-slate-200/70 text-slate-900 font-black border-r border-slate-200">Q2 Tot</th>

                  {/* Q3 Months */}
                  <th className="p-2 text-center">Jan</th>
                  <th className="p-2 text-center">Feb</th>
                  <th className="p-2 text-center">Mar</th>
                  <th className="p-2 text-center bg-purple-100/70 text-purple-900 font-black border-r border-slate-200">Q3 Tot</th>

                  {/* Q4 Months */}
                  <th className="p-2 text-center">Apr</th>
                  <th className="p-2 text-center">May</th>
                  <th className="p-2 text-center">Jun</th>
                  <th className="p-2 text-center bg-slate-200/70 text-slate-900 font-black border-r border-slate-200">Q4 Tot</th>

                  <th className="p-2 text-center bg-purple-200/70 text-purple-950 font-black">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {ALL_PREMISE_CATEGORIES.map(cat => {
                  const q1 = compiledData.quarters[0];
                  const q2 = compiledData.quarters[1];
                  const q3 = compiledData.quarters[2];
                  const q4 = compiledData.quarters[3];

                  const q1_m1 = q1.months[0]?.categoryCounts[cat] || 0;
                  const q1_m2 = q1.months[1]?.categoryCounts[cat] || 0;
                  const q1_m3 = q1.months[2]?.categoryCounts[cat] || 0;
                  const q1_tot = q1.categoryCounts[cat] || 0;

                  const q2_m1 = q2.months[0]?.categoryCounts[cat] || 0;
                  const q2_m2 = q2.months[1]?.categoryCounts[cat] || 0;
                  const q2_m3 = q2.months[2]?.categoryCounts[cat] || 0;
                  const q2_tot = q2.categoryCounts[cat] || 0;

                  const q3_m1 = q3.months[0]?.categoryCounts[cat] || 0;
                  const q3_m2 = q3.months[1]?.categoryCounts[cat] || 0;
                  const q3_m3 = q3.months[2]?.categoryCounts[cat] || 0;
                  const q3_tot = q3.categoryCounts[cat] || 0;

                  const q4_m1 = q4.months[0]?.categoryCounts[cat] || 0;
                  const q4_m2 = q4.months[1]?.categoryCounts[cat] || 0;
                  const q4_m3 = q4.months[2]?.categoryCounts[cat] || 0;
                  const q4_tot = q4.categoryCounts[cat] || 0;

                  const catFYTotal = q1_tot + q2_tot + q3_tot + q4_tot;

                  return (
                    <tr key={cat} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10 whitespace-nowrap">
                        {cat}
                      </td>

                      {/* Q1 */}
                      <td className="p-2 text-center font-mono">{q1_m1}</td>
                      <td className="p-2 text-center font-mono">{q1_m2}</td>
                      <td className="p-2 text-center font-mono">{q1_m3}</td>
                      <td className="p-2 text-center font-mono font-bold bg-purple-50/60 text-purple-900 border-r border-slate-200">{q1_tot}</td>

                      {/* Q2 */}
                      <td className="p-2 text-center font-mono">{q2_m1}</td>
                      <td className="p-2 text-center font-mono">{q2_m2}</td>
                      <td className="p-2 text-center font-mono">{q2_m3}</td>
                      <td className="p-2 text-center font-mono font-bold bg-slate-100/60 text-slate-900 border-r border-slate-200">{q2_tot}</td>

                      {/* Q3 */}
                      <td className="p-2 text-center font-mono">{q3_m1}</td>
                      <td className="p-2 text-center font-mono">{q3_m2}</td>
                      <td className="p-2 text-center font-mono">{q3_m3}</td>
                      <td className="p-2 text-center font-mono font-bold bg-purple-50/60 text-purple-900 border-r border-slate-200">{q3_tot}</td>

                      {/* Q4 */}
                      <td className="p-2 text-center font-mono">{q4_m1}</td>
                      <td className="p-2 text-center font-mono">{q4_m2}</td>
                      <td className="p-2 text-center font-mono">{q4_m3}</td>
                      <td className="p-2 text-center font-mono font-bold bg-slate-100/60 text-slate-900 border-r border-slate-200">{q4_tot}</td>

                      <td className="p-2.5 text-center font-mono font-black bg-purple-100/60 text-purple-950">{catFYTotal}</td>
                    </tr>
                  );
                })}

                {/* TOTAL ROW */}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-950">
                  <td className="p-3.5 uppercase tracking-wider text-[10px] border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                    TOTAL VALIDATIONS
                  </td>

                  {/* Q1 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[0]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[1]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[2]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono text-purple-300 font-bold bg-slate-800 border-r border-slate-700">
                    {compiledData.quarters[0].totalIndividualCount}
                  </td>

                  {/* Q2 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[0]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[1]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[2]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono text-purple-300 font-bold bg-slate-800 border-r border-slate-700">
                    {compiledData.quarters[1].totalIndividualCount}
                  </td>

                  {/* Q3 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[0]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[1]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[2]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono text-purple-300 font-bold bg-slate-800 border-r border-slate-700">
                    {compiledData.quarters[2].totalIndividualCount}
                  </td>

                  {/* Q4 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[0]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[1]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[2]?.individualCount || 0}</td>
                  <td className="p-2 text-center font-mono text-purple-300 font-bold bg-slate-800 border-r border-slate-700">
                    {compiledData.quarters[3].totalIndividualCount}
                  </td>

                  <td className="p-3 text-center font-mono font-black text-white bg-purple-700 text-sm">
                    {compiledData.fyTotalIndividual}
                  </td>
                </tr>

                {/* UNIQUE FORMS ROW */}
                <tr className="bg-slate-800 text-slate-300 font-bold border-t border-slate-700 text-[10px]">
                  <td className="p-3 uppercase tracking-wider border-r border-slate-700 sticky left-0 bg-slate-800 z-10">
                    UNIQUE FORMS SUBMITTED
                  </td>

                  {/* Q1 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[0]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[1]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[0].months[2]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono text-slate-100 font-bold bg-slate-700 border-r border-slate-600">
                    {compiledData.quarters[0].totalFormsCount}
                  </td>

                  {/* Q2 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[0]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[1]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[1].months[2]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono text-slate-100 font-bold bg-slate-700 border-r border-slate-600">
                    {compiledData.quarters[1].totalFormsCount}
                  </td>

                  {/* Q3 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[0]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[1]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[2].months[2]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono text-slate-100 font-bold bg-slate-700 border-r border-slate-600">
                    {compiledData.quarters[2].totalFormsCount}
                  </td>

                  {/* Q4 */}
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[0]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[1]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono">{compiledData.quarters[3].months[2]?.formsCount || 0}</td>
                  <td className="p-2 text-center font-mono text-slate-100 font-bold bg-slate-700 border-r border-slate-600">
                    {compiledData.quarters[3].totalFormsCount}
                  </td>

                  <td className="p-2 text-center font-mono font-black text-white bg-slate-700">
                    {compiledData.fyTotalForms}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PDF PREVIEW MODAL */}
      {pdfModalUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-sm">Validation Form Document Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfModalUrl}
                  download="Validation_Form.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold transition-all text-white flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPdfModalUrl(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={pdfModalUrl}
                className="w-full h-full rounded-2xl border border-slate-200"
                title="Validation PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF Loading / Error Toasts */}
      {isLoadingPdf && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 text-xs font-bold">
          <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
          <span>Resolving PDF preview...</span>
        </div>
      )}

      {pdfError && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-4 py-3 rounded-2xl shadow-xl z-50 flex items-center justify-between gap-3 text-xs font-bold">
          <span>{pdfError}</span>
          <button onClick={() => setPdfError(null)} className="cursor-pointer">✕</button>
        </div>
      )}

    </div>
  );
};
