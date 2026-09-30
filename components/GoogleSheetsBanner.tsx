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
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Check
} from 'lucide-react';
import { GoogleSheetsService, CLIENTS_HEADERS, RETURNS_HEADERS } from '../services/googleSheetsService';
import { DBService } from '../services/db';

interface GoogleSheetsBannerProps {
  onSyncComplete?: () => void;
}

export const GoogleSheetsBanner: React.FC<GoogleSheetsBannerProps> = ({ onSyncComplete }) => {
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState('');
  const [clientsTabInput, setClientsTabInput] = useState('Clients_DB');
  const [returnsTabInput, setReturnsTabInput] = useState('Returns_DB');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [showTabSettings, setShowTabSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    try {
      const sId = GoogleSheetsService.getSpreadsheetId();
      setCurrentSpreadsheetId(sId);
      setSpreadsheetInput(sId);

      const cTab = GoogleSheetsService.getClientsTabName();
      const rTab = GoogleSheetsService.getReturnsTabName();
      setClientsTabInput(cTab);
      setReturnsTabInput(rTab);

      // Subscribe to auth state
      const unsubscribe = GoogleSheetsService.initAuth(
        (user, token) => {
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
      text: `Tab configuration saved! Clients -> "${cTab}", Returns -> "${rTab}". All other workbook tabs remain untouched.`, 
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
      setStatusMessage({ text: `Synced successfully from tabs "${clientsTabInput}" and "${returnsTabInput}"!`, type: 'success' });
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Sync failed:', err);
      setStatusMessage({ text: err.message || 'Failed to sync with Google Sheets.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-700/40">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left column: Status & Title */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Approach A Active: Google Sheets Database</span>
            </span>
            {currentSpreadsheetId && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Linked
              </span>
            )}
          </div>

          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Clients & Returns Live Database
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            Google Sheets functions as the primary database for the <strong className="text-white font-semibold">Clients Registry</strong> and <strong className="text-white font-semibold">Returns Module</strong>. Supabase remains dedicated to drafts, signatures, and storage buckets.
          </p>
        </div>

        {/* Right column: Google Account Status */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isConnected ? (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-200 font-medium truncate max-w-[160px]" title={currentUserEmail || ''}>
                {currentUserEmail}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
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
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isSigningIn ? 'Connecting...' : 'Connect Google Account'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTabSettings(!showTabSettings)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showTabSettings 
                ? 'bg-blue-600 text-white border-blue-400' 
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Configure which specific tabs to use so existing sheets remain untouched"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>Target Tabs ({clientsTabInput} / {returnsTabInput})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-200 text-xs font-semibold border border-emerald-600/40 transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Setup Schema</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Input and Action Controls */}
      <div className="mt-4 pt-4 border-t border-emerald-800/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-grow">
          <input
            type="text"
            value={spreadsheetInput}
            onChange={(e) => setSpreadsheetInput(e.target.value)}
            placeholder="Paste Google Spreadsheet ID or URL (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
            className="w-full bg-slate-950/60 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 font-mono"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveSpreadsheet}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          Connect Sheet
        </button>

        {currentSpreadsheetId && (
          <>
            <button
              type="button"
              onClick={handleInitializeHeaders}
              disabled={isInitializing || !isConnected}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
              title="Automatically creates 'Clients' and 'Returns' tabs with all required headers"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isInitializing ? 'Setting Up...' : 'Auto-Setup Tabs & Headers'}</span>
            </button>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <a
              href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Open Google Sheet in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </>
        )}
      </div>

      {/* Status Message Feedback */}
      {statusMessage && (
        <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' 
            : statusMessage.type === 'error'
            ? 'bg-rose-500/20 text-rose-200 border border-rose-500/30'
            : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
        }`}>
          {statusMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Target Tabs Configuration Panel */}
      {showTabSettings && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-blue-500/30 text-xs space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Target Tab Isolation Settings
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Specify which sheet tabs the app reads and writes to. All other tabs in your workbook (including any existing custom clients or returns tabs) will remain <strong className="text-emerald-400 font-semibold">100% untouched</strong>.
              </p>
            </div>
            {availableTabs.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700 whitespace-nowrap">
                Found {availableTabs.length} tabs in workbook
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Clients Tab Name */}
            <div className="space-y-1.5">
              <label className="font-semibold text-emerald-300 flex items-center justify-between">
                <span>Clients Database Tab:</span>
                <span className="text-[10px] text-slate-400 font-normal">Default: Clients_DB</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientsTabInput}
                  onChange={(e) => setClientsTabInput(e.target.value)}
                  placeholder="e.g. Clients_DB or KDB_Clients"
                  className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-400 focus:outline-none"
                />
              </div>
              {availableTabs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                  <span>Quick pick:</span>
                  {availableTabs.slice(0, 5).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setClientsTabInput(tab)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${clientsTabInput === tab ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Returns Tab Name */}
            <div className="space-y-1.5">
              <label className="font-semibold text-blue-300 flex items-center justify-between">
                <span>Returns Database Tab:</span>
                <span className="text-[10px] text-slate-400 font-normal">Default: Returns_DB</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={returnsTabInput}
                  onChange={(e) => setReturnsTabInput(e.target.value)}
                  placeholder="e.g. Returns_DB or KDB_Returns"
                  className="flex-grow bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-400 focus:outline-none"
                />
              </div>
              {availableTabs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                  <span>Quick pick:</span>
                  {availableTabs.slice(0, 5).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setReturnsTabInput(tab)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${returnsTabInput === tab ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Isolated read & write protection active.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveTabConfiguration}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Save Tab Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Guide Dropdown */}
      {showGuide && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-sm">Required Google Sheets Schema</span>
            <span className="text-[11px] text-emerald-400">Tip: Click "Auto-Setup Tabs & Headers" to create automatically!</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="font-bold text-emerald-300">Tab 1: "Clients" (18 Columns):</span>
              <div className="p-2 mt-1 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-nowrap">
                {CLIENTS_HEADERS.join(' | ')}
              </div>
            </div>

            <div>
              <span className="font-bold text-blue-300">Tab 2: "Returns" (14 Columns):</span>
              <div className="p-2 mt-1 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-nowrap">
                {RETURNS_HEADERS.join(' | ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
