import React, { useState, useEffect, useCallback } from 'react';
import { DebtorRecord } from '../types';
import { DBService } from '../services/db';
import { ClientReturnsModule } from './ClientReturnsModule';
import { 
  AlertTriangle, 
  RefreshCw, 
  DollarSign, 
  Users, 
  FileSpreadsheet, 
  CalendarClock
} from 'lucide-react';

export interface DebtorsModuleProps {
  debtors?: DebtorRecord[];
  onDebtorUpdate?: (updated: DebtorRecord[]) => void;
  onRefresh?: () => void;
}

export const DebtorsModule: React.FC<DebtorsModuleProps> = ({
  debtors: propDebtors,
  onDebtorUpdate,
  onRefresh
}) => {
  const [localDebtors, setLocalDebtors] = useState<DebtorRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [summaryMetrics, setSummaryMetrics] = useState({
    totalOutstanding: 0,
    totalDebtorsCount: 0
  });

  const loadMetrics = useCallback(async (forceFresh: boolean = false) => {
    if (forceFresh) setIsRefreshing(true);
    try {
      const [fetchedDebtors, metrics] = await Promise.all([
        DBService.getDebtors(forceFresh),
        DBService.getHubMetrics().catch(() => ({ totalOutstanding: 0, totalClients: 0, operatingClients: 0, totalReturns: 0, totalVolume: 0 }))
      ]);
      setLocalDebtors(fetchedDebtors);
      const effective = propDebtors || fetchedDebtors;
      const totalOutstanding = metrics.totalOutstanding || effective.reduce((sum, d) => sum + (d.totalArrears || 0), 0);
      setSummaryMetrics({
        totalOutstanding,
        totalDebtorsCount: effective.length
      });
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('[DebtorsModule] Failed to refresh debtors metrics:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [propDebtors]);

  useEffect(() => {
    loadMetrics(false);
  }, [loadMetrics]);

  const handleManualRefresh = async () => {
    await loadMetrics(true);
    onRefresh?.();
  };

  const effectiveDebtors = propDebtors || localDebtors;
  const computedTotalArrears = summaryMetrics.totalOutstanding > 0 
    ? summaryMetrics.totalOutstanding 
    : effectiveDebtors.reduce((sum, d) => sum + (d.totalArrears || 0), 0);
  const averageArrears = effectiveDebtors.length > 0 ? Math.round(computedTotalArrears / effectiveDebtors.length) : 0;
  const totalInstallmentsCount = effectiveDebtors.reduce((sum, d) => sum + (d.installments?.length || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-amber-600 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Debt Recovery & Enforcement</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Debtors Ledger
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Official registry of dairy business operators with arrears, debt agreements, and recovery payment schedules
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastSynced && (
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
                Last synced at {lastSynced}
              </span>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh debtors data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-4 sm:px-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Arrears Balance</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-extrabold text-rose-600">
                KES {computedTotalArrears.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Cumulative outstanding balance</span>
            </div>
          </div>

          <div className="p-4 sm:px-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Debtors In Arrears</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-slate-900">{effectiveDebtors.length}</span>
              <span className="text-[11px] font-medium text-amber-700">active ledger entries</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Avg: KES {averageArrears.toLocaleString()} per operator</span>
            </div>
          </div>

          <div className="p-4 sm:px-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Payment Schedules</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-extrabold text-slate-900">{totalInstallmentsCount}</span>
              <span className="text-[11px] font-medium text-blue-700">installments</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>Active structured installment lines</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Debtors Workspace */}
      <ClientReturnsModule 
        debtors={effectiveDebtors}
        onDebtorUpdate={onDebtorUpdate}
        onRefresh={handleManualRefresh}
        defaultSubTab="debtors"
        debtorsOnly={true}
        hideNavigationHeader={true}
        standalone={false}
      />
    </div>
  );
};
