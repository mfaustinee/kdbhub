import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Key, 
  Sparkles, 
  LogOut, 
  Database,
  ShieldCheck, 
  HelpCircle, 
  Check, 
  Copy, 
  Layers,
  ArrowUpRight,
  ClipboardList
} from 'lucide-react';
import { GoogleSheetsService, CLIENTS_HEADERS, RETURNS_HEADERS } from '../services/googleSheetsService';
import { DBService } from '../services/db';

interface GoogleSheetsBannerProps {
  onSyncComplete?: () => void;
}

export const GoogleSheetsBanner: React.FC<GoogleSheetsBannerProps> = ({ onSyncComplete }) => {
  // Spreadsheet Connection State
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState('');
  const [clientsTabInput, setClientsTabInput] = useState('Clients_DB');
  const [returnsTabInput, setReturnsTabInput] = useState('Returns_DB');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [copiedHeader, setCopiedHeader] = useState<'clients' | 'returns' | null>(null);

  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'credentials' | 'tabs' | 'schema'>('overview');
  
  // Service Account Credentials State (Restored for Data Validation automated sync)
  const [serverCreds, setServerCreds] = useState<{ configured: boolean; clientEmail?: string; spreadsheetId?: string; hasPrivateKey?: boolean }>({ configured: false });
  const [jsonCredentialsInput, setJsonCredentialsInput] = useState('');
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credsSaveMessage, setCredsSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadServerCredentials = async () => {
    try {
      const res = await fetch('/api/google-credentials');
      if (res.ok) {
        const data = await res.json();
        setServerCreds(data);
        if (data.clientEmail) setClientEmailInput(data.clientEmail);
        if (data.spreadsheetId && !currentSpreadsheetId) {
          setCurrentSpreadsheetId(data.spreadsheetId);
          setSpreadsheetInput(data.spreadsheetId);
        }
      }
    } catch (e) {
      console.warn('Error loading server credentials:', e);
    }
  };

  useEffect(() => {
    loadServerCredentials();
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

      // Subscribe to auth state
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
      console.warn('[GoogleSheetsBanner] init notice:', e);
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
    setStatusMessage({ text: `Spreadsheet connected: ${cleanId}`, type: 'success' });
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
      text: `Tab configuration saved: Clients -> "${cTab}", Returns -> "${rTab}". All other workbook tabs remain untouched.`, 
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
      setStatusMessage({ text: 'Please connect your Google Account first.', type: 'error' });
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

  const handleSaveServerCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCreds(true);
    setCredsSaveMessage(null);
    try {
      const payload: any = {
        spreadsheetId: spreadsheetInput.trim() || currentSpreadsheetId
      };

      if (jsonCredentialsInput.trim()) {
        payload.serviceAccountJson = jsonCredentialsInput.trim();
      } else {
        payload.clientEmail = clientEmailInput.trim();
        payload.privateKey = privateKeyInput.trim();
      }

      const res = await fetch('/api/google-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.details || data.error || 'Failed to save credentials');
      }

      setServerCreds({
        configured: data.configured,
        clientEmail: data.clientEmail,
        spreadsheetId: data.spreadsheetId,
        hasPrivateKey: true
      });

      if (data.spreadsheetId) {
        GoogleSheetsService.setSpreadsheetId(data.spreadsheetId);
        setCurrentSpreadsheetId(data.spreadsheetId);
      }

      setCredsSaveMessage({
        text: `Credentials saved successfully! Status: ${data.testStatus || 'verified'}. Data Validation automated sync is active!`,
        type: 'success'
      });
      setJsonCredentialsInput('');
      setPrivateKeyInput('');
      onSyncComplete?.();
    } catch (err: any) {
      setCredsSaveMessage({
        text: err.message || 'Failed to save Google credentials.',
        type: 'error'
      });
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleSyncNow = async () => {
    if (!currentSpreadsheetId) {
      setStatusMessage({ text: 'Please enter a Spreadsheet ID first.', type: 'error' });
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
      setStatusMessage({ text: `Synced successfully from tabs "${clientsTabInput}" and "${returnsTabInput}" at ${now}!`, type: 'success' });
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Sync failed:', err);
      setStatusMessage({ text: err.message || 'Failed to sync with Google Sheets.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyHeaders = (type: 'clients' | 'returns') => {
    const text = type === 'clients' ? CLIENTS_HEADERS.join('\t') : RETURNS_HEADERS.join('\t');
    navigator.clipboard.writeText(text);
    setCopiedHeader(type);
    setTimeout(() => setCopiedHeader(null), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-7">
      {/* Top Workspace Command Bar Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase tracking-wider mb-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Master Database & Data Validation Sync Hub</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            Google Sheets Central Sync
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Central repository for Clients Registry, Financial Returns Ledger, and automated officer field inspection submissions.
          </p>
        </div>

        {/* Global Fast Action Controls */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {isConnected ? (
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-800 font-semibold truncate max-w-[160px]" title={currentUserEmail || ''}>
                {currentUserEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-1"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Open Google Sheet in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Sheet</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing || !currentSpreadsheetId}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Records'}</span>
          </button>
        </div>
      </div>

      {/* Differentiated Sync Pipeline Summary Grid (Spacious 3-column layout) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Workbook Link */}
        <div className={`p-5 rounded-2xl border transition-all ${
          currentSpreadsheetId ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">1. Master Workbook Link</span>
            {currentSpreadsheetId ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            )}
          </div>
          <div className="text-xs font-bold text-slate-900 truncate" title={currentSpreadsheetId || 'Not connected'}>
            {currentSpreadsheetId ? `ID: ${currentSpreadsheetId.slice(0, 16)}...` : 'No Sheet Connected'}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
            {currentSpreadsheetId ? 'Primary Master Linked' : 'Connect Spreadsheet ID below'}
          </span>
        </div>

        {/* Metric 2: Data Validation Service Account */}
        <div className={`p-5 rounded-2xl border transition-all ${
          serverCreds.configured ? 'bg-blue-50/50 border-blue-200' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">2. Data Validation Sync</span>
            <span className={`w-2.5 h-2.5 rounded-full ${serverCreds.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {serverCreds.configured ? 'Active & Verified' : 'Credentials Missing'}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
            {serverCreds.configured ? 'Field Inspections Auto-Stream Ready' : 'Service account key required'}
          </span>
        </div>

        {/* Metric 3: Target Tabs Isolation */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">3. Target Tabs Isolation</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {clientsTabInput} / {returnsTabInput}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1.5 block">
            Existing workbook tabs protected
          </span>
        </div>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : statusMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          {lastSyncTime && (
            <span className="text-[11px] text-emerald-700 font-mono shrink-0">
              Last synced: {lastSyncTime}
            </span>
          )}
        </div>
      )}

      {/* Workspace Segmented Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Connection & Live Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'credentials'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Service Account Keys (Data Validation Sync)</span>
          <span className={`w-2 h-2 rounded-full ${serverCreds.configured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tabs')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'tabs'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Target Tab Isolation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'schema'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Schema & Headers Reference</span>
        </button>
      </div>

      {/* TAB 1: CONNECTION & LIVE SYNC OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Main 2-Column Responsive Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Spreadsheet ID Input & Actions */}
            <div className="lg:col-span-7 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>Google Spreadsheet URL or Sheet ID</span>
                  {currentSpreadsheetId && (
                    <span className="text-[11px] text-emerald-700 font-bold font-mono">
                      ✓ Active
                    </span>
                  )}
                </label>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Paste the browser link from your Google Sheet or the alphanumeric ID from between /d/ and /edit.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono shadow-xs"
                />

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveSpreadsheet}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    Connect Spreadsheet
                  </button>

                  {currentSpreadsheetId && (
                    <>
                      <button
                        type="button"
                        onClick={handleInitializeHeaders}
                        disabled={isInitializing || !isConnected}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
                        title="Creates Clients_DB and Returns_DB tabs with exact required columns"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isInitializing ? 'Creating...' : 'Auto-Setup Headers'}</span>
                      </button>

                      <a
                        href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-xs"
                        title="Open in new window"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Engine Sync Status & Quick Navigation */}
            <div className="lg:col-span-5 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80 space-y-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sync Engine & Cache</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Syncing pulls fresh records from Google Sheets into memory and local storage, ensuring fast queries across reports and validation forms.
                </p>
              </div>

              {/* Service Account Quick Badge / Jump Card */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    Data Validation Sync
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    serverCreds.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {serverCreds.configured ? 'Active' : 'Setup Needed'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {serverCreds.configured 
                    ? `Authenticated as: ${serverCreds.clientEmail || 'Service Account'}`
                    : 'Configure service account credentials so inspection submissions sync automatically without popup logins.'
                  }
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('credentials')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer pt-0.5"
                >
                  <span>{serverCreds.configured ? 'Manage Credentials' : 'Set Up Service Account'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {lastSyncTime ? `Last sync: ${lastSyncTime}` : 'Cache active'}
                </span>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing || !currentSpreadsheetId}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Records</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE ACCOUNT CREDENTIALS (Restored for Data Validation Sync) */}
      {activeTab === 'credentials' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-5">
            <div>
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                Google Service Account Credentials (For Data Validation & Automated Sync)
              </span>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Grants the system write permissions to your Google Sheet for inspection forms without requiring interactive login popups.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                serverCreds.configured 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {serverCreds.configured ? 'Status: Active & Verified' : 'Status: Credentials Missing'}
              </span>
            </div>
          </div>

          {credsSaveMessage && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
              credsSaveMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {credsSaveMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
              {credsSaveMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{credsSaveMessage.text}</span>
            </div>
          )}

          {/* 2-Column Responsive Key Input Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Option 1: Fast Service Account JSON Key Paste */}
            <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Option 1: Paste Service Account JSON</span>
                <span className="text-[10px] text-emerald-600 font-bold">Fastest</span>
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Directly paste your Google Cloud service account JSON file contents. Email and private key are automatically extracted.
              </p>
              <textarea
                rows={6}
                value={jsonCredentialsInput}
                onChange={(e) => setJsonCredentialsInput(e.target.value)}
                placeholder='{ "type": "service_account", "client_email": "...", "private_key": "-----BEGIN PRIVATE KEY-----..." }'
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none placeholder-slate-400"
              />
            </div>

            {/* Option 2: Manual Email & Private Key */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Option 2: Manual Credentials Entry
                </label>
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">Client Email:</span>
                    <input
                      type="text"
                      value={clientEmailInput}
                      onChange={(e) => setClientEmailInput(e.target.value)}
                      placeholder="app-service@project.iam.gserviceaccount.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">Private Key (PEM):</span>
                    <textarea
                      rows={3}
                      value={privateKeyInput}
                      onChange={(e) => setPrivateKeyInput(e.target.value)}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:border-amber-500 focus:outline-none placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-1 text-[11px] text-slate-400">
                Credentials are saved securely and verified against the Google Sheets API.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-amber-200/80">
            <p className="text-xs text-slate-600 font-medium">
              Important: Ensure you share your Google Sheet with Editor permission to your Service Account Client Email!
            </p>
            <button
              type="button"
              onClick={handleSaveServerCredentials}
              disabled={isSavingCreds}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isSavingCreds ? 'Verifying & Saving...' : 'Save & Verify Credentials'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: TARGET TABS & ISOLATION */}
      {activeTab === 'tabs' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-blue-50/40 border border-blue-200/80 text-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
            <div>
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                Target Tab Isolation Settings
              </span>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Specify sheet tab names. All other tabs in your workbook remain <strong className="text-emerald-700 font-semibold">100% untouched</strong>.
              </p>
            </div>
            {availableTabs.length > 0 && (
              <span className="text-[11px] bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-bold whitespace-nowrap shadow-xs">
                Found {availableTabs.length} tabs in workbook
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Clients Tab Name */}
            <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>Clients Database Tab</span>
                <span className="text-[11px] text-slate-400 font-normal">Default: Clients_DB</span>
              </label>
              <input
                type="text"
                value={clientsTabInput}
                onChange={(e) => setClientsTabInput(e.target.value)}
                placeholder="e.g. Clients_DB or KDB_Clients"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-none"
              />
              {availableTabs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 pt-1">
                  <span>Quick pick:</span>
                  {availableTabs.slice(0, 5).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setClientsTabInput(tab)}
                      className={`px-2.5 py-0.5 rounded-md border font-medium transition-colors cursor-pointer ${
                        clientsTabInput === tab 
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold' 
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Returns Tab Name */}
            <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>Returns Database Tab</span>
                <span className="text-[11px] text-slate-400 font-normal">Default: Returns_DB</span>
              </label>
              <input
                type="text"
                value={returnsTabInput}
                onChange={(e) => setReturnsTabInput(e.target.value)}
                placeholder="e.g. Returns_DB or KDB_Returns"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:border-blue-500 focus:outline-none"
              />
              {availableTabs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 pt-1">
                  <span>Quick pick:</span>
                  {availableTabs.slice(0, 5).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setReturnsTabInput(tab)}
                      className={`px-2.5 py-0.5 rounded-md border font-medium transition-colors cursor-pointer ${
                        returnsTabInput === tab 
                          ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold' 
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data Validation Category Routing Reference */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-xs">
              Data Validation Category Sheets (Auto-Routed):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-800 block">MD & CI - Distribution</span>
                <span className="text-[11px] text-slate-500">Mini Dairy & Cottage Industry inspections</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-800 block">Dispensers & Milk Bars</span>
                <span className="text-[11px] text-slate-500">Milk Bar & Dispenser inspections</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-blue-100">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Isolated read & write protection active.</span>
            </div>

            <button
              type="button"
              onClick={handleSaveTabConfiguration}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              Save Tab Mapping
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: SCHEMA & COLUMN REFERENCE */}
      {activeTab === 'schema' && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="font-bold text-slate-900 text-sm">Required Google Sheets Schema</span>
              <p className="text-xs text-slate-500 mt-1">
                Exact column headers expected by the system for Clients and Returns import/export.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInitializeHeaders}
              disabled={isInitializing || !isConnected || !currentSpreadsheetId}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isInitializing ? 'Creating...' : 'Auto-Setup in Sheet'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clients DB Columns Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 text-xs">Tab: "Clients_DB" (18 Columns)</span>
                <button
                  type="button"
                  onClick={() => handleCopyHeaders('clients')}
                  className="px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedHeader === 'clients' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHeader === 'clients' ? 'Copied!' : 'Copy Headers'}</span>
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                {CLIENTS_HEADERS.map((h, i) => (
                  <span key={h} className="inline-block bg-white border border-slate-200 px-2 py-0.5 rounded mr-1.5 mb-1.5 text-slate-800">
                    <span className="text-slate-400 text-[10px] mr-1">{i + 1}.</span>{h}
                  </span>
                ))}
              </div>
            </div>

            {/* Returns DB Columns Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-800 text-xs">Tab: "Returns_DB" (14 Columns)</span>
                <button
                  type="button"
                  onClick={() => handleCopyHeaders('returns')}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedHeader === 'returns' ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHeader === 'returns' ? 'Copied!' : 'Copy Headers'}</span>
                </button>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                {RETURNS_HEADERS.map((h, i) => (
                  <span key={h} className="inline-block bg-white border border-slate-200 px-2 py-0.5 rounded mr-1.5 mb-1.5 text-slate-800">
                    <span className="text-slate-400 text-[10px] mr-1">{i + 1}.</span>{h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsBanner;
