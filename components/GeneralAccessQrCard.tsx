import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  ExternalLink, 
  ShieldCheck, 
  Smartphone, 
  Globe,
  Radio
} from 'lucide-react';

export const GeneralAccessQrCard: React.FC = () => {
  const [targetRoute, setTargetRoute] = useState<string>('/portal');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://ais-dev-zlwayvxgrumdy6a2ldbvpr-24052486787.europe-west2.run.app';

  const fullUrl = `${origin}${targetRoute}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = fullUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 600;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 600);
        ctx.drawImage(img, 50, 50, 500, 500);
        const a = document.createElement('a');
        a.download = `kdb-general-portal-qr.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const svg = qrRef.current?.querySelector('svg');
    const svgHtml = svg ? svg.outerHTML : '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kenya Dairy Board - General Access QR Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              color: #0f172a;
              text-align: center;
            }
            .card {
              border: 2px solid #0f172a;
              border-radius: 24px;
              padding: 40px;
              max-width: 480px;
              background: #ffffff;
            }
            h1 { font-size: 20px; font-weight: 900; margin: 0 0 6px 0; }
            h2 { font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 24px 0; }
            .qr-wrap { display: flex; justify-content: center; margin: 24px 0; }
            p { font-size: 12px; color: #475569; margin: 8px 0; line-height: 1.5; }
            .url { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; word-break: break-all; margin-top: 16px; }
            .badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>KENYA DAIRY BOARD</h1>
            <h2>Regulatory Operations & Client Portal</h2>
            <div class="qr-wrap">${svgHtml}</div>
            <p>Scan with any smartphone or tablet camera to access the official Kenya Dairy Board portal.</p>
            <div class="badge">Permanent Access • No Expiration Timer</div>
            <div class="url">${fullUrl}</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                General System Access QR Code
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Permanent • No Timer
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Permanent, timer-free scannable QR code for office front-desks, vehicle badges, and field inspections.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* QR Display */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <div 
            ref={qrRef}
            className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center"
          >
            <QRCodeSVG 
              value={fullUrl} 
              size={180} 
              level="M" 
              includeMargin={true} 
            />
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Active & Permanent (No Timer)</span>
          </div>
        </div>

        {/* Route Selector & Action Controls */}
        <div className="lg:col-span-8 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Select Portal Target Destination
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { route: '/portal', label: 'Public Portals Hub', desc: 'Main hub for agreements, closures, inquiries & complaints' },
                { route: '/data-validation', label: 'Data Validation Module', desc: 'Direct officer access to pre-flight recon and inspections' },
                { route: '/scope-disclosure', label: 'Scope of Inspection Disclosure', desc: 'Stand-alone statutory disclosure for operators' },
                { route: '/payment-agreement', label: 'Levy Arrears Agreement Portal', desc: 'Debtor execution and installment scheduling' }
              ].map(opt => {
                const isSelected = targetRoute === opt.route;
                return (
                  <button
                    key={opt.route}
                    type="button"
                    onClick={() => setTargetRoute(opt.route)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-600"></div>}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Target URL
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 truncate select-all">
                {fullUrl}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
                title="Copy link to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Poster Card</span>
            </button>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Link</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralAccessQrCard;
