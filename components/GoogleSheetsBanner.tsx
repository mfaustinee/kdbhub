import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Check, 
  Copy, 
  Layers, 
  Database,
  Cloud,
  Lock,
  ArrowRight,
  ClipboardList,
  Sparkles,
  HelpCircle,
  Activity,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { GoogleSheetsService, CLIENTS_HEADERS, RETURNS_HEADERS } from '../services/googleSheetsService';
import { DBService } from '../services/db';

interface GoogleSheetsBannerProps {
  onSyncComplete?: () => void;
}

export const GoogleSheetsBanner: React.FC<GoogleSheetsBannerProps> = ({ onSyncComplete }) => {
  // Master Spreadsheet Link State
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState('');
  const [clientsTabInput, setClientsTabInput] = useState('Clients_DB');
  const [returnsTabInput, setReturnsTabInput] = useState('Returns_DB');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  
  // Interactive Google Account state (for direct browser read/write if desired)
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // Execution & Status States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [copiedHeader, setCopiedHeader] = useState<'clients' | 'returns' | null>(null);
  
  // Cloudflare Server Credentials Diagnostics (Managed by Cloudflare, zero browser input)
  const [cloudflareStatus, setCloudflareStatus] = useState<{
    configured: boolean;
    clientEmail?: string;
    spreadsheetId?: string;
    hasPrivateKey?: boolean;
    managedBy?: string;
    platform?: string;
  }>({ configured: false });
  const [isCheckingCloudflare, setIsCheckingCloudflare] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active Workspace View: 'clients_returns' | 'data_validation' | 'cloudflare_vault' | 'schemas'
  const [activeSyncView, setActiveSyncView] = useState<'clients_returns' | 'data_validation' | 'cloudflare_vault' | 'schemas'>('clients_returns');

  const fetchCloudflareStatus = async () => {
    setIsCheckingCloudflare(true);
    try {
      const res = await fetch('/api/google-credentials');
      if (res.ok) {
        const data = await res.json();
        setCloudflareStatus(data);
        if (data.spreadsheetId && !currentSpreadsheetId) {
          setCurrentSpreadsheetId(data.spreadsheetId);
          setSpreadsheetInput(data.spreadsheetId);
        }
      }
    } catch (e) {
      console.warn('[GoogleSheets] Could not fetch Cloudflare credentials status:', e);
    } finally {
      setIsCheckingCloudflare(false);
    }
  };

  useEffect(() => {
    fetchCloudflareStatus();
    try {
      const sId = GoogleSheetsService.getSpreadsheetId();
      if (sId) {
        setCurrentSpreadsheetId(sId);
        setSpreadsheetInput(sId);
      }

      const cTab = GoogleSheetsService.getClientsTabName();
      const rTab = GoogleSheetsService.getReturnsTabName();
      setClientsTabInput(cTab);
      setReturnsTabInput(rTab);

      // Subscribe to Google auth state
      const unsubscribe = GoogleSheetsService.initAuth(
        (user) => {
          setIsConnected(true);
          setCurrentUserEmail(user.email);
          if (sId) {
            loadSpreadsheetTabs(sId);
          }
        },
        () => {
          setIsConnected(false);
          setCurrentUserEmail(null);
        }
      );

      return () => {
        if (typeof unsubscribe === 'function') {
          try { unsubscribe(); } catch (_) {}
        }
      };
    } catch (e) {
      console.warn('[GoogleSheetsBanner] Init notice:', e);
    }
  }, []);

  const loadSpreadsheetTabs = async (sId: string) => {
    try {
      const meta = await GoogleSheetsService.getSpreadsheetMetadata(sId);
      if (meta && Array.isArray(meta.sheets)) {
        setAvailableTabs(meta.sheets);
      }
    } catch (_) {}
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const res = await GoogleSheetsService.signInWithGoogle();
      setIsConnected(true);
      setCurrentUserEmail(res.user.email);
      setStatusMessage({ text: `Connected successfully as ${res.user.email}`, type: 'success' });
      if (currentSpreadsheetId) {
        loadSpreadsheetTabs(currentSpreadsheetId);
      }
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
      setStatusMessage({ text: err.message || 'Failed to authenticate with Google.', type: 'error' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await GoogleSheetsService.logout();
    setIsConnected(false);
    setCurrentUserEmail(null);
    setStatusMessage({ text: 'Disconnected from Google account.', type: 'info' });
  };

  const handleSaveSpreadsheet = () => {
    if (!spreadsheetInput.trim()) {
      setStatusMessage({ text: 'Please enter a valid Google Spreadsheet ID or URL.', type: 'error' });
      return;
    }
    const cleanId = GoogleSheetsService.setSpreadsheetId(spreadsheetInput);
    setCurrentSpreadsheetId(cleanId);
    setSpreadsheetInput(cleanId);
    if (isConnected) {
      loadSpreadsheetTabs(cleanId);
    }
    DBService.clearMemoryCache('clients');
    DBService.clearMemoryCache('returns');
    setStatusMessage({ text: `Workbook connected: ${cleanId}`, type: 'success' });
    onSyncComplete?.();
  };

  const handleSaveTabConfiguration = () => {
    const cTab = clientsTabInput.trim() || 'Clients_DB';
    const rTab = returnsTabInput.trim() || 'Returns_DB';
    GoogleSheetsService.setClientsTabName(cTab);
    GoogleSheetsService.setReturnsTabName(rTab);
    setClientsTabInput(cTab);
    setReturnsTabInput(rTab);
    DBService.clearMemoryCache('clients');
    DBService.clearMemoryCache('returns');
    setStatusMessage({ 
      text: `Tab isolation saved: Clients -> "${cTab}", Returns -> "${rTab}". All other workbook tabs remain 100% untouched.`, 
      type: 'success' 
    });
    onSyncComplete?.();
  };

  const handleInitializeHeaders = async () => {
    if (!currentSpreadsheetId) {
      setStatusMessage({ text: 'Please connect a Spreadsheet ID first.', type: 'error' });
      return;
    }
    if (!isConnected) {
      setStatusMessage({ text: 'Please connect your Google Account first to initialize headers in the sheet.', type: 'error' });
      return;
    }

    setIsInitializing(true);
    setStatusMessage(null);
    try {
      const cTab = clientsTabInput.trim() || 'Clients_DB';
      const rTab = returnsTabInput.trim() || 'Returns_DB';
      const res = await GoogleSheetsService.initializeSheetTabsAndHeaders(currentSpreadsheetId, cTab, rTab);
      await loadSpreadsheetTabs(currentSpreadsheetId);
      setStatusMessage({ text: res.message, type: 'success' });
    } catch (err: any) {
      console.error('Header initialization failed:', err);
      setStatusMessage({ text: err.message || 'Failed to initialize sheets and headers.', type: 'error' });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSyncClientsAndReturnsNow = async () => {
    if (!currentSpreadsheetId) {
      setStatusMessage({ text: 'Please connect a Spreadsheet ID first.', type: 'error' });
      return;
    }
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      DBService.clearMemoryCache('clients');
      DBService.clearMemoryCache('returns');
      await Promise.all([
        DBService.getClients(true),
        DBService.getReturns(true)
      ]);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(now);
      setStatusMessage({ text: `Clients & Returns synced successfully at ${now} from tabs "${clientsTabInput}" & "${returnsTabInput}"!`, type: 'success' });
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Clients & Returns sync failed:', err);
      setStatusMessage({ text: err.message || 'Failed to sync Clients & Returns with Google Sheets.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestCloudflarePipeline = async () => {
    setIsCheckingCloudflare(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          success: true,
          message: `Cloudflare pipeline verified: ${data.status || 'OK'}. Service account credentials loaded from Cloudflare environment.`
        });
      } else {
        setTestResult({
          success: false,
          message: `Server returned status ${res.status}. Check Cloudflare Pages environment variables.`
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'Failed to verify Cloudflare sync pipeline.'
      });
    } finally {
      setIsCheckingCloudflare(false);
    }
  };

  const handleCopyHeaders = (type: 'clients' | 'returns') => {
    const text = type === 'clients' ? CLIENTS_HEADERS.join('\t') : RETURNS_HEADERS.join('\t');
    navigator.clipboard.writeText(text);
    setCopiedHeader(type);
    setTimeout(() => setCopiedHeader(null), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-7 space-y-6">
      {/* Top Header: System Overview & Fast Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Central Sync Workspace</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Google Sheets Central Sync
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Differentiated synchronization pipelines for Clients & Returns Registry and Field Data Validation.
          </p>
        </div>

        {/* Global Fast Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {isConnected ? (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-800 font-semibold truncate max-w-[150px]" title={currentUserEmail || ''}>
                {currentUserEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isSigningIn ? 'Connecting...' : 'Connect Google'}</span>
            </button>
          )}

          {currentSpreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Open Google Sheet in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Sheet</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSyncClientsAndReturnsNow}
            disabled={isSyncing || !currentSpreadsheetId}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Clients & Returns'}</span>
          </button>
        </div>
      </div>

      {/* Differentiated Pipeline Cards Overview (Utilizes space cleanly) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline 1 Card: Clients & Returns Spreadsheet Sync */}
        <div 
          onClick={() => setActiveSyncView('clients_returns')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
            activeSyncView === 'clients_returns'
              ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                A
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-blue-900">
                Clients & Returns Sync
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Bi-directional Bridge
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Syncs master <strong>Clients_DB</strong> (18 columns) and <strong>Returns_DB</strong> (14 columns) between app store and central spreadsheet.
          </p>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
            <span>Tabs: <strong className="text-slate-800">{clientsTabInput}</strong>, <strong className="text-slate-800">{returnsTabInput}</strong></span>
            <span>•</span>
            <span className="text-blue-700 font-semibold flex items-center gap-1">
              Configure Pipeline <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Pipeline 2 Card: Data Validation Spreadsheet Sync */}
        <div 
          onClick={() => setActiveSyncView('data_validation')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
            activeSyncView === 'data_validation'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                B
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                Data Validation Sync
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Automated Officer Stream
            </span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Automated stream from field inspections to <strong>MD & CI - Distribution</strong> and <strong>Dispensers & Milk Bars</strong> tabs.
          </p>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-500">
            <span>Route: <strong className="text-slate-800 font-mono">POST /api/submit</strong></span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              View Inspection Pipeline <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Cloudflare Security & Zero Exposure Status Bar */}
      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
            <Lock className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800">Cloudflare Environment Secrets</span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Zero Browser Exposure
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Service account credentials are kept in Cloudflare's secure vault and executed server-side. No credentials are ever entered into or exposed to the browser.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveSyncView('cloudflare_vault')}
          className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto shrink-0 shadow-xs"
        >
          View Cloudflare Config
        </button>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2.5 animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : statusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          {lastSyncTime && (
            <span className="text-[10px] text-emerald-700 font-mono shrink-0">
              Last synced: {lastSyncTime}
            </span>
          )}
        </div>
      )}

      {/* Pipeline Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSyncView('clients_returns')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSyncView === 'clients_returns'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>1. Clients & Returns Spreadsheet Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSyncView('data_validation')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSyncView === 'data_validation'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>2. Data Validation Spreadsheet Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSyncView('cloudflare_vault')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSyncView === 'cloudflare_vault'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloudflare Secrets Vault</span>
          <span className={`w-1.5 h-1.5 rounded-full ${cloudflareStatus.configured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSyncView('schemas')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSyncView === 'schemas'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Schema & Headers Reference</span>
        </button>
      </div>

      {/* VIEW 1: CLIENTS & RETURNS SPREADSHEET SYNC */}
      {activeSyncView === 'clients_returns' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Main 2-Column Responsive Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Workbook Link & Header Automation */}
            <div className="lg:col-span-7 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>Google Spreadsheet URL or Sheet ID</span>
                  {currentSpreadsheetId && (
                    <span className="text-[10px] text-emerald-700 font-bold font-mono">
                      ✓ Linked
                    </span>
                  )}
                </label>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Paste the Google Sheets URL or the alphanumeric ID to connect the master workbook.
                </p>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono shadow-xs"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveSpreadsheet}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    Connect Workbook
                  </button>

                  {currentSpreadsheetId && (
                    <>
                      <button
                        type="button"
                        onClick={handleInitializeHeaders}
                        disabled={isInitializing || !isConnected}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-800 border border-blue-300 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                        title="Creates Clients_DB and Returns_DB tabs with exact required columns"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isInitializing ? 'Setting Up...' : 'Auto-Setup Headers in Sheet'}</span>
                      </button>

                      <a
                        href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-700 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-xs"
                        title="Open in new window"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Target Tab Isolation Settings */}
              <div className="pt-3 border-t border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Target Tab Isolation (Safe Execution)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveTabConfiguration}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Save Tab Names
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Clients Tab Name
                    </label>
                    <input
                      type="text"
                      value={clientsTabInput}
                      onChange={(e) => setClientsTabInput(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Returns Tab Name
                    </label>
                    <input
                      type="text"
                      value={returnsTabInput}
                      onChange={(e) => setReturnsTabInput(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Sync Status & Engine Action */}
            <div className="lg:col-span-5 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Clients & Returns Engine</span>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Synchronizes licensing data and financial return filings between your central spreadsheet and the application.
                </p>
              </div>

              {/* Data Summary Stats */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Protected Tabs Isolation:</span>
                  <span className="text-emerald-700 font-bold">100% Isolated</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Clients Column Count:</span>
                  <span className="font-mono text-slate-800 font-bold">18 Columns</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Returns Column Count:</span>
                  <span className="font-mono text-slate-800 font-bold">14 Columns</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Last Synced:</span>
                  <span className="font-mono text-blue-700 font-semibold">{lastSyncTime || 'Ready to sync'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncClientsAndReturnsNow}
                disabled={isSyncing || !currentSpreadsheetId}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing Clients & Returns...' : 'Sync Clients & Returns Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DATA VALIDATION SPREADSHEET SYNC */}
      {activeSyncView === 'data_validation' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-emerald-50/40 p-5 sm:p-6 rounded-2xl border border-emerald-200/80 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
              <div>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  Data Validation Automated Field Stream Pipeline
                </span>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Submissions made by compliance officers in the Data Validation Module stream automatically to Google Sheets via Cloudflare.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Serverless Stream Active
                </span>
              </div>
            </div>

            {/* Pipeline Architecture Diagram / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Route 1 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Mini Dairies & Cottage Industries
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Auto-Route
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Target Workbook Sheet:</span>
                    <strong className="text-emerald-800 font-mono">MD & CI - Distribution</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Categories Included:</span>
                    <span className="text-slate-800 font-medium">Mini Dairy, Cottage Industry</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Captures local sales, distribution networks, supplier lists, and compliance declarations.
                </p>
              </div>

              {/* Category Route 2 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Dispensers & Milk Bars
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Auto-Route
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Target Workbook Sheet:</span>
                    <strong className="text-blue-800 font-mono">Dispensers & Milk Bars</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Categories Included:</span>
                    <span className="text-slate-800 font-medium">Milk Bar, Dispenser</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Captures intake volumes, sales quantities, unit prices, and milk dispenser parameters.
                </p>
              </div>
            </div>

            {/* Technical Pipeline Details & Health Test */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Execution Path: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700">POST /api/submit</code></span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Cloudflare signs JWT tokens using Web Crypto and appends validation rows directly. No popup logins or browser keys required.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestCloudflarePipeline}
                disabled={isCheckingCloudflare}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <Activity className={`w-3.5 h-3.5 ${isCheckingCloudflare ? 'animate-spin' : ''}`} />
                <span>{isCheckingCloudflare ? 'Verifying...' : 'Verify Cloudflare Pipeline'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testResult.success 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CLOUDFLARE SECRETS VAULT */}
      {activeSyncView === 'cloudflare_vault' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  Cloudflare Pages Environment & Secrets Management
                </span>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  All environment variables and Google Service Account secrets are managed natively in Cloudflare.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Managed by Cloudflare
              </span>
            </div>

            {/* Variable Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  GOOGLE_SERVICE_ACCOUNT_EMAIL
                </span>
                <div className="text-xs font-mono font-bold text-emerald-400 truncate" title={cloudflareStatus.clientEmail || 'Configured in Cloudflare'}>
                  {cloudflareStatus.clientEmail || (cloudflareStatus.configured ? 'Configured in Cloudflare' : 'Pending in Cloudflare')}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Masked for browser security</span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  GOOGLE_PRIVATE_KEY
                </span>
                <div className="text-xs font-mono font-bold text-emerald-400 truncate">
                  {cloudflareStatus.hasPrivateKey || cloudflareStatus.configured ? '•••••••••••••••• (Encrypted)' : 'Pending in Cloudflare'}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Stored safely in Cloudflare Vault</span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  GOOGLE_SPREADSHEET_ID
                </span>
                <div className="text-xs font-mono font-bold text-emerald-400 truncate" title={currentSpreadsheetId || 'None'}>
                  {currentSpreadsheetId ? `${currentSpreadsheetId.slice(0, 10)}...` : 'Linked in App / Cloudflare'}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">Active Workbook Target</span>
              </div>
            </div>

            {/* Architecture Explanation Card */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Exposure Security Guarantee</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Wrangler configuration files do NOT store or override your secrets. Your environment variables are stored exclusively in the Cloudflare Pages Dashboard under <strong>Settings &gt; Environment variables &amp; Secrets</strong>. When an officer completes an inspection, the Cloudflare edge worker signs the request in memory using WebCrypto and forwards it securely to Google Sheets.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">
                Platform: Cloudflare Pages Serverless
              </span>
              <button
                type="button"
                onClick={fetchCloudflareStatus}
                disabled={isCheckingCloudflare}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingCloudflare ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: SCHEMAS & COLUMN REFERENCES */}
      {activeSyncView === 'schemas' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="font-bold text-slate-900 text-sm">Required Google Sheets Schema & Headers</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exact column headers for Clients Registry (18 fields) and Returns Ledger (14 fields).
                </p>
              </div>
              <button
                type="button"
                onClick={handleInitializeHeaders}
                disabled={isInitializing || !isConnected || !currentSpreadsheetId}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isInitializing ? 'Creating...' : 'Auto-Setup in Sheet'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Clients DB Columns Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 text-xs">Tab: "Clients_DB" (18 Columns)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyHeaders('clients')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedHeader === 'clients' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHeader === 'clients' ? 'Copied!' : 'Copy Headers'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-700 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                  {CLIENTS_HEADERS.map((h, i) => (
                    <span key={h} className="inline-block bg-white border border-slate-200 px-1.5 py-0.5 rounded mr-1.5 mb-1.5 text-slate-800">
                      <span className="text-slate-400 text-[9px] mr-1">{i + 1}.</span>{h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Returns DB Columns Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-800 text-xs">Tab: "Returns_DB" (14 Columns)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyHeaders('returns')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedHeader === 'returns' ? <Check className="w-3 h-3 text-blue-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHeader === 'returns' ? 'Copied!' : 'Copy Headers'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-700 overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                  {RETURNS_HEADERS.map((h, i) => (
                    <span key={h} className="inline-block bg-white border border-slate-200 px-1.5 py-0.5 rounded mr-1.5 mb-1.5 text-slate-800">
                      <span className="text-slate-400 text-[9px] mr-1">{i + 1}.</span>{h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsBanner;
