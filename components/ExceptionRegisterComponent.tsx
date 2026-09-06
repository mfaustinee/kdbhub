import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  History, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ShieldAlert, 
  Check, 
  EyeOff,
  Calendar,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { 
  ExceptionRegisterItem, 
  ExceptionStatus, 
  STANDARD_EXCEPTION_TYPES, 
  EXCEPTION_STATUS_OPTIONS 
} from '../types';

export interface ExceptionRegisterComponentProps {
  mode: 'step1-previous' | 'step6-consolidated';
  previousExceptions?: Array<ExceptionRegisterItem & { period?: string; validationDate?: string }>;
  currentExceptions: ExceptionRegisterItem[];
  onUpdateCurrentExceptions: (updated: ExceptionRegisterItem[]) => void;
  onUpdatePreviousExceptionStatus?: (id: string, newStatus: ExceptionStatus, notes?: string) => void;
  onUpdatePreviousExceptionField?: (id: string, field: string, value: any) => void;
  onAddPastException?: (item: ExceptionRegisterItem) => void;
  onDeletePreviousException?: (id: string) => void;
  onCarryForwardToCurrent?: (item: ExceptionRegisterItem) => void;
  dboName?: string;
  premiseName?: string;
  actionOwner?: string;
  globalUnit?: string;
}

// Helper to convert date strings to YYYY-MM-DD for native HTML5 calendar picker
const formatToYYYYMMDD = (val?: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
};

