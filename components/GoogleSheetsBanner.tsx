import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  Settings, 
  X,
  Database,
  Trash2
} from 'lucide-react';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { DBService } from '../services/db';

// -----------------------------------------------------------------------------
// DATA VALIDATION SCHEMAS FOR THE 3 TARGET TABS (Kept for reference & exports)
// -----------------------------------------------------------------------------
export const DATA_VAL_COOLING_PLANTS_HEADERS = [
  'dboName', 'location', 'contacts', 'permitNo', 'expiryDate', 'avgVolPerDay',
  'farmerBuyingPrice', 'processorSellingPrice', 'traceability', 'month_year', 
  'quantity', 'record_type', 'verifiedQty', 'underDeclared', 
  'date', 'startTime', 'endTime', 'natureOfProduce'
];

export const DATA_VAL_MD_CI_HEADERS = [
  'dboName', 'location', 'contacts', 'permitNo', 'expiryDate', 'avgVolPerDay', 
  'buyingPrice', 'sellingPrice', 'traceability', 'month_year', 'qtyDeclared', 
  'verifiedQty', 'underDeclared', 'date', 'startTime', 'endTime', 'natureOfProduce',
  'distName', 'distContacts', 'distVolPerDay', 'distPermitNo', 'distAreaOfSale',
  'distOutlets', 'distNatureOfProduce', 'distPrice'
];

export const DATA_VAL_DISPENSERS_HEADERS = [
  'dboName', 'location', 'contacts', 'permitNo', 'expiryDate', 'avgVolPerDay', 
  'buyingPrice', 'sellingPrice', 'traceability', 'month_year', 'qtyDeclared', 
  'verifiedQty', 'underDeclared', 'date', 'startTime', 'endTime', 'natureOfProduce'
];

interface GoogleSheetsBannerProps {
  onSyncComplete?: () => void;
}

