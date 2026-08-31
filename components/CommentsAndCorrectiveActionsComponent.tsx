import React from 'react';
import { 
  FileCheck, 
  AlertTriangle, 
  Calendar, 
  UserCheck, 
  Sparkles, 
  MessageSquareQuote,
  ShieldCheck
} from 'lucide-react';
import { ExceptionRegisterItem } from '../types';

interface CommentsAndCorrectiveActionsComponentProps {
  comments: string;
  recommendedActions: string;
  actionDueDate?: string;
  actionOwner?: string;
  exceptions?: ExceptionRegisterItem[];
  onChange: (fields: {
    comments?: string;
    recommendedActions?: string;
    actionDueDate?: string;
    actionOwner?: string;
  }) => void;
  readOnly?: boolean;
}

const QUICK_DIRECTIVES = [
  'Reconcile daily intake records with submitted monthly returns',
  'Settle identified under-declaration levy arrears within 14 days',
  'Regularize operating category and permit classification',
  'Maintain complete physical dispatch and customer receipts',
  'Rectify transaction reconciliation discrepancies identified during audit',
  'Submit missing delivery notes and county business permit copies'
];

export const CommentsAndCorrectiveActionsComponent: React.FC<CommentsAndCorrectiveActionsComponentProps> = ({
  comments,
  recommendedActions,
  actionDueDate = '',
  actionOwner = '',
  exceptions = [],
  onChange,
  readOnly = false
}) => {
  const openExceptions = exceptions.filter(e => e.status === 'Open' || e.status === 'In Progress');

  const handleAppendDirective = (directiveText: string) => {
    if (readOnly) return;
    const trimmed = (recommendedActions || '').trim();
    if (!trimmed) {
      onChange({ recommendedActions: `• ${directiveText}` });
    } else {
      onChange({ recommendedActions: `${trimmed}\n• ${directiveText}` });
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden" id="comments-and-corrective-actions-section">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/50">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Comments & Recommended Corrective Actions
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Record overall compliance observations, inspector remarks, and mandatory corrective directives issued to the DBO.
            </p>
          </div>
        </div>

        {openExceptions.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{openExceptions.length} Open Exception{openExceptions.length === 1 ? '' : 's'} Pending</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Open Exceptions Notice Banner */}
        {openExceptions.length > 0 && (
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <span className="font-bold">Audit Exceptions Identified:</span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                There {openExceptions.length === 1 ? 'is' : 'are'} <strong>{openExceptions.length} unresolved exception{openExceptions.length === 1 ? '' : 's'}</strong> logged in the Exception Register ({openExceptions.map(e => e.type).slice(0, 3).join(', ')}{openExceptions.length > 3 ? '...' : ''}). Ensure the Recommended Corrective Actions below specify mandatory steps to resolve each item.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Comments & Observations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-slate-500" />
                <span>General Comments & Compliance Observations</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Inspector Notes</span>
            </div>
            <textarea
              name="comments"
              value={comments}
              onChange={(e) => onChange({ comments: e.target.value })}
              disabled={readOnly}
              rows={5}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-xs text-slate-800 leading-relaxed transition-all placeholder:text-slate-400"
              placeholder="Record overall compliance observations, premise hygiene, cooperation of operator, record-keeping standards, or general validation remarks..."
            />
          </div>

          {/* Right Column: Recommended Corrective Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Recommended Corrective Actions & Directives</span>
              </label>
              <span className="text-[10px] text-blue-600 font-bold">Mandatory Directives</span>
            </div>
            <textarea
              name="recommendedActions"
              value={recommendedActions}
              onChange={(e) => onChange({ recommendedActions: e.target.value })}
              disabled={readOnly}
              rows={5}
              className="w-full px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50/20 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-xs font-medium text-slate-800 leading-relaxed transition-all placeholder:text-slate-400"
              placeholder="Specify mandatory corrective actions required from the DBO (e.g. reconcile sales books, settle outstanding levy balances, obtain updated county license)..."
            />
          </div>
        </div>

        {/* Quick Suggestion Directives */}
        {!readOnly && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Quick Directives (Click to append):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DIRECTIVES.map((directive, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAppendDirective(directive)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-600 text-[11px] font-medium transition-all text-left cursor-pointer"
                >
                  + {directive}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Timeline & Ownership Sub-fields */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Target Remediation Due Date</span>
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
            </label>
            <input
              type="text"
              value={actionOwner}
              onChange={(e) => onChange({ actionOwner: e.target.value })}
              disabled={readOnly}
              placeholder="e.g. Managing Director / Proprietor"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none text-xs text-slate-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
