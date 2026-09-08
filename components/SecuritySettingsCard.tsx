import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Globe, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Bot, 
  FileText 
} from 'lucide-react';
import { useAuth } from '../src/contexts/AuthContext';

export const SecuritySettingsCard: React.FC = () => {
  const { user } = useAuth();

  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [allowedIps, setAllowedIps] = useState<string[]>(['127.0.0.1', '::1']);
  const [detectedClientIp, setDetectedClientIp] = useState<string>('');
  const [isCurrentIpAllowed, setIsCurrentIpAllowed] = useState(true);
  const [newIpInput, setNewIpInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/security/config');
      if (res.ok) {
        const data = await res.json();
        setIpWhitelistEnabled(Boolean(data.ipWhitelistEnabled));
        setAllowedIps(Array.isArray(data.allowedIps) ? data.allowedIps : ['127.0.0.1', '::1']);
        setDetectedClientIp(data.detectedClientIp || '');
        setIsCurrentIpAllowed(Boolean(data.isCurrentIpAllowed));
      }
    } catch (e) {
      console.warn('[Security] Could not fetch security config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (updatedEnabled: boolean, updatedIps: string[]) => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/security/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipWhitelistEnabled: updatedEnabled,
          allowedIps: updatedIps
        })
      });

      if (res.ok) {
        setStatusMessage({ text: 'Security configuration saved and applied.', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ text: 'Failed to update security configuration.', type: 'error' });
      }
    } catch (e: any) {
      setStatusMessage({ text: e?.message || 'Error updating security settings.', type: 'error' });
    } finally {
      setIsSaving(false);
      fetchConfig();
    }
  };

  const handleToggleWhitelist = () => {
    const nextVal = !ipWhitelistEnabled;
    // Safety check: Ensure current IP is in whitelist before enabling
    let nextIps = [...allowedIps];
    if (nextVal && detectedClientIp && !nextIps.includes(detectedClientIp)) {
      nextIps.push(detectedClientIp);
      setAllowedIps(nextIps);
    }
    setIpWhitelistEnabled(nextVal);
    handleSave(nextVal, nextIps);
  };

  const handleAddIp = () => {
    const clean = newIpInput.trim();
    if (!clean) return;
    if (allowedIps.includes(clean)) {
      setStatusMessage({ text: 'IP address is already in the authorized list.', type: 'error' });
      return;
    }
    const updated = [...allowedIps, clean];
    setAllowedIps(updated);
    setNewIpInput('');
    handleSave(ipWhitelistEnabled, updated);
  };

  const handleAddCurrentIp = () => {
    if (!detectedClientIp || allowedIps.includes(detectedClientIp)) return;
    const updated = [...allowedIps, detectedClientIp];
    setAllowedIps(updated);
    handleSave(ipWhitelistEnabled, updated);
  };

  const handleRemoveIp = (ipToRemove: string) => {
    const updated = allowedIps.filter(ip => ip !== ipToRemove);
    setAllowedIps(updated);
    handleSave(ipWhitelistEnabled, updated);
  };

  return (
    <div className="space-y-6 bg-slate-50 p-6 sm:p-8 rounded-[32px] border border-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Admin Endpoint Security & Layer Controls</span>
            </h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              Active & Enforced
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hardened security controls for administrator endpoints, crawler suppression, and IP-level access authorization.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={fetchConfig}
          className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Security Checklist Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* Control 1: Bot Blocking */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Active
            </span>
          </div>
          <div className="text-xs font-bold text-slate-800">Bot & Crawler Blocking</div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <code>robots.txt</code> blocks search engine spiders from indexing <code>/admin</code>, <code>/api/*</code>, and administrative endpoints.
          </p>
        </div>

        {/* Control 2: HTTP Headers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              Enforced
            </span>
          </div>
          <div className="text-xs font-bold text-slate-800">HTTP Header Controls</div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Injected <code>X-Robots-Tag: noindex, nofollow</code>, <code>Cache-Control: no-store</code>, and <code>X-Frame-Options</code> on all admin routes.
          </p>
        </div>

        {/* Control 3: Rate Limiting */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              5 Max / 15m
            </span>
          </div>
          <div className="text-xs font-bold text-slate-800">Rate Limiting & Lockout</div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Automatic 15-minute account lockout after 5 consecutive failed login attempts to thwart brute-force password guessing.
          </p>
        </div>
      </div>

      {/* IP Whitelisting Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-700" />
              <h5 className="text-sm font-bold text-slate-900">Static IP Whitelisting</h5>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                ipWhitelistEnabled 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {ipWhitelistEnabled ? 'Whitelisting Active' : 'Allow All IPs'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              When enabled, only connections originating from specified static IP addresses or CIDR subnets can access the administrator portal.
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleToggleWhitelist}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              ipWhitelistEnabled ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                ipWhitelistEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Detected IP Banner */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-600 font-medium">Your Detected Client IP:</span>
            <code className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {detectedClientIp || '127.0.0.1'}
            </code>
            {allowedIps.includes(detectedClientIp) ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Authorized
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Not Whitelisted
              </span>
            )}
          </div>

          {detectedClientIp && !allowedIps.includes(detectedClientIp) && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleAddCurrentIp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add My IP to Whitelist</span>
            </button>
          )}
        </div>

        {/* Authorized IP List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Authorized Static IP Addresses & Subnets ({allowedIps.length})
            </label>
          </div>

          {/* Add IP Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 197.232.10.45 or 192.168.1.*"
              value={newIpInput}
              onChange={(e) => setNewIpInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddIp(); } }}
              className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono"
            />
            <button
              type="button"
              disabled={isSaving || !newIpInput.trim()}
              onClick={handleAddIp}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Static IP</span>
            </button>
          </div>

          {/* IP Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {allowedIps.map((ip) => {
              const isCurrent = ip === detectedClientIp;
              return (
                <div
                  key={ip}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                    isCurrent 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <span>{ip}</span>
                  {isCurrent && (
                    <span className="text-[9px] font-sans font-bold bg-emerald-200/60 text-emerald-800 px-1.5 py-0.2 rounded">
                      You
                    </span>
                  )}
                  {allowedIps.length > 1 && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleRemoveIp(ip)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                      title="Remove IP"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsCard;