export const GoogleSheetsBanner: React.FC<GoogleSheetsBannerProps> = ({ onSyncComplete }) => {
  const [sheet1Id, setSheet1Id] = useState('');
  const [sheet2Id, setSheet2Id] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [syncPct, setSyncPct] = useState(0);

  // Load sheet IDs on mount
  const loadSheetIds = async () => {
    // 1. Check local storage / service
    const s1 = GoogleSheetsService.getClientsSpreadsheetId();
    const s2 = GoogleSheetsService.getDataValidationSpreadsheetId();

    if (s1) {
      setSheet1Id(s1);
    }
    if (s2) {
      setSheet2Id(s2);
    }

    // 2. Query backend credentials endpoint to catch any env configured IDs
    try {
      const res = await fetch('/api/google-credentials');
      if (res.ok) {
        const data = await res.json();
        if (data.clientsReturnsSpreadsheetId) {
          setSheet1Id(data.clientsReturnsSpreadsheetId);
          GoogleSheetsService.setClientsSpreadsheetId(data.clientsReturnsSpreadsheetId);
        }
        const valId = data.dataValidationSpreadsheetId || data.spreadsheetId;
        if (valId) {
          setSheet2Id(valId);
          GoogleSheetsService.setDataValidationSpreadsheetId(valId);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadSheetIds();
    const unsub = GoogleSheetsService.subscribeSync((syncState) => {
      setIsSyncing(syncState.isSyncing);
      if (syncState.progress !== undefined) setSyncPct(syncState.progress);
      if (syncState.lastSyncTime) setLastSyncTime(syncState.lastSyncTime);
      if (syncState.status === 'synced' && syncState.clientsCount > 0) {
        setStatusMessage({
          text: `Live Sync Active: ${syncState.clientsCount} clients and ${syncState.returnsCount.toLocaleString()} returns synced from Sheet 1 at ${syncState.lastSyncTime}.`,
          type: 'success'
        });
      } else if (syncState.status === 'error' && syncState.errorMessage) {
        setStatusMessage({
          text: syncState.errorMessage,
          type: 'error'
        });
      }
    });
    return () => unsub();
  }, []);

  const isSheet1Connected = Boolean(sheet1Id && sheet1Id.trim());
  const isSheet2Connected = Boolean(sheet2Id && sheet2Id.trim());

  // Headless sync for Clients & Returns (Sheet 1) - Zero Google Sign-In Required!
  const handleSyncClientsAndReturns = async () => {
    const effectiveSheet1Id = sheet1Id || GoogleSheetsService.getClientsSpreadsheetId();
    setStatusMessage(null);

    try {
      const result = await GoogleSheetsService.triggerAutoSync(effectiveSheet1Id || undefined);
      const now = result.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);
      setStatusMessage({ 
        text: `Sync complete! Successfully ingested ${result.clients.length} clients and ${result.returns.length} returns from Sheet 1 at ${now}.`, 
        type: 'success' 
      });
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Clients & Returns sync error:', err);
      setStatusMessage({ 
        text: err.message || 'Failed to sync Clients & Returns from Google Sheet 1.', 
        type: 'error' 
      });
    }
  };

  const handleResetReturnsCache = () => {
    DBService.clearReturnsCache();
    setStatusMessage({
      text: 'Outdated returns cache has been cleared. The system will now only display records synced from Google Sheet 1.',
      type: 'success'
    });
    onSyncComplete?.();
  };

  const handleOpenSheet1 = () => {
    if (!sheet1Id) {
      setShowConfigModal(true);
      return;
    }
    const cleanId = sheet1Id.trim();
    const url = cleanId.startsWith('http') ? cleanId : `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenSheet2 = () => {
    if (!sheet2Id) {
      setShowConfigModal(true);
      return;
    }
    const cleanId = sheet2Id.trim();
    const url = cleanId.startsWith('http') ? cleanId : `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
      {/* Main Bar: Status & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Connection Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Sheet 1 Status */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 tracking-tight">Sheet 1: Clients & Returns</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSheet1Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSheet1Connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isSheet1Connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
          </div>

          {/* Sheet 2 Status */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/80">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 tracking-tight">Sheet 2: Data Validation</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSheet2Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSheet2Connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isSheet2Connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Sync Clients & Returns */}
          <button
            type="button"
            onClick={handleSyncClientsAndReturns}
            disabled={isSyncing || !isSheet1Connected}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? `Syncing ${Math.max(1, Math.round(syncPct))}%...` : 'Sync Clients & Returns'}</span>
          </button>

          {/* Reset Returns Cache */}
          <button
            type="button"
            onClick={handleResetReturnsCache}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Reset and clear outdated returns cache to ensure only Google Sheet 1 data is displayed"
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Reset Cache</span>
          </button>

          {/* Open Sheet 1 */}
          <button
            type="button"
            onClick={handleOpenSheet1}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Open Sheet 1 (Clients & Returns) in Google Sheets"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            <span>Open Sheet 1</span>
          </button>

          {/* Open Sheet 2 */}
          <button
            type="button"
            onClick={handleOpenSheet2}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Open Sheet 2 (Data Validation) in Google Sheets"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Sheet 2</span>
          </button>

          {/* Settings button to configure Sheet IDs */}
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-2xl transition-all cursor-pointer shadow-2xs"
            title="Configure Spreadsheet IDs"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {lastSyncTime && (
            <span className="text-[11px] text-emerald-800 font-mono shrink-0">
              Last synced: {lastSyncTime}
            </span>
          )}
        </div>
      )}

      {/* Connection Status Details Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900">Google Sheets Integration</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Live connection status configured via build environment
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status Cards */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Sheet 1: Clients & Returns</span>
                    <span className="text-[10px] text-slate-500 font-normal">(Primary Source)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Provides active operator profiles, filing periods, and financial balances
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isSheet1Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isSheet1Connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isSheet1Connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Sheet 2: Data Validation</span>
                    <span className="text-[10px] text-slate-500 font-normal">(Submissions & Rules)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Destination for field inspections, validation audits, and monthly quotas
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isSheet2Connected 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isSheet2Connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isSheet2Connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900 text-xs leading-relaxed">
              Secrets, service credentials, and spreadsheet bindings are provisioned during build time in Cloudflare.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
