import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MinusCircle, 
  Check, 
  RotateCcw,
  Sparkles,
  Search,
  CheckCheck,
  FileText,
  Info,
  ShieldAlert
} from 'lucide-react';
import { FieldChecklistResultStatus } from '../types';
import { 
  FIELD_CHECKLIST_SECTIONS, 
  getItemStatusOptions,
  findSuggestedSectionId, 
  getActiveChecklistSections,
  getActiveChecklistItems,
  FieldChecklistSection,
  FieldChecklistItem
} from './fieldChecklistData';

interface FieldChecklistComponentProps {
  value: Record<string, { status: FieldChecklistResultStatus; notes: string }>;
  onChange: (updated: Record<string, { status: FieldChecklistResultStatus; notes: string }>) => void;
  clientCategory?: string;
  readOnly?: boolean;
}

export const FieldChecklistComponent: React.FC<FieldChecklistComponentProps> = ({
  value = {},
  onChange,
  clientCategory,
  readOnly = false
}) => {
  const suggestedSectionId = useMemo(() => findSuggestedSectionId(clientCategory), [clientCategory]);

  // Section 1 is split into Part I (CA01–CA05) and Part II (CA06–CA13)
  // with the selected permit category checklist flowing directly between CA05 and CA06.
  const activeSections = useMemo(() => {
    return getActiveChecklistSections(clientCategory);
  }, [clientCategory]);

  const [isOpen, setIsOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Calculate total items across active sections only
  const totalItemsCount = useMemo(() => {
    return activeSections.reduce((acc, sec) => acc + sec.items.length, 0);
  }, [activeSections]);

  // Calculate statistics across all sections
  const stats = useMemo(() => {
    let evaluated = 0;
    let reconciled = 0;
    let discrepancies = 0;
    let missing = 0;
    let na = 0;

    Object.values(value).forEach(item => {
      if (item?.status && item.status.trim() !== '') {
        evaluated++;
        const s = item.status.toLowerCase();
        if (
          s.includes('not applicable') ||
          s.includes('(n/a)')
        ) {
          na++;
        } else if (
          s.includes('discrepanc') || 
          s.includes('specify') ||
          s.includes('variances') ||
          s.includes('gaps') ||
          s.includes('tagging gaps') ||
          s.includes('exceptions') ||
          s.includes('misclassif') || 
          s.includes('incorrect') ||
          s.includes('partially') || 
          s.includes('candidate') || 
          s.includes('pending') || 
          s.includes('review required') ||
          s.includes('potential') ||
          s.includes('applicable but')
        ) {
          discrepancies++;
        } else if (
          s.includes('missing') || 
          s.includes('expired') || 
          s.includes('invalid') || 
          s.includes('not supported') || 
          s.includes('not traced') || 
          s.includes('not reconciled') || 
          s.includes('not confirmed') || 
          s.includes('incomplete') || 
          s.includes('unclear') ||
          s.includes('unable to') || 
          s.includes('not usable') || 
          s.includes('unresolved') || 
          s.includes('inadequate') || 
          s.includes('cannot verify') ||
          s.includes('not available')
        ) {
          missing++;
        } else if (
          s.startsWith('no ') ||
          s.includes('reconciled') || 
          s.includes('correct') || 
          s.includes('verified') || 
          s.includes('compliant') || 
          s.includes('consistent') || 
          s.includes('valid') || 
          s.includes('available & complete') ||
          s.includes('complete & traceable') ||
          s.includes('fully') || 
          s.includes('complete') || 
          s.includes('adequate')
        ) {
          reconciled++;
        } else {
          reconciled++;
        }
      } else if (item?.notes && item.notes.trim() !== '') {
        evaluated++;
      }
    });

    return { evaluated, reconciled, discrepancies, missing, na };
  }, [value]);

  const handleStatusChange = (ref: string, newStatus: FieldChecklistResultStatus) => {
    if (readOnly) return;
    const current = value[ref] || { status: '', notes: '' };
    // Toggle off if clicked again
    const finalStatus = current.status === newStatus ? '' : newStatus;
    onChange({
      ...value,
      [ref]: {
        ...current,
        status: finalStatus
      }
    });
  };

  const handleNotesChange = (ref: string, notes: string) => {
    if (readOnly) return;
    const current = value[ref] || { status: '', notes: '' };
    onChange({
      ...value,
      [ref]: {
        ...current,
        notes
      }
    });
  };

  const handleMarkSection = (section: FieldChecklistSection, optionIndex: 0 | 3) => {
    if (readOnly) return;
    const updated = { ...value };
    section.items.forEach(item => {
      const current = updated[item.ref] || { status: '', notes: '' };
      const opts = getItemStatusOptions(item);
      const targetStatus = opts[optionIndex]?.value || (optionIndex === 0 ? 'Available & Reconciled' : 'Not Applicable (N/A)');
      updated[item.ref] = {
        ...current,
        status: targetStatus
      };
    });
    onChange(updated);
  };

  const handleClearSection = (section: FieldChecklistSection) => {
    if (readOnly) return;
    const updated = { ...value };
    section.items.forEach(item => {
      delete updated[item.ref];
    });
    onChange(updated);
  };

  const handleClearAll = () => {
    if (readOnly) return;
    if (window.confirm('Clear all filled checklist statuses and notes?')) {
      onChange({});
    }
  };

  // Filter active sections and items based on search
  const displayedSections = useMemo(() => {
    if (!searchFilter.trim()) {
      if (activeSectionId === 'all') {
        return activeSections;
      }
      return activeSections.filter(sec => sec.id === activeSectionId);
    }

    const query = searchFilter.toLowerCase().trim();
    return activeSections.map(sec => ({
      ...sec,
      items: sec.items.filter(item => 
        item.ref.toLowerCase().includes(query) ||
        (item.subGroup && item.subGroup.toLowerCase().includes(query)) ||
        (item.dataItem && item.dataItem.toLowerCase().includes(query)) ||
        (item.primarySource && item.primarySource.toLowerCase().includes(query)) ||
        (item.validationTest && item.validationTest.toLowerCase().includes(query)) ||
        (item.evidenceDetail && item.evidenceDetail.toLowerCase().includes(query)) ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        sec.title.toLowerCase().includes(query)
      )
    })).filter(sec => sec.items.length > 0);
  }, [activeSections, activeSectionId, searchFilter]);

  const activeCategoryTitle = useMemo(() => {
    const target = activeSections.find(s => s.id !== 'sec-common-institutional');
    return target ? target.shortName : (clientCategory ? clientCategory : 'All Categories');
  }, [activeSections, clientCategory]);

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
      {/* Accordion / Header Banner */}
      <div 
        onClick={() => setIsOpen(prev => !prev)}
        className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none bg-linear-to-r from-slate-50 via-white to-blue-50/30 hover:bg-slate-50 transition-all border-b border-transparent data-[open=true]:border-slate-200"
        data-open={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/50">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                Field Verification Checklist
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Optional
              </span>
              {stats.evaluated > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {stats.evaluated} Recorded
                </span>
              )}
              {stats.discrepancies > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {stats.discrepancies} Discrepancies
                </span>
              )}
              {stats.missing > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                  <XCircle className="w-2.5 h-2.5" />
                  {stats.missing} Missing
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              Validation and Reconciliation Areas ({activeCategoryTitle || 'All Categories'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>{isOpen ? 'Hide Checklist' : 'Open Checklist'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Checklist Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-slate-50/40"
          >
            <div className="p-4 sm:p-6 space-y-5 border-t border-slate-200">
              {/* Category / Section Tabs and Search bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                  {activeSections.map(sec => {
                    const isSuggested = sec.id === suggestedSectionId;
                    const isActive = activeSectionId === sec.id;
                    const filledCount = sec.items.filter(item => (value[item.ref]?.status || (item.legacyRef && value[item.legacyRef]?.status))).length;
                    
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setActiveSectionId(sec.id);
                          setSearchFilter('');
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{sec.sectionNumber === 1 ? 'Section 1' : sec.title}</span>
                        {filledCount > 0 && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                            isActive ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {filledCount}/{sec.items.length}
                          </span>
                        )}
                        {isSuggested && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                            isActive ? 'bg-blue-500 text-white' : 'bg-emerald-100 text-emerald-800'
                          }`} title="Suggested category based on client profile">
                            Target
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSectionId('all');
                      setSearchFilter('');
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                      activeSectionId === 'all'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    View All Active Sections
                  </button>
                </div>

                {/* Quick filter search */}
                <div className="relative min-w-[200px] shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search checklist items..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Informative helper note */}
              <div className="px-3.5 py-2 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-800 text-[11px] flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="font-bold">Note:</span> This checklist is optional. Selecting any result status or entering notes automatically updates <em>Records & Traceability</em> to <strong><em>"See Records Validation & Reconciliation Findings"</em></strong>.
                </span>
                {stats.evaluated > 0 && (
                  <span className="text-[10px] font-bold bg-blue-200/70 text-blue-900 px-2 py-0.5 rounded-full shrink-0">
                    Records & Traceability: <em className="italic font-bold">See Records Validation & Reconciliation Findings</em>
                  </span>
                )}
              </div>

              {/* Sections Display */}
              <div className="space-y-6">
                {displayedSections.map(section => {
                  const sectionFilledCount = section.items.filter(item => (value[item.ref]?.status || (item.legacyRef && value[item.legacyRef]?.status))).length;
                  const isSectionMatch = section.id === suggestedSectionId;
                  const currentSecIndex = activeSections.findIndex(s => s.id === section.id);
                  const prevSection = currentSecIndex > 0 ? activeSections[currentSecIndex - 1] : null;
                  const nextSection = currentSecIndex >= 0 && currentSecIndex < activeSections.length - 1 ? activeSections[currentSecIndex + 1] : null;

                  return (
                    <div 
                      key={section.id} 
                      id={`sec-card-${section.id}`}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                    >
                      {/* Section Title Banner */}
                      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                              {section.title}
                            </h4>
                            {isSectionMatch && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                Matches Operator Category
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-slate-500">
                              ({sectionFilledCount} of {section.items.length} completed)
                            </span>
                          </div>
                        </div>

                        {!readOnly && (
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleMarkSection(section, 0)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Mark all items in this section with the primary positive/reconciled status"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>All Reconciled</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkSection(section, 3)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Mark all items in this section as N/A"
                            >
                              <MinusCircle className="w-3 h-3" />
                              <span>All N/A</span>
                            </button>
                            {sectionFilledCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearSection(section)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                title="Reset entries for this section"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Threshold Distinction Banner (if present on section) */}
                      {section.thresholdDistinction && (
                        <div className="mx-4 mt-4 p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-950">
                          <div className="flex items-center gap-2 font-black text-xs text-amber-900 mb-1">
                            <Info className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>{section.thresholdDistinction.title}</span>
                          </div>
                          <p className="text-xs text-amber-800 font-medium mb-1.5">
                            {section.thresholdDistinction.description}
                          </p>
                          <ul className="space-y-1 text-xs text-amber-900 font-semibold pl-2 border-l-2 border-amber-300">
                            {section.thresholdDistinction.points.map((pt, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-600 font-bold">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Items List */}
                      <div className="divide-y divide-slate-100">
                        {section.items.map((item, idx) => {
                          const currentVal = value[item.ref] || (item.legacyRef ? value[item.legacyRef] : undefined) || { status: '', notes: '' };
                          const statusOptions = getItemStatusOptions(item);
                          const isPositive = currentVal.status === statusOptions[0]?.value;
                          const isNA = currentVal.status === statusOptions[3]?.value;
                          const isExceptionOrDiscrepancy = Boolean(currentVal.status && !isPositive && !isNA);
                          const isSubGroupStart = item.subGroup && (idx === 0 || section.items[idx - 1]?.subGroup !== item.subGroup);

                          return (
                            <React.Fragment key={item.ref}>
                              {/* Subgroup Category Header */}
                              {isSubGroupStart && (
                                <div className="bg-slate-100/80 px-4 py-2 border-y border-slate-200/80 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                                      {item.subGroup}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {section.items.filter(i => i.subGroup === item.subGroup).length} Verification Checks
                                  </span>
                                </div>
                              )}

                              <div 
                                className="p-4 hover:bg-slate-50/50 transition-all grid grid-cols-1 lg:grid-cols-12 gap-3.5"
                              >
                                {/* Ref & Item Details (cols 1-5) */}
                                <div className="lg:col-span-5 space-y-2">
                                  <div className="flex items-start gap-2.5">
                                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black font-mono shrink-0 shadow-2xs">
                                      {item.ref}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                                        {item.dataItem || item.title}
                                      </h5>
                                      <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">
                                        {item.validationTest || item.description}
                                      </p>

                                      {/* Primary Source & Evidence / Detail Tags */}
                                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Primary Source">
                                          <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                                          <span className="text-slate-500 font-normal">Source:</span> {item.primarySource}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200" title="Evidence / Detail">
                                          <Search className="w-3 h-3 text-blue-500 shrink-0" />
                                          <span className="text-blue-600 font-normal">Evidence:</span> {item.evidenceDetail}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Status / Existence (cols 6-8) */}
                                <div className="lg:col-span-4 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                      Record / Result Status
                                    </label>
                                    {currentVal.status && (
                                      <span className="text-[10px] font-semibold text-slate-500">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {statusOptions.map(opt => {
                                      const isSelected = currentVal.status === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          disabled={readOnly}
                                          onClick={() => handleStatusChange(item.ref, opt.value)}
                                          className={`px-2.5 py-1.5 rounded-xl border text-left text-[11px] transition-all flex items-center justify-between gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                                            isSelected
                                              ? opt.activeClass
                                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                          }`}
                                          title={opt.label}
                                        >
                                          <span className="truncate">{opt.label}</span>
                                          {isSelected && (
                                            <Check className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Variance / Action (Observations & Notes) (cols 9-12) */}
                                <div className="lg:col-span-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                      Observations & Notes
                                    </label>
                                    {isExceptionOrDiscrepancy && !currentVal.notes && (
                                      <span className="text-[9px] text-amber-600 font-bold animate-pulse">
                                        Notes recommended
                                      </span>
                                    )}
                                  </div>
                                  <textarea
                                    rows={2}
                                    disabled={readOnly}
                                    value={currentVal.notes || ''}
                                    onChange={(e) => handleNotesChange(item.ref, e.target.value)}
                                    placeholder="Observations, reconciliation notes or variance details..."
                                    className={`w-full px-3 py-1.5 text-xs rounded-xl border outline-none transition-all placeholder:text-slate-400 resize-y bg-white ${
                                      isExceptionOrDiscrepancy
                                        ? 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 bg-amber-50/20'
                                        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                    }`}
                                  />
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Next / Previous Navigation Bar between sections */}
                      <div className="p-3.5 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between gap-3">
                        {prevSection ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeSectionId !== 'all') {
                                setActiveSectionId(prevSection.id);
                              } else {
                                const el = document.getElementById(`sec-card-${prevSection.id}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                            <span>Previous ({prevSection.sectionNumber === 1 ? 'Section 1' : prevSection.title})</span>
                          </button>
                        ) : <div />}

                        {nextSection ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (activeSectionId !== 'all') {
                                setActiveSectionId(nextSection.id);
                              } else {
                                const el = document.getElementById(`sec-card-${nextSection.id}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ml-auto"
                          >
                            <span>Next ({nextSection.sectionNumber === 1 ? 'Section 1' : nextSection.title})</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1 ml-auto">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Checklist Completed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {displayedSections.length === 0 && (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                    <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No matching checklist items</p>
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="text-xs text-blue-600 font-bold hover:underline"
                    >
                      Clear search filter
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Summary Bar */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-slate-700">Total Progress:</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[11px]">
                    {stats.evaluated} of {totalItemsCount} items recorded
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {stats.reconciled} Reconciled
                  </span>
                  {stats.discrepancies > 0 && (
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {stats.discrepancies} Discrepancies
                    </span>
                  )}
                  {stats.missing > 0 && (
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {stats.missing} Missing
                    </span>
                  )}
                  {stats.na > 0 && (
                    <span className="text-slate-600 font-semibold flex items-center gap-1">
                      <MinusCircle className="w-3.5 h-3.5" />
                      {stats.na} N/A
                    </span>
                  )}
                </div>

                {!readOnly && stats.evaluated > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Checklist
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
