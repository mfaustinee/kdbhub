import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Info, 
  ShieldAlert, 
  Calendar,
  User,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  ExceptionRegisterItem, 
  ExceptionStatus, 
  STANDARD_EXCEPTION_TYPES 
} from '../types';

interface ExceptionRegisterComponentProps {
  exceptions: ExceptionRegisterItem[];
  onChange: (updated: ExceptionRegisterItem[]) => void;
  readOnly?: boolean;
  onSyncFromChecklist?: () => void;
  unregisteredDiscrepanciesCount?: number;
}

const STATUS_CONFIG: Record<ExceptionStatus, { label: string; badgeClass: string; borderClass: string }> = {
  'Open': {
    label: 'Open',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    borderClass: 'border-rose-200'
  },
  'In Progress': {
    label: 'In Progress',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    borderClass: 'border-amber-200'
  },
  'Resolved': {
    label: 'Resolved',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    borderClass: 'border-emerald-200'
  },
  'Closed': {
    label: 'Closed',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    borderClass: 'border-slate-200'
  },
  'Waived': {
    label: 'Waived',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    borderClass: 'border-purple-200'
  }
};

export const toDDMMYYYY = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed;
};

export const toISODate = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
};

export const ExceptionRegisterComponent: React.FC<ExceptionRegisterComponentProps> = ({
  exceptions = [],
  onChange,
  readOnly = false,
  onSyncFromChecklist,
  unregisteredDiscrepanciesCount = 0
}) => {
  const [selectedTypeForAdd, setSelectedTypeForAdd] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const createExceptionItem = (
    type: string = 'Missing record', 
    definitionOverride?: string, 
    exampleOverride?: string
  ): ExceptionRegisterItem => {
    const std = STANDARD_EXCEPTION_TYPES.find(t => t.type.toLowerCase() === type.toLowerCase());
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'exc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    return {
      id,
      type: std ? std.type : type,
      definition: definitionOverride ?? (std ? std.definition : 'Custom exception observed during audit'),
      example: exampleOverride ?? (std ? std.example : 'Field discrepancy'),
      source: '',
      owner: '',
      dueDate: '',
      resolutionEvidence: '',
      status: 'Open'
    };
  };

  const handleAddException = (type?: string) => {
    if (readOnly) return;
    const targetType = type || selectedTypeForAdd || 'Missing record';
    const newItem = createExceptionItem(targetType);
    onChange([...exceptions, newItem]);
    setSelectedTypeForAdd('');
  };

  const handleRemoveException = (id: string) => {
    if (readOnly) return;
    onChange(exceptions.filter(e => e.id !== id));
  };

  const handleFieldChange = (id: string, field: keyof ExceptionRegisterItem, value: any) => {
    if (readOnly) return;
    const updated = exceptions.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };

      // If user changed the type, auto-update definition & example if they match default
      if (field === 'type') {
        const std = STANDARD_EXCEPTION_TYPES.find(t => t.type.toLowerCase() === String(value).toLowerCase());
        if (std) {
          next.definition = std.definition;
          next.example = std.example;
        }
      }

      return next;
    });

    onChange(updated);
  };

  const handleLoadAllStandardTemplates = () => {
    if (readOnly) return;
    const existingTypes = new Set(exceptions.map(e => e.type.toLowerCase().trim()));
    const missingStandards = STANDARD_EXCEPTION_TYPES.filter(s => !existingTypes.has(s.type.toLowerCase().trim()));
    
    if (missingStandards.length === 0) return;

    const newRows: ExceptionRegisterItem[] = missingStandards.map(s => 
      createExceptionItem(s.type, s.definition, s.example)
    );
    onChange([...exceptions, ...newRows]);
  };

  // Metrics
  const openCount = exceptions.filter(e => e.status === 'Open').length;
  const inProgressCount = exceptions.filter(e => e.status === 'In Progress').length;
  const resolvedCount = exceptions.filter(e => e.status === 'Resolved' || e.status === 'Closed').length;

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden" id="exception-register-container">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-amber-50/30 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs border border-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Exception Register
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {exceptions.length} {exceptions.length === 1 ? 'Record' : 'Records'}
              </span>
              {openCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {openCount} Open
                </span>
              )}
              {inProgressCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {inProgressCount} In Progress
                </span>
              )}
              {resolvedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {resolvedCount} Resolved
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Every exception identified should be separately recorded with definition, source, owner, due date, and resolution evidence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>{isOpen ? 'Hide Exception Register' : 'Open Exception Register'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!readOnly && isOpen && (
            <button
              type="button"
              onClick={() => handleAddException()}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Exception</span>
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <>
          {/* Checklist Interdependence Alert Banner */}
      {Boolean(unregisteredDiscrepanciesCount && unregisteredDiscrepanciesCount > 0 && onSyncFromChecklist && !readOnly) && (
        <div className="mx-3 sm:mx-5 mt-3 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-amber-950">
                {unregisteredDiscrepanciesCount} Discrepancy / Missing Record Item{unregisteredDiscrepanciesCount === 1 ? '' : 's'} Flagged in Checklist
              </p>
              <p className="text-[11px] text-amber-800">
                Any discrepancy or mismatch uncovered during verification is classified and managed in this Exception Register.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSyncFromChecklist}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Auto-Record All in Register ({unregisteredDiscrepanciesCount})</span>
          </button>
        </div>
      )}

      {/* Register List / Table */}
      <div className="p-3 sm:p-5 space-y-4">
        {exceptions.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
            <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <p className="text-xs font-bold text-slate-700">No exceptions logged in this validation</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every exception identified during records inspection should be separately recorded.
              </p>
            </div>
            {!readOnly && (
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddException()}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record First Exception</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-100/80 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-3 w-40">Exception Type</th>
                  <th className="p-3 w-56">Definition</th>
                  <th className="p-3 w-48">Example</th>
                  <th className="p-3 w-40">Source</th>
                  <th className="p-3 w-36">Owner</th>
                  <th className="p-3 w-36">Due Date (DD/MM/YYYY)</th>
                  <th className="p-3 min-w-[180px]">Resolution Evidence</th>
                  <th className="p-3 w-32">Status</th>
                  {!readOnly && <th className="p-3 w-12 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {exceptions.map((item, idx) => {
                  const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG['Open'];

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* Exception Type */}
                      <td className="p-2.5 align-top">
                        <select
                          value={item.type}
                          onChange={(e) => handleFieldChange(item.id, 'type', e.target.value)}
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-amber-500 outline-none text-xs font-bold text-slate-800"
                        >
                          {STANDARD_EXCEPTION_TYPES.map(t => (
                            <option key={t.type} value={t.type}>
                              {t.type}
                            </option>
                          ))}
                          {!STANDARD_EXCEPTION_TYPES.some(t => t.type === item.type) && (
                            <option value={item.type}>{item.type}</option>
                          )}
                        </select>
                      </td>

                      {/* Definition */}
                      <td className="p-2.5 align-top">
                        <textarea
                          rows={2}
                          value={item.definition}
                          onChange={(e) => handleFieldChange(item.id, 'definition', e.target.value)}
                          disabled={readOnly}
                          placeholder="Expected condition vs reality"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 outline-none text-[11px] text-slate-700 leading-snug"
                        />
                      </td>

                      {/* Example */}
                      <td className="p-2.5 align-top">
                        <textarea
                          rows={2}
                          value={item.example}
                          onChange={(e) => handleFieldChange(item.id, 'example', e.target.value)}
                          disabled={readOnly}
                          placeholder="Audit reference example"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 outline-none text-[11px] text-slate-500 italic leading-snug"
                        />
                      </td>

                      {/* Source */}
                      <td className="p-2.5 align-top">
                        <input
                          type="text"
                          value={item.source}
                          onChange={(e) => handleFieldChange(item.id, 'source', e.target.value)}
                          placeholder="e.g. Daily Register, Permit"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-amber-500 outline-none text-xs text-slate-800 font-medium"
                        />
                      </td>

                      {/* Owner */}
                      <td className="p-2.5 align-top">
                        <input
                          type="text"
                          value={item.owner}
                          onChange={(e) => handleFieldChange(item.id, 'owner', e.target.value)}
                          placeholder="e.g. DBO Manager"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-amber-500 outline-none text-xs text-slate-800"
                        />
                      </td>

                      {/* Due Date (DD/MM/YYYY) */}
                      <td className="p-2.5 align-top">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={item.dueDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleFieldChange(item.id, 'dueDate', toDDMMYYYY(val));
                            }}
                            disabled={readOnly}
                            className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-amber-500 outline-none text-xs text-slate-800 font-mono tracking-tight"
                            title="Format: DD/MM/YYYY"
                          />
                          {!readOnly && (
                            <label className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-slate-400 hover:text-amber-600 transition-colors" title="Pick date">
                              <Calendar className="w-3.5 h-3.5" />
                              <input
                                type="date"
                                tabIndex={-1}
                                aria-label="Select date"
                                value={toISODate(item.dueDate)}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleFieldChange(item.id, 'dueDate', toDDMMYYYY(e.target.value));
                                  }
                                }}
                                className="sr-only"
                              />
                            </label>
                          )}
                        </div>
                      </td>

                      {/* Resolution Evidence */}
                      <td className="p-2.5 align-top">
                        <textarea
                          rows={2}
                          value={item.resolutionEvidence}
                          onChange={(e) => handleFieldChange(item.id, 'resolutionEvidence', e.target.value)}
                          placeholder="Required proof to resolve (e.g. signed permit, payment slip)"
                          disabled={readOnly}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:border-amber-500 outline-none text-[11px] text-slate-700 leading-snug"
                        />
                      </td>

                      {/* Status */}
                      <td className="p-2.5 align-top">
                        <select
                          value={item.status}
                          onChange={(e) => handleFieldChange(item.id, 'status', e.target.value as ExceptionStatus)}
                          disabled={readOnly}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-none cursor-pointer ${statusConf.badgeClass}`}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                          <option value="Waived">Waived</option>
                        </select>
                      </td>

                      {/* Delete */}
                      {!readOnly && (
                        <td className="p-2.5 align-top text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveException(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove exception"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};
