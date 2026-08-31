import React from 'react';
import { 
  Plus, 
  Trash2, 
  Scale, 
  Sparkles, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { TransactionReconciliationItem } from '../types';

interface TransactionReconciliationComponentProps {
  entries: TransactionReconciliationItem[];
  onChange: (updated: TransactionReconciliationItem[]) => void;
  defaultUnit?: string;
  availablePeriods?: string[];
  readOnly?: boolean;
  onTransferToUnderDeclaration?: (variances: { month: string; volume: string; amount: string }[]) => void;
  onLogException?: (item: { period: string; variance: string; explanation: string; source: string }) => void;
}

export const TransactionReconciliationComponent: React.FC<TransactionReconciliationComponentProps> = ({
  entries = [],
  onChange,
  defaultUnit = 'L',
  availablePeriods = [],
  readOnly = false,
  onTransferToUnderDeclaration,
  onLogException
}) => {
  const createNewRow = (periodOverride?: string): TransactionReconciliationItem => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    
    return {
      id,
      period: periodOverride || (availablePeriods.length > 0 ? availablePeriods[0] : ''),
      source1: '',
      source2: '',
      source3: '',
      unit: defaultUnit,
      recalculatedAmount: '',
      variance: '0.00',
      explanation: ''
    };
  };

  const handleAddRow = () => {
    if (readOnly) return;
    onChange([...entries, createNewRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (readOnly) return;
    onChange(entries.filter(e => e.id !== id));
  };

  const handleFieldChange = (id: string, field: keyof TransactionReconciliationItem, value: string) => {
    if (readOnly) return;
    const updated = entries.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };

      // If user changed recalculatedAmount or source1/source2, calculate suggested variance if variance wasn't manually typed
      if (field === 'recalculatedAmount' || field === 'source1' || field === 'source2') {
        const recalcNum = parseFloat(field === 'recalculatedAmount' ? value : next.recalculatedAmount);
        // Compare with Source 1 (or Source 2 if Source 1 is blank)
        const primarySrc = field === 'source1' ? value : next.source1;
        const fallbackSrc = field === 'source2' ? value : next.source2;
        const srcVal = parseFloat(primarySrc || fallbackSrc || '');

        if (!isNaN(recalcNum) && !isNaN(srcVal)) {
          const diff = recalcNum - srcVal;
          next.variance = diff === 0 ? '0.00' : (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));
        }
      }

      return next;
    });

    onChange(updated);
  };

  const handleSyncPeriodsFromSales = () => {
    if (readOnly || availablePeriods.length === 0) return;
    const existingPeriods = new Set(entries.map(e => e.period.toLowerCase().trim()));
    const missingPeriods = availablePeriods.filter(p => !existingPeriods.has(p.toLowerCase().trim()));

    if (missingPeriods.length === 0 && entries.length > 0) return;

    const newRows: TransactionReconciliationItem[] = missingPeriods.map(p => createNewRow(p));
    onChange([...entries, ...newRows]);
  };

  // Calculations for summary metrics
  const totalRecalculated = entries.reduce((acc, curr) => {
    const val = parseFloat(curr.recalculatedAmount);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const totalVariance = entries.reduce((acc, curr) => {
    const clean = curr.variance.replace('+', '');
    const val = parseFloat(clean);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const varianceCount = entries.filter(e => {
    const clean = (e.variance || '').replace('+', '').trim();
    const val = parseFloat(clean);
    return !isNaN(val) && Math.abs(val) > 0.001;
  }).length;

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/50">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Transaction / Balances Reconciliation
              </h4>
              {entries.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {entries.length} {entries.length === 1 ? 'Period' : 'Periods'}
                </span>
              )}
              {varianceCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {varianceCount} {varianceCount === 1 ? 'Variance' : 'Variances'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cross-reconcile recorded figures across up to 3 comparative sources against recalculated amounts
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {availablePeriods.length > 0 && (
              <button
                type="button"
                onClick={handleSyncPeriodsFromSales}
                className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Import active validation months as reconciliation rows"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Import Periods ({availablePeriods.length})</span>
              </button>
            )}

            {Boolean(varianceCount > 0 && onTransferToUnderDeclaration) && (
              <button
                type="button"
                onClick={() => {
                  const itemsWithVariance = entries
                    .filter(e => {
                      const v = parseFloat((e.variance || '').replace('+', ''));
                      return !isNaN(v) && v > 0;
                    })
                    .map(e => ({
                      month: e.period,
                      volume: (e.variance || '').replace('+', ''),
                      amount: ''
                    }));
                  if (itemsWithVariance.length > 0) {
                    onTransferToUnderDeclaration(itemsWithVariance);
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Transfer positive variances to Under-Declaration schedule below"
              >
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sync to Under-Declaration ({varianceCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddRow}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Reconciliation Row</span>
            </button>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="p-3 sm:p-5 space-y-4">
        {entries.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
            <Scale className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-slate-700">No reconciliation rows added yet</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reconcile physical books, monthly returns, invoices, and physical counts across specific periods.
              </p>
            </div>
            {!readOnly && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Reconciliation</span>
                </button>
                {availablePeriods.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncPeriodsFromSales}
                    className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Auto-fill from Sales Periods</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 w-36">Date / Period</th>
                  <th className="p-3 w-32">Source 1</th>
                  <th className="p-3 w-32">Source 2</th>
                  <th className="p-3 w-32">Source 3</th>
                  <th className="p-3 w-24">Unit</th>
                  <th className="p-3 w-36">Recalculated Amount</th>
                  <th className="p-3 w-32">Variance</th>
                  <th className="p-3 min-w-[200px]">Explanation / Action</th>
                  {!readOnly && <th className="p-3 w-12 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {entries.map((item, idx) => {
                  const varNum = parseFloat((item.variance || '').replace('+', ''));
                  const hasVariance = !isNaN(varNum) && Math.abs(varNum) > 0.001;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date / Period */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.period}
                          onChange={(e) => handleFieldChange(item.id, 'period', e.target.value)}
                          placeholder="e.g. Jan 2024"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs font-semibold text-slate-800"
                        />
                      </td>

                      {/* Source 1 */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.source1}
                          onChange={(e) => handleFieldChange(item.id, 'source1', e.target.value)}
                          placeholder="e.g. DBO Books"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs font-mono text-slate-800"
                        />
                      </td>

                      {/* Source 2 */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.source2}
                          onChange={(e) => handleFieldChange(item.id, 'source2', e.target.value)}
                          placeholder="e.g. Return / Invoices"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs font-mono text-slate-800"
                        />
                      </td>

                      {/* Source 3 */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.source3}
                          onChange={(e) => handleFieldChange(item.id, 'source3', e.target.value)}
                          placeholder="e.g. Bank / MPESA"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs font-mono text-slate-800"
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleFieldChange(item.id, 'unit', e.target.value)}
                          placeholder="L / Kg / Kshs"
                          disabled={readOnly}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs text-center font-bold text-slate-700"
                        />
                      </td>

                      {/* Recalculated Amount */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.recalculatedAmount}
                          onChange={(e) => handleFieldChange(item.id, 'recalculatedAmount', e.target.value)}
                          placeholder="Verified amount"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/30 focus:border-blue-500 outline-none text-xs font-mono font-bold text-blue-900"
                        />
                      </td>

                      {/* Variance */}
                      <td className="p-2">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={item.variance}
                            onChange={(e) => handleFieldChange(item.id, 'variance', e.target.value)}
                            placeholder="0.00"
                            disabled={readOnly}
                            className={`w-full px-2.5 py-1.5 rounded-lg border outline-none text-xs font-mono font-bold ${
                              hasVariance 
                                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Explanation / Action */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.explanation}
                          onChange={(e) => handleFieldChange(item.id, 'explanation', e.target.value)}
                          placeholder="Explanation of difference / Action required"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs text-slate-700"
                        />
                      </td>

                      {/* Actions */}
                      {!readOnly && (
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {hasVariance && onLogException && (
                              <button
                                type="button"
                                onClick={() => onLogException({
                                  period: item.period,
                                  variance: item.variance,
                                  explanation: item.explanation,
                                  source: `${item.source1 || 'Source 1'} vs Recalculated (${item.recalculatedAmount || '0'})`
                                })}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                title="Log this variance as an Exception in the Exception Register"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Summary Row */}
                {entries.length > 0 && (
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                    <td className="p-3 text-[11px] uppercase tracking-wider text-slate-600">
                      Summary ({entries.length})
                    </td>
                    <td colSpan={4} className="p-3 text-slate-500 text-[11px]">
                      Cross-Source Recalculation
                    </td>
                    <td className="p-3 font-mono text-blue-900 text-xs">
                      {totalRecalculated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`p-3 font-mono text-xs ${Math.abs(totalVariance) > 0.01 ? 'text-amber-800' : 'text-slate-700'}`}>
                      {totalVariance === 0 ? '0.00' : (totalVariance > 0 ? `+${totalVariance.toFixed(2)}` : totalVariance.toFixed(2))}
                    </td>
                    <td colSpan={readOnly ? 1 : 2} className="p-3 text-[11px] text-slate-500">
                      {varianceCount > 0 ? `${varianceCount} row(s) require action / explanation` : 'All reconciled records balanced'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
