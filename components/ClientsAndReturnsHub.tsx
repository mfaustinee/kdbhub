import React, { useState, useEffect, useCallback } from 'react';
import { LicensedClient, ClientReturn, DebtorRecord } from '../types';
import { DBService } from '../services/db';
import { LicensedClientsModule } from './LicensedClientsModule';
import { ClientReturnsModule } from './ClientReturnsModule';
import { AnalysisModule } from './AnalysisModule';
import { 
  Building2, 
  Database, 
  AlertTriangle, 
  BarChart3,
  RefreshCw 
} from 'lucide-react';

export type ClientsAndReturnsTab = 'clients' | 'returns' | 'debtors' | 'analysis';

export interface ClientsAndReturnsHubProps {
  initialTab?: ClientsAndReturnsTab;
  defaultTab?: ClientsAndReturnsTab;
  debtors?: DebtorRecord[];
  onDebtorUpdate?: (updated: DebtorRecord[]) => void;
  onRefresh?: () => void;
  onSyncComplete?: () => void;
  onTabChange?: (tab: ClientsAndReturnsTab) => void;
}

export const ClientsAndReturnsHub: React.FC<ClientsAndReturnsHubProps> = ({
  initialTab,
  defaultTab,
  debtors: propDebtors,
  onDebtorUpdate,
  onRefresh,
  onSyncComplete,
  onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<ClientsAndReturnsTab>(defaultTab || initialTab || 'clients');
  const [clients, setClients] = useState<LicensedClient[]>([]);
  const [returns, setReturns] = useState<ClientReturn[]>([]);
  const [localDebtors, setLocalDebtors] = useState<DebtorRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [hubMetrics, setHubMetrics] = useState({
    totalClients: 0,
    operatingClients: 0,
    totalReturns: 0,
    totalVolume: 0,
    totalOutstanding: 0
  });

  // Keep active tab synced ONLY when parent explicitly changes initialTab (e.g. sidebar navigation)
  const prevInitialTabRef = React.useRef(initialTab);
  useEffect(() => {
    if (initialTab !== prevInitialTabRef.current) {
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load shared data metrics to eliminate duplicate network egress
  const loadData = useCallback(async (forceFresh: boolean = false) => {
    if (forceFresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [metrics, fetchedDebtors, fetchedClients, fetchedReturns] = await Promise.all([
        DBService.getHubMetrics(),
        DBService.getDebtors(forceFresh),
        DBService.getClients(forceFresh),
        DBService.getReturns(forceFresh)
      ]);

      setHubMetrics(metrics);
      setLocalDebtors(fetchedDebtors);
      if (fetchedClients && Array.isArray(fetchedClients)) {
        setClients(fetchedClients);
      }
      if (fetchedReturns && Array.isArray(fetchedReturns)) {
        setReturns(fetchedReturns);
      }
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('[ClientsAndReturnsHub] Failed to fetch shared metrics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleManualRefresh = async () => {
    await loadData(true);
    onRefresh?.();
  };

  const handleTabSwitch = (tab: ClientsAndReturnsTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
    if (tab === 'analysis') {
      // Check client registry and sync immediately so breakdown by permit category has latest records
      DBService.getClients(false).then((freshClients) => {
        if (freshClients && Array.isArray(freshClients)) {
          setClients(freshClients);
        }
      }).catch(err => console.warn('[ClientsAndReturnsHub] Analysis sync notice:', err));
    }
  };

  // High-level shared aggregate statistics from server-calculated metrics
  const effectiveDebtors = propDebtors || localDebtors;
  const totalClientsCount = hubMetrics.totalClients || clients.length;
  const totalFilingsCount = hubMetrics.totalReturns || returns.length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Refined Hub Header & Integrated Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Header Row */}
        <div className="p-5 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-blue-700 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>Central Records Engine</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Clients & Returns Management Hub
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Directory of licensed dairy facilities, monthly regulatory returns, debtor enforcement, and account statements
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
              disabled={isRefreshing || loading}
              title="Refresh shared records"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Clean, Modern Segmented Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-white flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch('clients')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Clients Registry</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'clients' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-600'
            }`}>
              {totalClientsCount.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('returns')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'returns'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Returns Registry</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'returns' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-600'
            }`}>
              {totalFilingsCount.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('debtors')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'debtors'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 shrink-0 ${activeTab === 'debtors' ? 'text-amber-400' : 'text-amber-500'}`} />
            <span>Debtors</span>
            {effectiveDebtors.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'debtors' ? 'bg-slate-800 text-rose-400' : 'bg-rose-50 text-rose-700'
              }`}>
                {effectiveDebtors.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('analysis')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === 'analysis' ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span>Analysis Module</span>
          </button>
        </div>
      </div>

      {/* Active Tab View - Persistent DOM with display toggling to ensure 0-lag instant navigation */}
      <div className="transition-all duration-200">
        <div className={activeTab === 'clients' ? 'block animate-in fade-in duration-200' : 'hidden'}>
          <LicensedClientsModule 
            onClientsChange={setClients}
            onRefresh={handleManualRefresh}
            standalone={true}
          />
        </div>

        <div className={activeTab === 'returns' || activeTab === 'debtors' ? 'block animate-in fade-in duration-200' : 'hidden'}>
          <ClientReturnsModule 
            debtors={effectiveDebtors}
            onDebtorUpdate={onDebtorUpdate}
            onReturnsChange={setReturns}
            onClientsChange={setClients}
            onRefresh={handleManualRefresh}
            defaultSubTab={activeTab === 'debtors' ? 'debtors' : 'registry'}
            standalone={true}
            hideNavigationHeader={true}
          />
        </div>

        <div className={activeTab === 'analysis' ? 'block animate-in fade-in duration-200' : 'hidden'}>
          <AnalysisModule 
            clients={clients}
            debtors={effectiveDebtors}
            returns={returns}
            onNavigateToTab={(target) => handleTabSwitch(target)}
            onRefresh={handleManualRefresh}
          />
        </div>
      </div>
    </div>
  );
};
