import React from 'react';
import { 
  FileCheck, 
  Calendar, 
  UserCheck, 
  Sparkles, 
  MessageSquareQuote,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface CommentsAndCorrectiveActionsComponentProps {
  comments: string;
  recommendedActions: string;
  actionDueDate?: string;
  actionOwner?: string;
  mirroredDirectives?: string[];
  exceptionObservations?: Array<{
    id: string;
    type: string;
    observation: string;
    definition?: string;
    source?: string;
  }>;
  onSyncMirroredDirectives?: () => void;
  onChange: (fields: {
    comments?: string;
    recommendedActions?: string;
    actionDueDate?: string;
    actionOwner?: string;
  }) => void;
  readOnly?: boolean;
}

export const CommentsAndCorrectiveActionsComponent: React.FC<CommentsAndCorrectiveActionsComponentProps> = ({
  comments,
  recommendedActions,
  actionDueDate = '',
  actionOwner = '',
  mirroredDirectives = [],
  exceptionObservations = [],
  onSyncMirroredDirectives,
  onChange,
  readOnly = false
}) => {
  const handleAppendDirective = (directiveText: string) => {
    if (readOnly) return;
    const trimmed = (recommendedActions || '').trim();
    if (!trimmed) {
      onChange({ recommendedActions: `• ${directiveText}` });
    } else {
      // Don't duplicate if already present in the recommended actions
      if (trimmed.includes(directiveText)) return;
      onChange({ recommendedActions: `${trimmed}\n• ${directiveText}` });
    }
  };

  // Automatically derive smart directives based on specific issues identified
  const generatedDirectives = React.useMemo(() => {
    const list: string[] = [];
    const added = new Set<string>();

    const addUnique = (d: string) => {
      const clean = d.trim();
      if (clean && !added.has(clean)) {
        added.add(clean);
        list.push(clean);
      }
    };

    exceptionObservations.forEach(obs => {
      const type = (obs.type || '').toLowerCase();
      const text = `${obs.observation || ''} ${obs.definition || ''}`.toLowerCase();

      if (text.includes('non-declaration') || text.includes('unfiled') || text.includes('not filed')) {
        addUnique('File outstanding monthly returns and settle full undeclared levy within 14 days');
      } else if (text.includes('under-declaration') || type.includes('arrears') || text.includes('arrears')) {
        addUnique('Remit identified volume variance levy arrears and submit updated reconciliation within 14 days');
      }

      if (type.includes('missing') || text.includes('missing') || text.includes('cannot be located')) {
        addUnique('Furnish missing delivery notes, invoices, and physical dispatch records within 7 days');
      }

      if (type.includes('incomplete') || text.includes('incomplete') || text.includes('missing data')) {
        addUnique('Complete and standardize all mandatory daily intake and sales register entries');
      }

      if (type.includes('conflict') || text.includes('conflict') || text.includes('discrepan')) {
        addUnique('Harmonize premise intake registers with submitted monthly returns to resolve identified discrepancies');
      }

      if (type.includes('late') || text.includes('late') || text.includes('deadline')) {
        addUnique('Adhere to statutory filing deadlines by submitting monthly returns on or before the 10th of every month');
      }

      if (text.includes('permit') || text.includes('licen') || type.includes('permit')) {
        addUnique('Display valid KDB operating permit conspicuously at the premise at all times');
      }

      if (text.includes('branch') || text.includes('cooling plant') || text.includes('dispenser')) {
        addUnique('Ensure all subsidiary dispensing points and branch facilities maintain accurate intake manifests');
      }
    });

    return list;
  }, [exceptionObservations]);

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden" id="comments-and-recommendations-section">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            5.2
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900">
              Comments & Recommendations
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Record overall compliance observations, officer remarks, and corrective directives issued to the DBO.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Comments & Observations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-slate-500" />
                <span>General Comments & Compliance Observations</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Officer Notes</span>
            </div>
            <textarea
              name="comments"
              value={comments}
              onChange={(e) => onChange({ comments: e.target.value })}
              disabled={readOnly}
              rows={7}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs text-slate-800 leading-relaxed transition-all placeholder:text-slate-400"
              placeholder="Record overall compliance observations, premise hygiene, cooperation of operator, record-keeping standards, or general validation remarks..."
            />
          </div>

          {/* Right Column: Corrective Actions & Directives */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Corrective Actions & Directives</span>
              </label>
              <div className="flex items-center gap-1.5">
                {mirroredDirectives && mirroredDirectives.length > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1" title="Mirrored from the Exceptions Register above">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    Mirrored ({mirroredDirectives.length})
                  </span>
                )}
                {onSyncMirroredDirectives && (
                  <button
                    type="button"
                    onClick={onSyncMirroredDirectives}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Re-synchronize directives with the Exceptions Register above"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Re-sync
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Directives are mirrored from <strong>Corrective Action Required</strong> in the Exceptions Register above. You can freely edit them or append additional directives below.
            </p>

            <textarea
              name="recommendedActions"
              value={recommendedActions}
              onChange={(e) => onChange({ recommendedActions: e.target.value })}
              disabled={readOnly}
              rows={7}
              className="w-full px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50/20 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-medium text-slate-800 leading-relaxed transition-all placeholder:text-slate-400"
              placeholder="Directives mirrored from Exceptions Register. You have full room to add more manual directives or notes here..."
            />
          </div>
        </div>

        {/* Auto-Generated Directives from Identified Issues */}
        {!readOnly && generatedDirectives.length > 0 && (
          <div className="space-y-1.5 pt-1 p-3 bg-amber-50/60 rounded-2xl border border-amber-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Issue-Specific Directives (Auto-Generated • Click to Append):</span>
              </div>
              <span className="text-[10px] text-amber-700 font-medium">{generatedDirectives.length} available</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {generatedDirectives.map((directive, idx) => {
                const isAppended = (recommendedActions || '').includes(directive);
                return (
                  <button
                    key={`gen-${idx}`}
                    type="button"
                    onClick={() => handleAppendDirective(directive)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all text-left cursor-pointer flex items-center gap-1.5 ${
                      isAppended
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                        : 'bg-white hover:bg-amber-100 hover:border-amber-400 text-slate-800 border-amber-200 shadow-2xs'
                    }`}
                  >
                    <span>{isAppended ? '✓' : '+'}</span>
                    <span>{directive}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline & Ownership Sub-fields */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Resolution Date</span>
            </label>
            <input
              type="date"
              value={actionDueDate}
              onChange={(e) => onChange({ actionDueDate: e.target.value })}
              disabled={readOnly}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs text-slate-800 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Responsible Person / DBO Representative</span>
              <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              value={actionOwner}
              onChange={(e) => onChange({ actionOwner: e.target.value })}
              disabled={readOnly}
              placeholder="e.g. Managing Director / Proprietor"
              className={`w-full px-3.5 py-2.5 rounded-xl border ${!actionOwner?.trim() ? 'border-amber-300 focus:border-red-500 bg-amber-50/20' : 'border-slate-200 focus:border-blue-500 bg-white'} outline-none text-xs text-slate-800 transition-colors`}
              id="comments-action-owner-input"
            />
            {!actionOwner?.trim() && (
              <p className="text-[10px] text-amber-600 font-medium">Mandatory: Please state the responsible DBO representative or facility owner.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
