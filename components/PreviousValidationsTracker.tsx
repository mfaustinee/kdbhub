import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Info, 
  FileText, 
  Edit2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { supabase, viewPdf as sharedViewPdf } from './lib/supabase';
import { DBService } from '../services/db';

// Standalone Helper Functions
export const toSentenceCase = (str?: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function getNextValidationMonth(latestPeriod?: string): string | null {
  if (!latestPeriod) return null;
  const clean = latestPeriod.trim();
  if (!clean) return null;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthAbbrs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Extract year if present
  const yearMatch = clean.match(/\b(20\d\d)\b/);
  let year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
  if (isNaN(year)) {
    year = new Date().getFullYear();
  }

  // Find month index
  let monthIndex = -1;
  const lower = clean.toLowerCase();
  for (let i = 0; i < 12; i++) {
    const mName = months[i].toLowerCase();
    const mAbbr = monthAbbrs[i];
    const regex = new RegExp(`\\b(${mName}|${mAbbr})\\b`, 'i');
    if (regex.test(clean) || lower.includes(mName)) {
      monthIndex = i;
      break;
    }
  }

  if (monthIndex === -1) {
    const tokens = clean.split(/[\s_\-/,]+/);
    for (const tok of tokens) {
      const tNorm = tok.toLowerCase().trim();
      const idx = months.findIndex(m => m.toLowerCase() === tNorm || m.toLowerCase().startsWith(tNorm));
      if (idx !== -1 && tNorm.length >= 3) {
        monthIndex = idx;
        break;
      }
    }
  }

  if (monthIndex !== -1) {
    let nextMonthIndex = monthIndex + 1;
    let nextYear = isNaN(year) ? new Date().getFullYear() : year;
    if (nextMonthIndex > 11) {
      nextMonthIndex = 0;
      nextYear += 1;
    }
    return `${months[nextMonthIndex]} ${nextYear}`;
  }

  return null;
}

// Types
export interface FormDataState {
  dboName: string;
  premiseName: string;
  permitNo: string;
  category: string;
  contacts: string;
  county: string;
  location: string;
  expiryDate: string;
  validationPeriod: string;
  [key: string]: any;
}

interface PreviousValidationsTrackerProps {
  formData: FormDataState;
  setFormData: React.Dispatch<React.SetStateAction<FormDataState>>;
  setIsAmendment?: (val: boolean) => void;
  setStep?: (step: number) => void;
  setIsValidationPeriodEdited?: (val: boolean) => void;
}

export const PreviousValidationsTracker: React.FC<PreviousValidationsTrackerProps> = ({
  formData,
  setFormData,
  setIsAmendment,
  setStep,
  setIsValidationPeriodEdited,
}) => {
  // -------------------------------------------------------------
  // 1. STATES
  // -------------------------------------------------------------
  const [lastCollections, setLastCollections] = useState<{ 
    month: string; 
    year: string; 
    date: string; 
    fullPeriod: string; 
    displayString: string; 
    matchedPremise?: string; 
    pdfPath?: string; 
    rawData?: any; 
  }[]>([]);
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [lastDboRecords, setLastDboRecords] = useState<any[]>([]);
  const [isCheckingDbo, setIsCheckingDbo] = useState(false);
  const [dboError, setDboError] = useState<string | null>(null);

  const [hasAutofilled, setHasAutofilled] = useState(false);

  // -------------------------------------------------------------
  // 2. SECURE PDF VIEWER
  // -------------------------------------------------------------
  const viewPdf = async (path: string) => {
    if (!path) return;
    await sharedViewPdf(path);
  };

  // -------------------------------------------------------------
  // 3. FETCH PREMISE VALIDATION & PDF HISTORY
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      if (hasAutofilled) {
        if (isMounted) setIsCheckingHistory(false);
        return;
      }
      const rawSearch = (formData.premiseName || '').trim();
      if (!rawSearch || rawSearch.length < 2) {
        if (isMounted) {
          setLastCollections([]);
          setHistoryError(null);
          setIsCheckingHistory(false);
        }
        return;
      }

      if (isMounted) {
        setIsCheckingHistory(true);
        setHistoryError(null);
      }

      try {
        const cleanSearch = rawSearch.replace(/["']/g, '').trim().toLowerCase();
        const allExtractedMonths: { period: string; pdfPath?: string; score: number; rawData?: any; matchedPremise?: string }[] = [];

        // 1. Check local cache / validations first for instant rendering
        try {
          const localList = await DBService.getValidations();
          if (Array.isArray(localList)) {
            localList.forEach(v => {
              const pName = (v.premiseName || '').toLowerCase();
              if (pName.includes(cleanSearch) || cleanSearch.includes(pName)) {
                const period = v.period ? (v.year && !v.period.includes(String(v.year)) ? `${v.period} ${v.year}` : v.period) : '';
                if (period) {
                  allExtractedMonths.push({
                    period,
                    pdfPath: v.pdfPath,
                    score: v.validatedAt ? new Date(v.validatedAt).getTime() : 0,
                    rawData: v.rawData || v,
                    matchedPremise: v.premiseName
                  });
                }
              }
            });
          }
        } catch (localErr) {
          console.warn('[PreviousValidationsTracker] Local cache check:', localErr);
        }

        // 2. Query Supabase kdb_validations
        try {
          if (supabase) {
            const { data, error } = await supabase
              .from('kdb_validations')
              .select('validation_period, date, premise_name, raw_data, pdf_path')
              .ilike('premise_name', `%${cleanSearch}%`)
              .order('date', { ascending: false })
              .limit(25);

            if (!error && data && data.length > 0) {
              data.forEach(item => {
                if (item.validation_period) {
                  allExtractedMonths.push({
                    period: item.validation_period,
                    pdfPath: item.pdf_path,
                    score: item.date ? new Date(item.date).getTime() : 0,
                    rawData: typeof item.raw_data === 'string' ? (() => { try { return JSON.parse(item.raw_data); } catch { return {}; } })() : item.raw_data,
                    matchedPremise: item.premise_name
                  });
                }
              });
            }
          }
        } catch (sbErr) {
          console.warn('[PreviousValidationsTracker] Supabase history fetch:', sbErr);
        }

        if (allExtractedMonths.length > 0) {
          // Deduplicate by period
          const deduplicated: Record<string, any> = {};
          allExtractedMonths.forEach(m => {
            const key = m.period.toLowerCase().trim();
            if (!deduplicated[key] || (!deduplicated[key].pdfPath && m.pdfPath) || m.score > deduplicated[key].score) {
              deduplicated[key] = m;
            }
          });

          const sortedList = Object.values(deduplicated).sort((a: any, b: any) => b.score - a.score);
          const top3 = sortedList.slice(0, 3);

          const history = top3.map((m: any) => ({
            month: '',
            year: '',
            date: '',
            fullPeriod: m.period,
            displayString: m.period,
            matchedPremise: m.matchedPremise || rawSearch,
            pdfPath: m.pdfPath,
            rawData: m.rawData
          }));

          if (isMounted) setLastCollections(history);
        } else {
          if (isMounted) setLastCollections([]);
        }
      } catch (err: any) {
        console.error('Error fetching history:', err);
        if (isMounted) setHistoryError(err.message || 'Failed to fetch history');
      } finally {
        if (isMounted) setIsCheckingHistory(false);
      }
    };

    const timer = setTimeout(fetchHistory, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.premiseName, hasAutofilled]);

  // -------------------------------------------------------------
  // 4. FETCH DBO SEARCH HISTORY
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const fetchDboHistory = async () => {
      if (hasAutofilled) {
        if (isMounted) setIsCheckingDbo(false);
        return;
      }
      const rawSearch = (formData.dboName || '').trim();
      if (!rawSearch || rawSearch.length < 2) {
        if (isMounted) {
          setLastDboRecords([]);
          setDboError(null);
          setIsCheckingDbo(false);
        }
        return;
      }

      if (isMounted) {
        setIsCheckingDbo(true);
        setDboError(null);
      }

      try {
        const cleanSearch = rawSearch.replace(/["']/g, '').trim().toLowerCase();
        const collectedDboRecords: any[] = [];

        // 1. Check local DBService validations first
        try {
          const localList = await DBService.getValidations();
          if (Array.isArray(localList)) {
            localList.forEach(v => {
              const cName = (v.clientName || '').toLowerCase();
              if (cName.includes(cleanSearch) || cleanSearch.includes(cName)) {
                collectedDboRecords.push({
                  dbo_name: v.clientName,
                  premise_name: v.premiseName,
                  category: v.category,
                  permit_no: v.permitNo,
                  location: v.location,
                  county: (v.rawData as any)?.county || 'Kericho',
                  raw_data: v.rawData || v,
                  date: v.validatedAt || ''
                });
              }
            });
          }
        } catch (lErr) {
          console.warn('[PreviousValidationsTracker] Local DBO check:', lErr);
        }

        // 2. Query Supabase kdb_validations
        try {
          if (supabase) {
            const { data, error } = await supabase
              .from('kdb_validations')
              .select('dbo_name, premise_name, category, permit_no, location, county, raw_data, date')
              .ilike('dbo_name', `%${cleanSearch}%`)
              .order('date', { ascending: false })
              .limit(15);

            if (!error && data && data.length > 0) {
              data.forEach(item => {
                collectedDboRecords.push({
                  ...item,
                  raw_data: typeof item.raw_data === 'string' ? (() => { try { return JSON.parse(item.raw_data); } catch { return {}; } })() : item.raw_data
                });
              });
            }
          }
        } catch (sbErr) {
          console.warn('[PreviousValidationsTracker] Supabase DBO fetch:', sbErr);
        }

        if (collectedDboRecords.length > 0) {
          const uniqueMap: Record<string, any> = {};
          collectedDboRecords.forEach(item => {
            const key = `${item.premise_name || ''}-${item.permit_no || ''}`.toLowerCase().trim();
            if (!uniqueMap[key]) {
              uniqueMap[key] = {
                ...item,
                county: toSentenceCase(item.county || 'Kericho')
              };
            }
          });
          if (isMounted) setLastDboRecords(Object.values(uniqueMap).slice(0, 8));
        } else {
          if (isMounted) setLastDboRecords([]);
        }
      } catch (err: any) {
        console.error('Error fetching DBO history:', err);
        if (isMounted) setDboError(err.message || 'Failed to fetch DBO history');
      } finally {
        if (isMounted) setIsCheckingDbo(false);
      }
    };

    const timer = setTimeout(fetchDboHistory, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.dboName, hasAutofilled]);

  // -------------------------------------------------------------
  // 5. AUTOFILL & AMENDMENT HANDLERS
  // -------------------------------------------------------------
  const handleDboAutofill = (record: any) => {
    const raw = record.raw_data || {};
    const permitNo = raw.permitNo || record.permit_no || '';
    setFormData(prev => ({
      ...prev,
      dboName: record.dbo_name || prev.dboName,
      permitNo: permitNo || prev.permitNo,
      premiseName: raw.premiseName || record.premise_name || prev.premiseName,
      category: raw.category || record.category || prev.category,
      contacts: raw.contacts || prev.contacts,
      county: toSentenceCase(raw.county || record.county || prev.county || 'Kericho'),
      location: raw.location || record.location || prev.location,
      expiryDate: raw.expiryDate || prev.expiryDate || '',
      validationPeriod: raw.validationPeriod || prev.validationPeriod || '',
    }));
    
    if (setIsValidationPeriodEdited) setIsValidationPeriodEdited(true);
    setHasAutofilled(true);
    setLastDboRecords([]);
    setIsCheckingDbo(false);
    setIsCheckingHistory(false);
  };

  const handleRecallSubmission = (rawData: any) => {
    if (rawData) {
      setFormData(prev => ({
        ...prev,
        ...rawData
      }));
      if (setIsAmendment) setIsAmendment(true);
      if (setIsValidationPeriodEdited) setIsValidationPeriodEdited(true);
      if (setStep) setStep(1);
    }
  };

  // -------------------------------------------------------------
  // 6. UI RENDER
  // -------------------------------------------------------------
  return (
    <div className="space-y-4 w-full">
      {/* ======================================================== */}
      {/* SECTION A: UNDER "NAME OF DBO"                           */}
      {/* ======================================================== */}
      <div className="dbo-validations-container">
        {isCheckingDbo && (
          <p className="text-[10px] text-blue-500 font-medium mt-1 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking previous validations...
          </p>
        )}

        <AnimatePresence>
          {lastDboRecords.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 space-y-2 overflow-hidden"
            >
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Previous Validations Found: Click to Autofill
              </p>
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {lastDboRecords.map((record, index) => {
                  const premise = record.premise_name || 'Unknown Premise';
                  const category = record.category || 'Unknown';
                  const location = record.location || 'Unknown';
                  const pNo = record.permit_no || 'N/A';
                  
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleDboAutofill(record)}
                      className="w-full text-left p-2 rounded-lg bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-[11px] group flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-gray-800 group-hover:text-emerald-900 truncate">
                          {premise}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded-md">
                          {category}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 flex justify-between items-center mt-0.5">
                        <span>Permit: {pNo} | Loc: {location}</span>
                        <span className="text-[9px] text-gray-400 font-mono italic">
                          {record.date ? new Date(record.date).toLocaleDateString('default', { month: 'short', year: 'numeric' }) : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ======================================================== */}
      {/* SECTION B: UNDER "PREMISE NAME"                          */}
      {/* ======================================================== */}
      <div className="premise-validations-container">
        <AnimatePresence>
          {historyError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 text-[10px] flex items-center gap-1.5"
            >
              <AlertCircle className="w-3 h-3" />
              {historyError}
            </motion.div>
          )}

          {lastCollections.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2"
            >
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-blue-800 uppercase tracking-tight">
                  Recent History for {lastCollections[0]?.matchedPremise || formData.premiseName}
                </p>
                <div className="text-[10px] text-blue-600 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  Last 3 validated months: {lastCollections.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{c.displayString}</span>
                      <div className="flex items-center gap-1">
                        {c.pdfPath && (
                          <button
                            type="button"
                            onClick={() => viewPdf(c.pdfPath!)}
                            className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                            title="View PDF"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            PDF
                          </button>
                        )}
                        {c.rawData && (
                          <button
                            type="button"
                            onClick={() => handleRecallSubmission(c.rawData)}
                            className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors font-medium cursor-pointer"
                            title="Amend this submission"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                            Amend
                          </button>
                        )}
                      </div>
                      {i < lastCollections.length - 1 && <span className="text-blue-300">|</span>}
                    </div>
                  ))}
                </div>
                {lastCollections.length > 0 && (() => {
                  const nextMonth = getNextValidationMonth(lastCollections[0].fullPeriod);
                  if (nextMonth) {
                    return (
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Next month to validate: {nextMonth}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </motion.div>
          )}

          {!isCheckingHistory && formData.premiseName.length >= 3 && lastCollections.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[10px] font-medium flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3 h-3" />
              No previous records found for this Premise.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
