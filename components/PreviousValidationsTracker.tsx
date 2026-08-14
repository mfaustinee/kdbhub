import React, { useState, useEffect } from 'react';
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
import { supabase } from './lib/supabase'; // Adjust import path to your Supabase client instance

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
  // 2. SECURE PDF VIEWER (Signed URL)
  // -------------------------------------------------------------
  const viewPdf = async (path: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage
        .from('validation-pdfs')
        .createSignedUrl(path, 60); // 60 seconds validity
      
      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error generating signed URL for PDF:', err);
    }
  };

  // -------------------------------------------------------------
  // 3. FETCH PREMISE VALIDATION & PDF HISTORY
  // -------------------------------------------------------------
  useEffect(() => {
    const fetchHistory = async () => {
      if (hasAutofilled) {
        setIsCheckingHistory(false);
        return;
      }
      const rawSearch = (formData.premiseName || '').trim();
      if (!rawSearch || rawSearch.length < 2) {
        setLastCollections([]);
        setHistoryError(null);
        return;
      }

      setIsCheckingHistory(true);
      setHistoryError(null);
      try {
        const cleanSearch = rawSearch.replace(/["']/g, '').trim();
        const { data, error } = await supabase
          .from('kdb_validations')
          .select('validation_period, date, premise_name, raw_data, pdf_path')
          .ilike('premise_name', `%${cleanSearch}%`)
          .order('date', { ascending: false })
          .limit(25);

        if (error) throw error;

        if (data && data.length > 0) {
          const allExtractedMonths: { period: string; pdfPath?: string; score: number; rawData?: any; matchedPremise?: string }[] = [];

          data.forEach(item => {
            if (item.validation_period) {
              allExtractedMonths.push({
                period: item.validation_period,
                pdfPath: item.pdf_path,
                score: new Date(item.date).getTime() || 0,
                rawData: item.raw_data,
                matchedPremise: item.premise_name
              });
            }
          });

          // Deduplicate and select latest 3
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
            matchedPremise: m.matchedPremise || data[0]?.premise_name,
            pdfPath: m.pdfPath,
            rawData: m.rawData
          }));

          setLastCollections(history);
        } else {
          setLastCollections([]);
        }
      } catch (err: any) {
        console.error('Error fetching history:', err);
        setHistoryError(err.message || 'Failed to fetch history');
      } finally {
        setIsCheckingHistory(false);
      }
    };

    const timer = setTimeout(fetchHistory, 250); // Snappy 250ms debounce
    return () => clearTimeout(timer);
  }, [formData.premiseName, hasAutofilled]);

  // -------------------------------------------------------------
  // 4. FETCH DBO SEARCH HISTORY
  // -------------------------------------------------------------
  useEffect(() => {
    const fetchDboHistory = async () => {
      if (hasAutofilled) {
        setIsCheckingDbo(false);
        return;
      }
      const rawSearch = (formData.dboName || '').trim();
      if (!rawSearch || rawSearch.length < 2) {
        setLastDboRecords([]);
        setDboError(null);
        return;
      }

      setIsCheckingDbo(true);
      setDboError(null);
      try {
        const cleanSearch = rawSearch.replace(/["']/g, '').trim();
        const { data, error } = await supabase
          .from('kdb_validations')
          .select('dbo_name, premise_name, category, permit_no, location, county, raw_data, date')
          .ilike('dbo_name', `%${cleanSearch}%`)
          .order('date', { ascending: false })
          .limit(15);

        if (error) throw error;
        
        if (data) {
          const uniqueMap: Record<string, any> = {};
          data.forEach(item => {
            const key = `${item.premise_name || ''}-${item.permit_no || ''}`.toLowerCase().trim();
            if (!uniqueMap[key]) {
              uniqueMap[key] = {
                ...item,
                county: toSentenceCase(item.county || 'Kericho')
              };
            }
          });
          setLastDboRecords(Object.values(uniqueMap).slice(0, 8));
        } else {
          setLastDboRecords([]);
        }
      } catch (err: any) {
        console.error('Error fetching DBO history:', err);
        setDboError(err.message || 'Failed to fetch DBO history');
      } finally {
        setIsCheckingDbo(false);
      }
    };

    const timer = setTimeout(fetchDboHistory, 250); // Snappy 250ms debounce
    return () => clearTimeout(timer);
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
                      className="w-full text-left p-2 rounded-lg bg-white border border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-[11px] group flex flex-col gap-0.5"
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
                          {new Date(record.date).toLocaleDateString('default', { month: 'short', year: 'numeric' })}
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
                            className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors"
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
                            className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors font-medium"
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
                  const latest = lastCollections[0].fullPeriod; // e.g., "March 2024"
                  const parts = latest.split(' ');
                  
                  if (parts.length >= 2) {
                    const months = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    const monthIndex = months.indexOf(parts[0]);
                    
                    if (monthIndex !== -1) {
                      let nextMonthIndex = monthIndex + 1;
                      let nextYear = parseInt(parts[1], 10);
                      
                      if (nextMonthIndex > 11) {
                        nextMonthIndex = 0;
                        nextYear += 1;
                      }
                      
                      return (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight mt-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Next month to validate: {months[nextMonthIndex]} {nextYear}
                        </p>
                      );
                    }
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