export const ExceptionRegisterComponent: React.FC<ExceptionRegisterComponentProps> = ({
  mode,
  previousExceptions = [],
  currentExceptions = [],
  onUpdateCurrentExceptions,
  onUpdatePreviousExceptionStatus,
  onUpdatePreviousExceptionField,
  onAddPastException,
  onDeletePreviousException,
  onCarryForwardToCurrent,
  dboName = '',
  premiseName = '',
  actionOwner = '',
  globalUnit = 'L'
}) => {
  // Filter state
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'cleared'>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New exception form state
  const [newType, setNewType] = useState(STANDARD_EXCEPTION_TYPES[0].type);
  const [newDefinition, setNewDefinition] = useState(STANDARD_EXCEPTION_TYPES[0].definition);
  const [newSource, setNewSource] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newOwner, setNewOwner] = useState(actionOwner || dboName || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newCorrectiveAction, setNewCorrectiveAction] = useState('');

  // When type dropdown changes, auto-populate definition
  const handleTypeChange = (typeVal: string) => {
    setNewType(typeVal);
    const std = STANDARD_EXCEPTION_TYPES.find(s => s.type === typeVal);
    if (std) {
      setNewDefinition(std.definition);
    }
  };

  // Helper to create an item and reset/keep form
  const createExceptionItem = (): ExceptionRegisterItem => {
    const std = STANDARD_EXCEPTION_TYPES.find(s => s.type === newType);
    const resolvedDefinition = newDefinition.trim() || std?.definition || `Audit exception identified for ${newType}`;
    const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `exc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: uniqueId,
      type: newType,
      definition: resolvedDefinition,
      example: newExample.trim() || resolvedDefinition,
      source: newSource.trim() || (mode === 'step1-previous' ? 'Historical Records Review' : 'Field Inspection Finding'),
      owner: newOwner.trim() || actionOwner || dboName || 'DBO Representative',
      dueDate: newDueDate ? formatToYYYYMMDD(newDueDate) : '',
      correctiveAction: newCorrectiveAction.trim(),
      resolutionEvidence: '',
      status: 'Open',
      origin: mode === 'step1-previous' ? 'previous' : 'current',
      dateLogged: new Date().toISOString()
    };
  };

  // Handle adding a new exception (mode: step1-previous or step6-consolidated)
  const handleSaveException = (keepOpenAfterSave = false) => {
    const item = createExceptionItem();

    if (mode === 'step1-previous') {
      if (onAddPastException) {
        onAddPastException(item);
      } else {
        onUpdateCurrentExceptions([...currentExceptions, item]);
      }
    } else {
      onUpdateCurrentExceptions([...currentExceptions, item]);
    }

    // Reset fields for the next entry
    setNewExample('');
    setNewSource('');
    setNewDueDate('');
    setNewCorrectiveAction('');
    
    if (!keepOpenAfterSave) {
      setIsAddingNew(false);
    }
  };

  // Inline update for any editable field in current or previous exceptions
  const handleFieldChange = (
    id: string,
    field: 'source' | 'owner' | 'dueDate' | 'correctiveAction' | 'status',
    value: any
  ) => {
    const inCurrent = currentExceptions.some(e => e.id === id);
    if (inCurrent) {
      const updated = currentExceptions.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      });
      onUpdateCurrentExceptions(updated);
    } else {
      // In previous exceptions
      if (field === 'status') {
        onUpdatePreviousExceptionStatus?.(id, value as ExceptionStatus);
      }
      onUpdatePreviousExceptionField?.(id, field, value);
    }
  };

  // Delete an exception
  const handleDelete = (id: string, isPrevious?: boolean) => {
    if (isPrevious) {
      onDeletePreviousException?.(id);
    } else {
      onUpdateCurrentExceptions(currentExceptions.filter(e => e.id !== id));
    }
  };

  // Helper checking if an exception is cleared/settled
  const isCleared = (status: ExceptionStatus) => {
    return status === 'Cleared / Settled' || status === 'Resolved' || status === 'Closed' || status === 'Waived';
  };

  // Status color helper badge matching the 10 requested statuses
  const renderStatusBadge = (status: ExceptionStatus) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            Open
          </span>
        );
      case 'Under Review':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            Under Review
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
            In Progress
          </span>
        );
      case 'Payment Plan Active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
            Payment Plan Active
          </span>
        );
      case 'Disputed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
            Disputed
          </span>
        );
      case 'Pending Verification':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
            Pending Verification
          </span>
        );
      case 'Partially Settled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
            Partially Settled
          </span>
        );
      case 'Cleared / Settled':
      case 'Resolved':
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            Cleared / Settled
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-900 border border-red-300 whitespace-nowrap">
            <AlertCircle className="w-3 h-3 text-red-700 shrink-0" />
            Overdue
          </span>
        );
      case 'Escalated':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-fuchsia-600 shrink-0" />
            Escalated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  // =========================================================================
  // MODE 1: STEP 1 - TRACKING PREVIOUS AUDIT EXCEPTIONS
  // =========================================================================
  if (mode === 'step1-previous') {
    const filteredPrevious = previousExceptions.filter(exc => {
      const cleared = isCleared(exc.status);
      if (filterStatus === 'active') return !cleared;
      if (filterStatus === 'cleared') return cleared;
      return true;
    });

    const activePreviousCount = previousExceptions.filter(e => !isCleared(e.status)).length;
    const clearedPreviousCount = previousExceptions.filter(e => isCleared(e.status)).length;

    return (
      <div className="bg-white rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden" id="previous-exceptions-step1-container">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
              <History className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Previous Audit Exceptions Tracker
                </h3>
                {activePreviousCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    {activePreviousCount} Unresolved from Past Audits
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    All Historical Exceptions Cleared
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Discrepancies and corrective actions identified in prior validation audits.</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  <EyeOff className="w-3 h-3 text-slate-500" />
                  Internal Audit Only • Excluded from PDF
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({previousExceptions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('active')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'active' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                Active ({activePreviousCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('cleared')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'cleared' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Cleared ({clearedPreviousCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              id="step1-record-past-exception-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Past Exception</span>
            </button>
          </div>
        </div>

        {/* Add historical exception form drawer - Supports infinite entries */}
        {isAddingNew && (
          <div className="p-4 bg-amber-50/70 border-b border-amber-200/80 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                Record Historical / Previous Audit Exception
              </span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Exception Type *</label>
                <select
                  value={newType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none font-medium text-slate-800"
                >
                  {STANDARD_EXCEPTION_TYPES.map(st => (
                    <option key={st.type} value={st.type}>{st.type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Source *</label>
                <input
                  type="text"
                  placeholder="e.g. Audit Q3 2025 / Daily Log"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Owner *</label>
                <input
                  type="text"
                  placeholder="e.g. DBO Manager / Owner"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Definition *</label>
                <input
                  type="text"
                  placeholder="Regulatory standard or definition of this non-compliance..."
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Due Date (Calendar Picker)</span>
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Corrective Action Required</label>
                <textarea
                  rows={2}
                  placeholder="Prescribed action to rectify this past non-compliance..."
                  value={newCorrectiveAction}
                  onChange={(e) => setNewCorrectiveAction(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase">Specific Finding / Observation Note</label>
                <textarea
                  rows={2}
                  placeholder="Specific discrepancy details, missing documents, or historical variance..."
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg outline-none text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveException(true)}
                className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="Save this finding and immediately add another"
              >
                Save & Add Another
              </button>
              <button
                type="button"
                onClick={() => handleSaveException(false)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Save Past Exception
              </button>
            </div>
          </div>
        )}

        {/* Structured Table for Previous Exceptions - Wrapped & Editable Columns */}
        {filteredPrevious.length === 0 ? (
          <div className="p-8 text-center space-y-2 bg-slate-50/60">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              {filterStatus === 'all' 
                ? 'No historical exceptions recorded for this premise' 
                : `No historical exceptions matching status "${filterStatus}"`}
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              You can record any past audit findings by clicking "Record Past Exception" above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed min-w-[950px]">
              <thead>
                <tr className="bg-amber-50/70 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-amber-200/80">
                  <th className="p-3 w-[13%] whitespace-normal break-words">Exception Type</th>
                  <th className="p-3 w-[21%] whitespace-normal break-words">Definition</th>
                  <th className="p-3 w-[14%] whitespace-normal break-words">Source</th>
                  <th className="p-3 w-[13%] whitespace-normal break-words">Owner</th>
                  <th className="p-3 w-[12%] whitespace-normal break-words">Due Date</th>
                  <th className="p-3 w-[15%] whitespace-normal break-words">Corrective Action Required</th>
                  <th className="p-3 w-[12%] whitespace-normal break-words text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60">
                {filteredPrevious.map((item) => {
                  const isItemCleared = isCleared(item.status);
                  const isCarriedForward = currentExceptions.some(
                    c => c.id === item.id || (c.source === item.source && c.example === item.example)
                  );

                  return (
                    <tr key={item.id} className={`hover:bg-amber-50/30 transition-colors ${!isItemCleared ? 'bg-white' : 'bg-slate-50/50'}`}>
                      {/* Column 1: Exception Type */}
                      <td className="p-2.5 align-top whitespace-normal break-words">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-block">
                          {item.type}
                        </span>
                        {item.period && (
                          <div className="text-[10px] text-slate-500 mt-1 font-medium truncate" title={item.period}>
                            {item.period}
                          </div>
                        )}
                        {isCarriedForward && (
                          <span className="mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-block">
                            Carried Forward
                          </span>
                        )}
                      </td>

                      {/* Column 2: Definition */}
                      <td className="p-2.5 align-top whitespace-normal break-words">
                        <div className="font-semibold text-slate-900 leading-snug text-[11px]">
                          {item.definition || item.example || '-'}
                        </div>
                        {item.example && item.example !== item.definition && (
                          <div className="text-[10px] text-slate-600 mt-1 bg-slate-50 p-1.5 rounded border border-slate-200/80 leading-snug">
                            <span className="font-bold text-slate-700">Obs:</span> {item.example}
                          </div>
                        )}
                      </td>

                      {/* Column 3: Source (Editable & Wrapped) */}
                      <td className="p-2 align-top whitespace-normal break-words">
                        <input
                          type="text"
                          value={item.source || ''}
                          onChange={(e) => handleFieldChange(item.id, 'source', e.target.value)}
                          placeholder="Source..."
                          className="w-full text-xs text-slate-800 bg-white hover:bg-amber-50/40 focus:bg-white border border-slate-200 hover:border-amber-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors"
                        />
                      </td>

                      {/* Column 4: Owner (Editable & Wrapped) */}
                      <td className="p-2 align-top whitespace-normal break-words">
                        <input
                          type="text"
                          value={item.owner || ''}
                          onChange={(e) => handleFieldChange(item.id, 'owner', e.target.value)}
                          placeholder="Owner..."
                          className="w-full text-xs font-semibold text-slate-800 bg-white hover:bg-amber-50/40 focus:bg-white border border-slate-200 hover:border-amber-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors"
                        />
                      </td>

                      {/* Column 5: Due Date (Calendar Picker, Editable & Wrapped) */}
                      <td className="p-2 align-top whitespace-normal break-words">
                        <input
                          type="date"
                          value={formatToYYYYMMDD(item.dueDate)}
                          onChange={(e) => handleFieldChange(item.id, 'dueDate', e.target.value)}
                          className="w-full text-xs text-slate-800 bg-white hover:bg-amber-50/40 focus:bg-white border border-slate-200 hover:border-amber-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors cursor-pointer"
                          title="Pick due date from calendar"
                        />
                      </td>

                      {/* Column 6: Corrective Action Required (Moved between Due Date & Status, Editable & Wrapped) */}
                      <td className="p-2 align-top whitespace-normal break-words">
                        <textarea
                          rows={2}
                          value={item.correctiveAction ?? item.resolutionEvidence ?? ''}
                          onChange={(e) => handleFieldChange(item.id, 'correctiveAction', e.target.value)}
                          placeholder="Specify corrective action..."
                          className="w-full text-xs text-slate-800 bg-white hover:bg-amber-50/40 focus:bg-white border border-slate-200 hover:border-amber-300 focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors resize-y leading-relaxed"
                        />
                      </td>

                      {/* Column 7: Status (Dropdown, Badge, and Retained Delete Button) */}
                      <td className="p-2 align-top whitespace-normal break-words">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1">
                            <select
                              value={item.status}
                              onChange={(e) => handleFieldChange(item.id, 'status', e.target.value as ExceptionStatus)}
                              className="flex-1 min-w-0 px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer"
                            >
                              {EXCEPTION_STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id, true)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                              title="Delete past exception"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-center">
                            {renderStatusBadge(item.status)}
                          </div>
                          {!isItemCleared && !isCarriedForward && onCarryForwardToCurrent && (
                            <button
                              type="button"
                              onClick={() => onCarryForwardToCurrent(item)}
                              className="mt-0.5 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title="Carry forward this exception into current audit"
                            >
                              <span>Carry Forward</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODE 2: STEP 6 - EXCEPTIONS REGISTER (Renamed from Consolidated Open Exceptions Register)
  // =========================================================================
  
  // Consolidate current audit exceptions and unresolved historical exceptions
  const allExceptionsList = useMemo(() => {
    const list: Array<ExceptionRegisterItem & { originLabel: string; isPrevious?: boolean }> = [];
    const seenIds = new Set<string>();

    // 1. Current audit exceptions
    currentExceptions.forEach(e => {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        list.push({
          ...e,
          originLabel: e.origin === 'previous' ? `Carried Forward (${e.previousPeriod || 'Prior Audit'})` : 'Current Validation Audit',
          isPrevious: e.origin === 'previous'
        });
      }
    });

    // 2. Previous exceptions not already included
    previousExceptions.forEach(pe => {
      if (!seenIds.has(pe.id)) {
        seenIds.add(pe.id);
        list.push({
          ...pe,
          originLabel: `Previous Audit (${pe.period || 'Prior Audit'})`,
          isPrevious: true
        });
      }
    });

    return list;
  }, [currentExceptions, previousExceptions]);

  const activeCount = allExceptionsList.filter(e => !isCleared(e.status)).length;
  const clearedCount = allExceptionsList.filter(e => isCleared(e.status)).length;

  const filteredStep6List = allExceptionsList.filter(exc => {
    const cleared = isCleared(exc.status);
    if (filterStatus === 'active') return !cleared;
    if (filterStatus === 'cleared') return cleared;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden" id="exceptions-register-container">
      {/* Header - Renamed to Exceptions Register */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-rose-50/20 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">
                Exceptions Register
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
                activeCount > 0 
                  ? 'bg-rose-100 text-rose-800 border-rose-200' 
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}>
                {activeCount > 0 ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    {activeCount} Active {activeCount === 1 ? 'Exception' : 'Exceptions'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    All Exceptions Cleared ({clearedCount} Settled)
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Current inspection findings, non-compliances, and carried-forward historical exceptions.</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                <EyeOff className="w-3 h-3 text-slate-500" />
                Internal Audit Only • Excluded from PDF
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {/* Status Filter Pills */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({allExceptionsList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'active' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('cleared')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'cleared' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Cleared ({clearedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            id="step6-add-exception-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Exception</span>
          </button>
        </div>
      </div>

      {/* Add New Exception Form Drawer */}
      {isAddingNew && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              Add Audit Exception to Exceptions Register
            </span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Exception Type *</label>
              <select
                value={newType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
              >
                {STANDARD_EXCEPTION_TYPES.map(st => (
                  <option key={st.type} value={st.type}>{st.type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Source *</label>
              <input
                type="text"
                placeholder="e.g. Field Inspection / Reconciliation"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Owner *</label>
              <input
                type="text"
                placeholder="e.g. DBO Representative"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Definition *</label>
              <input
                type="text"
                placeholder="Regulatory standard or definition of this non-compliance..."
                value={newDefinition}
                onChange={(e) => setNewDefinition(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Due Date (Calendar Picker)</span>
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Corrective Action Required</label>
              <textarea
                rows={2}
                placeholder="Specify the required corrective action..."
                value={newCorrectiveAction}
                onChange={(e) => setNewCorrectiveAction(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase">Observation / Finding Details</label>
              <textarea
                rows={2}
                placeholder="Observed variance, missing document, or non-compliance requiring follow-up..."
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveException(true)}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Save & Add Another
            </button>
            <button
              type="button"
              onClick={() => handleSaveException(false)}
              className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Save Exception
            </button>
          </div>
        </div>
      )}

      {/* Structured Table for Exceptions Register - Wrapped & Editable Columns */}
      {filteredStep6List.length === 0 ? (
        <div className="p-8 text-center space-y-2 bg-emerald-50/50">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-emerald-950">
            {filterStatus === 'all' 
              ? 'Zero Exceptions in Register' 
              : `Zero Exceptions matching filter "${filterStatus}"`}
          </p>
          <p className="text-xs text-emerald-700 max-w-md mx-auto">
            All compliance items, records verifications, and historical items have been verified and cleared for this premise.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[950px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="p-3 w-[13%] whitespace-normal break-words">Exception Type</th>
                <th className="p-3 w-[21%] whitespace-normal break-words">Definition</th>
                <th className="p-3 w-[14%] whitespace-normal break-words">Source</th>
                <th className="p-3 w-[13%] whitespace-normal break-words">Owner</th>
                <th className="p-3 w-[12%] whitespace-normal break-words">Due Date</th>
                <th className="p-3 w-[15%] whitespace-normal break-words">Corrective Action Required</th>
                <th className="p-3 w-[12%] whitespace-normal break-words text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStep6List.map((item, idx) => {
                const isItemCleared = isCleared(item.status);

                return (
                  <tr key={item.id || idx} className={`hover:bg-slate-50 transition-colors ${!isItemCleared ? 'bg-white' : 'bg-slate-50/40'}`}>
                    {/* Column 1: Exception Type */}
                    <td className="p-2.5 align-top whitespace-normal break-words">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 inline-block">
                        {item.type}
                      </span>
                      <div className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                        {item.originLabel}
                      </div>
                    </td>

                    {/* Column 2: Definition */}
                    <td className="p-2.5 align-top whitespace-normal break-words">
                      <div className="font-semibold text-slate-900 leading-snug text-[11px]">
                        {item.definition || item.example || '-'}
                      </div>
                      {item.example && item.example !== item.definition && (
                        <div className="text-[10px] text-slate-600 mt-1 bg-slate-50 p-1.5 rounded border border-slate-200/80 leading-snug">
                          <span className="font-bold text-slate-700">Obs:</span> {item.example}
                        </div>
                      )}
                    </td>

                    {/* Column 3: Source (Editable & Wrapped) */}
                    <td className="p-2 align-top whitespace-normal break-words">
                      <input
                        type="text"
                        value={item.source || ''}
                        onChange={(e) => handleFieldChange(item.id, 'source', e.target.value)}
                        placeholder="Source record..."
                        className="w-full text-xs text-slate-800 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors"
                      />
                    </td>

                    {/* Column 4: Owner (Renamed from Owner/Responsible Person, Editable & Wrapped) */}
                    <td className="p-2 align-top whitespace-normal break-words">
                      <input
                        type="text"
                        value={item.owner || ''}
                        onChange={(e) => handleFieldChange(item.id, 'owner', e.target.value)}
                        placeholder="Owner..."
                        className="w-full text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors"
                      />
                    </td>

                    {/* Column 5: Due Date (Calendar Picker, Editable & Wrapped) */}
                    <td className="p-2 align-top whitespace-normal break-words">
                      <input
                        type="date"
                        value={formatToYYYYMMDD(item.dueDate)}
                        onChange={(e) => handleFieldChange(item.id, 'dueDate', e.target.value)}
                        className="w-full text-xs text-slate-800 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 outline-none transition-colors cursor-pointer"
                        title="Pick due date from calendar"
                      />
                    </td>

                    {/* Column 6: Corrective Action Required (Renamed from Actions, moved between Due Date & Status, Editable & Wrapped) */}
                    <td className="p-2 align-top whitespace-normal break-words">
                      <textarea
                        rows={2}
                        value={item.correctiveAction ?? item.resolutionEvidence ?? ''}
                        onChange={(e) => handleFieldChange(item.id, 'correctiveAction', e.target.value)}
                        placeholder="Specify required corrective action..."
                        className="w-full text-xs text-slate-800 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 outline-none transition-colors resize-y leading-relaxed"
                      />
                    </td>

                    {/* Column 7: Status (Dropdown with all 10 statuses, Badge, and Retained Delete Button) */}
                    <td className="p-2 align-top whitespace-normal break-words">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={item.status}
                            onChange={(e) => handleFieldChange(item.id, 'status', e.target.value as ExceptionStatus)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer"
                          >
                            {EXCEPTION_STATUS_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id, item.isPrevious)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                            title="Delete exception from register"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex justify-center">
                          {renderStatusBadge(item.status)}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
