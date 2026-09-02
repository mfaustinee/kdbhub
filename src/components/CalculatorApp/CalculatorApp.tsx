import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Download, 
  RefreshCcw, 
  Calendar, 
  Layers, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrearsRow, PricingMode } from './types';
import { DEFAULT_PRICE, computeArrearsRows, computeArrearsTotals, getArrearsMForSale, formatPaymentMonthYear } from './utils';

export interface LocalSaleItem {
  month: string;
  year: string;
  qtyDeclared?: string;
  underDeclared?: string;
  verifiedQty?: string;
}

export interface CalculatorAppProps {
  initialDboName?: string;
  initialOfficerName?: string;
  localSales?: LocalSaleItem[];
  validationDate?: string;
  onApplyToSchedule?: (rows: { month: string; litres: string; amount: string; paymentMonthYear: string }[]) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export const CalculatorApp: React.FC<CalculatorAppProps> = ({
  initialDboName = '',
  initialOfficerName = '',
  localSales = [],
  validationDate,
  onApplyToSchedule,
  className = '',
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Base month set to a month before current month (changeable)
  const [baseMonth, setBaseMonth] = useState(() => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate highest m position required by localSales
  const maxCalculatedM = useMemo(() => {
    if (!localSales || localSales.length === 0) return 3;
    let maxM = 0;
    localSales.forEach(sale => {
      if (!sale.month || sale.month.trim() === '') return;
      const { m } = getArrearsMForSale(sale.month, sale.year, baseMonth, validationDate);
      if (m > maxM) maxM = m;
    });
    return Math.max(maxM, localSales.length, 3);
  }, [localSales, baseMonth, validationDate]);

  // Arrears count (m) determined by sales months position or user override
  const [arrearsCount, setArrearsCount] = useState(() => maxCalculatedM);

  // Automatically adjust arrears count when local sales or base month changes
  useEffect(() => {
    setArrearsCount(prev => Math.max(prev, maxCalculatedM));
  }, [maxCalculatedM]);

  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [pricingMode, setPricingMode] = useState<PricingMode>('general');
  const [pricesMap, setPricesMap] = useState<Record<number, number>>({});
  const [litresMap, setLitresMap] = useState<Record<number, number>>({});
  const [appliedNotification, setAppliedNotification] = useState(false);

  // Compute rows mirroring CSL period and litres declared from local sales
  const rows = useMemo(() => {
    return computeArrearsRows(
      baseMonth, 
      arrearsCount, 
      price, 
      pricingMode, 
      pricesMap, 
      litresMap,
      localSales,
      validationDate
    );
  }, [baseMonth, arrearsCount, price, pricingMode, pricesMap, litresMap, localSales, validationDate]);

  const totals = useMemo(() => {
    return computeArrearsTotals(rows);
  }, [rows]);

  const updateLitres = (m: number, val: number) => {
    setLitresMap(prev => ({ ...prev, [m]: val }));
  };

  const updatePrice = (m: number, val: number) => {
    setPricesMap(prev => ({ ...prev, [m]: val }));
  };

  const resetCalculator = () => {
    setLitresMap({});
    setPricesMap({});
    setArrearsCount(maxCalculatedM);
    setPrice(DEFAULT_PRICE);
    setPricingMode('general');
  };

  const handleApply = () => {
    if (!onApplyToSchedule) return;
    
    // Autofill Month/Year to Pay with current Month- Year (e.g. Sept- 2026)
    const defaultPaymentMonthYear = formatPaymentMonthYear();

    const activeRows = rows
      .filter(r => r.litres > 0 || r.total > 0)
      .map(r => ({
        month: r.month,
        litres: r.litres.toLocaleString(),
        amount: r.total.toFixed(2),
        paymentMonthYear: defaultPaymentMonthYear
      }));

    if (activeRows.length > 0) {
      onApplyToSchedule(activeRows);
      setAppliedNotification(true);
      setTimeout(() => setAppliedNotification(false), 3500);
    }
  };

  const validityDate = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  return (
    <div className={`rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/40 via-white to-slate-50/50 shadow-xs overflow-hidden print:hidden ${className}`}>
      {/* Interactive Toggle Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-blue-50/60 transition-colors select-none"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-gray-900">
                Statutory CSL Arrears & Compounding Calculator
              </h4>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Optional Utility
              </span>
              {totals.total > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Calculated Total: Ksh {totals.total.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated 12% monthly compounding logic, arrears sequence positioning (m=0/m=1 for base month, m=diff+1 for prior periods), and banded CF fee calculation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs font-bold text-blue-600">
            {isExpanded ? 'Hide Calculator' : 'Open Calculator'}
          </span>
          <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Calculator Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-blue-100 p-4 sm:p-6 space-y-5 bg-white"
          >
            {/* Top Toolbar / Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" /> Start Base Month
                </label>
                <input 
                  type="month" 
                  value={baseMonth} 
                  onChange={(e) => setBaseMonth(e.target.value)}
                  className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-blue-600" /> Arrears Count (m)
                </label>
                <input 
                  type="number" 
                  min={1}
                  max={36}
                  value={arrearsCount} 
                  onChange={(e) => setArrearsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Pricing Mode
                </label>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
                  <button 
                    type="button"
                    onClick={() => setPricingMode('general')}
                    className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      pricingMode === 'general' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    GENERAL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPricingMode('individual')}
                    className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      pricingMode === 'individual' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    INDIVIDUAL
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {pricingMode === 'general' ? 'General Rate (Ksh/L)' : 'Default Rate (Ksh/L)'}
                </label>
                <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-slate-400 text-xs font-semibold">Ksh</span>
                  <input 
                    type="number" 
                    value={price} 
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent font-mono text-xs focus:outline-none text-slate-800"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Main Interactive Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200">
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">CSL Period</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Arrears (m)</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Litres Declared</th>
                    {pricingMode === 'individual' && (
                      <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Rate (Ksh)</th>
                    )}
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Levy (Ksh)</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Penalty Rate</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Penalty (Ksh)</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">Levy + Penalty</th>
                    <th className="p-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">CF Fee (Ksh)</th>
                    <th className="p-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider bg-blue-50/50">Total Due (Ksh)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((row) => (
                    <tr key={row.m} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {row.month}
                        {row.m === 0 && (
                          <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Grace (Days 1-10)
                          </span>
                        )}
                        {row.m === 1 && (
                          <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Base Month (Days 11+)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-500">m={row.m}</td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          value={row.litres || ''} 
                          onChange={(e) => updateLitres(row.m, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-bold text-blue-600 bg-slate-50/60 focus:bg-white text-xs"
                        />
                      </td>
                      {pricingMode === 'individual' && (
                        <td className="p-2">
                          <input 
                            type="number" 
                            value={row.price || ''} 
                            onChange={(e) => updatePrice(row.m, parseFloat(e.target.value) || 0)}
                            placeholder={price.toString()}
                            className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-blue-500 outline-none font-mono text-xs text-slate-700 bg-slate-50/60 focus:bg-white"
                            step="0.01"
                          />
                        </td>
                      )}
                      <td className="p-3 font-mono text-slate-700">
                        {row.levy.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {(row.penaltyRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-red-600 font-semibold">
                        {row.penalty.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-slate-700 font-medium">
                        {row.amount.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-emerald-600 font-semibold">
                        {row.cf.toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700 bg-blue-50/50">
                        {row.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-200 text-xs">
                    <td colSpan={2} className="p-3 uppercase tracking-wider text-slate-600">Totals</td>
                    <td className="p-3 text-blue-700 font-mono">{totals.litres.toLocaleString()} L</td>
                    {pricingMode === 'individual' && <td className="p-3"></td>}
                    <td className="p-3 font-mono text-slate-900">{totals.levy.toLocaleString()}</td>
                    <td className="p-3"></td>
                    <td className="p-3 font-mono text-red-600">{totals.penalty.toLocaleString()}</td>
                    <td className="p-3 font-mono text-slate-900">{totals.amount.toLocaleString()}</td>
                    <td className="p-3 font-mono text-emerald-700">{totals.cf.toLocaleString()}</td>
                    <td className="p-3 font-mono text-sm text-blue-800 bg-blue-100/70">
                      Ksh {totals.total.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Compact Action Box & Summary Banner */}
            <div className="p-5 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Total Statutory Arrears:</span>
                  <span className="text-xl sm:text-2xl font-black text-blue-950 font-mono">
                    Ksh {totals.total.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
                  <span>Includes 12% compounding penalty & banded CF fees.</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span className="font-semibold text-blue-900">Valid till {validityDate}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onApplyToSchedule && (
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={totals.total <= 0}
                    className={`py-2.5 px-5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
                      totals.total > 0
                        ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Transfer the calculated periods and amounts into the Under-Declaration schedule table above"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Apply to Arrears Schedule</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetCalculator}
                  className="py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Reset calculator inputs"
                >
                  <RefreshCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Print or export calculation sheet"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {appliedNotification && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 justify-center shadow-xs"
              >
                <Check className="w-4 h-4 text-emerald-600" /> 
                Calculated CSL periods, volumes, and amounts successfully applied to Under-Declaration Arrears Schedule with Month/Year to Pay autofilled!
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalculatorApp;
