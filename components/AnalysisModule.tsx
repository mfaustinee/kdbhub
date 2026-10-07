import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  TrendingUp, 
  ThermometerSnowflake, 
  RefreshCw, 
  ArrowUpRight 
} from 'lucide-react';
import { LicensedClient, DebtorRecord, ClientReturn } from '../types';
import { DBService } from '../services/db';

export interface AnalysisModuleProps {
  clients?: LicensedClient[];
  debtors?: DebtorRecord[];
  returns?: ClientReturn[];
  onNavigateToTab?: (tab: 'clients' | 'returns' | 'debtors') => void;
  onRefresh?: () => void;
}

export const AnalysisModule: React.FC<AnalysisModuleProps> = ({
  clients: propClients,
  debtors: propDebtors,
  returns: propReturns,
  onNavigateToTab,
  onRefresh
}) => {
  const [clients, setClients] = useState<LicensedClient[]>(propClients || []);
  const [debtors, setDebtors] = useState<DebtorRecord[]>(propDebtors || []);
  const [returns, setReturns] = useState<ClientReturn[]>(propReturns || []);
  const [loading, setLoading] = useState<boolean>(!propClients || !propDebtors);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const loadAllData = useCallback(async (forceFresh: boolean = false) => {
    if (forceFresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [fetchedClients, fetchedDebtors, fetchedReturns] = await Promise.all([
        DBService.getClients(forceFresh),
        DBService.getDebtors(forceFresh),
        DBService.getReturns(forceFresh)
      ]);

      setClients(fetchedClients || []);
      setDebtors(fetchedDebtors || []);
      setReturns(fetchedReturns || []);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.warn('[AnalysisModule] Data load notice:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!propClients || propClients.length === 0 || !propDebtors || propDebtors.length === 0) {
      loadAllData(false);
    } else {
      if (propClients) setClients(propClients);
      if (propDebtors) setDebtors(propDebtors);
      if (propReturns) setReturns(propReturns);
      setLoading(false);
    }
  }, [propClients, propDebtors, propReturns, loadAllData]);

  const handleManualRefresh = async () => {
    await loadAllData(true);
    onRefresh?.();
  };

  // Outstanding Arrears & Debtors Aggregate Metrics
  const effectiveDebtors = debtors;
  const totalDebtorsCount = effectiveDebtors.length;
  const compliantCount = Math.max(0, clients.length - totalDebtorsCount);

  const totalOutstandingArrears = useMemo(() => {
    const fromDebtors = effectiveDebtors.reduce((sum, d) => sum + (d.totalArrears || 0), 0);
    if (fromDebtors > 0) return fromDebtors;
    return returns.reduce((sum, r) => sum + (r.outstandingBalance || 0), 0);
  }, [effectiveDebtors, returns]);

  // Order of categories explicitly matching regulatory classifications
  const orderedCategories: LicensedClient['premiseCategory'][] = [
    'Milk Bar',
    'Dispenser',
    'Cooling Plant',
    'Mini Dairy',
    'Cottage Industry',
    'Processor'
  ];

  const getClientCategory = (client: LicensedClient): string => {
    return String(client.premiseCategory || '').trim();
  };

  const isSameCategory = (cat1: string, cat2: string): boolean => {
    return cat1.toLowerCase().replace(/[^a-z0-9]/g, '') === cat2.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // 2. Breakdown by Permit Category stats
  const categoryStats = useMemo(() => {
    return orderedCategories.map(cat => {
      const catClients = clients.filter(c => isSameCategory(getClientCategory(c), cat));
      const licensed = catClients.length;
      const operating = catClients.filter(c => (c.operationalStatus || '').toLowerCase() === 'operating').length;
      const closed = catClients.filter(c => (c.operationalStatus || '').toLowerCase() === 'closed').length;
      const qfr = catClients.filter(c => (c.levyInfo || '').toUpperCase() === 'QFR').length;
      const dnqr = catClients.filter(c => (c.levyInfo || '').toUpperCase() === 'DNQ-R').length;
      
      let capacitySum = 0;
      if (cat === 'Cooling Plant' || cat === 'Processor') {
        capacitySum = catClients.reduce((sum, c) => sum + (c.coolingCapacity || 0), 0);
      }

      return {
        category: cat,
        licensed,
        operating,
        closed,
        qfr,
        dnqr,
        capacitySum
      };
    });
  }, [clients]);

  // Totals across all categories for the 'Total ' row
  const categoryTotals = useMemo(() => {
    return categoryStats.reduce((acc, curr) => ({
      licensed: acc.licensed + curr.licensed,
      operating: acc.operating + curr.operating,
      closed: acc.closed + curr.closed,
      qfr: acc.qfr + curr.qfr,
      dnqr: acc.dnqr + curr.dnqr,
      capacitySum: acc.capacitySum + curr.capacitySum
    }), { licensed: 0, operating: 0, closed: 0, qfr: 0, dnqr: 0, capacitySum: 0 });
  }, [categoryStats]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Module Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-indigo-700 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
            <span>Governance & Operational Intelligence</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Analysis Module
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Comprehensive audit of licensed entities, facility categories, levy qualification, and outstanding arrears
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
              Updated at {lastRefreshed}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            title="Recalculate analysis"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Recalculating...' : 'Refresh Analysis'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: OUTSTANDING ARREARS & DEBTORS                       */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Outstanding Arrears & Debtors
            </h3>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('debtors')}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>Open Debtors Ledger</span>
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Total Outstanding Arrears */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Outstanding Arrears</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-rose-600">
                KES {totalOutstandingArrears.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-0.5">Cumulative debt across all overdue returns</p>
          </div>

          {/* In Arrears Debtors Count */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Enforcement Debtors</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{totalDebtorsCount.toLocaleString()}</span>
              <span className="text-xs font-bold text-rose-600">Active Debtors</span>
            </div>
            <p className="text-[11px] text-rose-600/80 font-medium pt-0.5">Clients currently subject to arrears follow-up</p>
          </div>

          {/* Compliant Clients Count */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Compliant Entities</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600">{compliantCount.toLocaleString()}</span>
              <span className="text-xs font-bold text-emerald-700">Clear of Debt</span>
            </div>
            <p className="text-[11px] text-emerald-700/80 font-medium pt-0.5">Zero arrears recorded on account balance</p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: BREAKDOWN BY PERMIT CATEGORY TABLE                  */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Breakdown by Permit Category
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            {orderedCategories.length} Categories Registered
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                  <th className="px-5 py-3.5">Permit Category</th>
                  <th className="px-5 py-3.5 text-center">Licensed</th>
                  <th className="px-5 py-3.5 text-center text-emerald-700">Operating</th>
                  <th className="px-5 py-3.5 text-center text-slate-600">Closed</th>
                  <th className="px-5 py-3.5 text-center text-indigo-700">QFR</th>
                  <th className="px-5 py-3.5 text-center text-amber-700">DNQ-R</th>
                  <th className="px-5 py-3.5 text-right">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {categoryStats.map(stat => (
                  <tr key={stat.category} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>
                        {stat.category === 'Mini Dairy' || stat.category === 'Cottage Industry'
                          ? stat.category
                          : `${stat.category}s`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-black text-slate-900">
                      {stat.licensed.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center font-black text-emerald-700">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black text-[11px] border border-emerald-100">
                        {stat.operating.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-black text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-black text-[11px] border border-slate-200">
                        {stat.closed.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-black text-[11px] border border-indigo-100">
                        {stat.qfr.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-black text-[11px] border border-amber-100">
                        {stat.dnqr.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-slate-600">
                      {stat.category === 'Cooling Plant' || stat.category === 'Processor' ? (
                        <span className="text-slate-900 font-bold flex items-center justify-end gap-1">
                          <ThermometerSnowflake size={12} className="text-blue-500" />
                          {stat.capacitySum.toLocaleString()} L
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* 'Total ' row explicitly after Processors as requested */}
                <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="px-5 py-4 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                    <span>Total </span>
                  </td>
                  <td className="px-5 py-4 text-center text-sm font-black text-slate-900">
                    {categoryTotals.licensed.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs">
                      {categoryTotals.operating.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="bg-slate-700 text-white px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs">
                      {categoryTotals.closed.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs">
                      {categoryTotals.qfr.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="bg-amber-600 text-white px-2.5 py-0.5 rounded-full font-black text-xs shadow-xs">
                      {categoryTotals.dnqr.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-slate-900">
                    {categoryTotals.capacitySum > 0 ? (
                      <span className="flex items-center justify-end gap-1 text-slate-900">
                        <ThermometerSnowflake size={13} className="text-blue-600" />
                        {categoryTotals.capacitySum.toLocaleString()} L
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
