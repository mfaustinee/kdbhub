import { FieldChecklistResultStatus } from '../types';

export interface FieldChecklistItem {
  ref: string;
  subGroup?: string;
  dataItem: string;
  primarySource: string;
  validationTest: string;
  evidenceDetail: string;
  title: string;
  description: string;
  statusOptions?: string[];
}

export interface FieldChecklistSection {
  id: string;
  sectionNumber: number;
  title: string;
  shortName: string;
  focus: string;
  thresholdDistinction?: {
    title: string;
    description: string;
    points: string[];
  };
  categoryKeywords: string[];
  items: FieldChecklistItem[];
}

export interface StatusOptionConfig {
  value: FieldChecklistResultStatus;
  label: string;
  shortLabel: string;
  color: 'emerald' | 'amber' | 'rose' | 'slate';
  activeClass: string;
  badgeClass: string;
}

export const FIELD_CHECKLIST_STATUS_OPTIONS: StatusOptionConfig[] = [
  {
    value: 'Available & Reconciled',
    label: 'Available & Reconciled',
    shortLabel: 'Reconciled',
    color: 'emerald',
    activeClass: 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-200 shadow-xs font-semibold',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    value: 'Available (Discrepancies)',
    label: 'Available (Discrepancies)',
    shortLabel: 'Discrepancies',
    color: 'amber',
    activeClass: 'bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-200 shadow-xs font-semibold',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    value: 'Not Available / Missing',
    label: 'Not Available / Missing',
    shortLabel: 'Missing',
    color: 'rose',
    activeClass: 'bg-rose-50 text-rose-800 border-rose-500 ring-2 ring-rose-200 shadow-xs font-semibold',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  {
    value: 'Not Applicable (N/A)',
    label: 'Not Applicable (N/A)',
    shortLabel: 'N/A',
    color: 'slate',
    activeClass: 'bg-slate-100 text-slate-700 border-slate-400 ring-2 ring-slate-200 shadow-xs font-semibold',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300'
  }
];

export const getItemStatusOptions = (item: FieldChecklistItem): StatusOptionConfig[] => {
  if (Array.isArray(item.statusOptions) && item.statusOptions.length >= 2) {
    return item.statusOptions.map((opt, idx) => {
      const lower = opt.toLowerCase();
      let color: 'emerald' | 'amber' | 'rose' | 'slate' = 'slate';
      let activeClass = 'bg-slate-100 text-slate-700 border-slate-400 ring-2 ring-slate-200 shadow-xs font-semibold';
      let badgeClass = 'bg-slate-200 text-slate-700 border-slate-300';

      if (
        lower.includes('not applicable') ||
        lower.includes('(n/a)')
      ) {
        color = 'slate';
        activeClass = 'bg-slate-100 text-slate-700 border-slate-400 ring-2 ring-slate-200 shadow-xs font-semibold';
        badgeClass = 'bg-slate-200 text-slate-700 border-slate-300';
      } else if (
        lower.startsWith('no ') ||
        lower.includes('reconciled – no') ||
        lower.includes('verified & adequate') ||
        lower.includes('correct & verified') ||
        lower.includes('correct fee band') ||
        lower.includes('available & complete') ||
        lower.includes('complete & valid') ||
        lower.includes('complete & reconciled') ||
        lower.includes('verified & reconciled') ||
        lower.includes('fully reconciled') ||
        lower.includes('fully confirmed') ||
        lower.includes('complete & consistent') ||
        lower.includes('complete & compliant') ||
        lower.includes('valid & current') ||
        lower === 'verified' ||
        (idx === 0 && !lower.includes('discrep') && !lower.includes('missing') && !lower.includes('incorrect'))
      ) {
        color = 'emerald';
        activeClass = 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-200 shadow-xs font-semibold';
        badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      } else if (
        lower.includes('discrepanc') ||
        lower.includes('variances') ||
        lower.includes('exceptions') ||
        lower.includes('potential') ||
        lower.includes('incorrect') ||
        lower.includes('capacity discrepancy') ||
        lower.includes('fee band discrepancy') ||
        lower.includes('partially') ||
        lower.includes('review required')
      ) {
        color = 'amber';
        activeClass = 'bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-200 shadow-xs font-semibold';
        badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
      } else if (
        lower.includes('missing') ||
        lower.includes('not reconciled') ||
        lower.includes('not confirmed') ||
        lower.includes('not available') ||
        lower.includes('cannot verify') ||
        lower.includes('not supported') ||
        lower.includes('expired') ||
        lower.includes('unable to') ||
        lower.includes('incomplete') ||
        lower.includes('unclear')
      ) {
        color = 'rose';
        activeClass = 'bg-rose-50 text-rose-800 border-rose-500 ring-2 ring-rose-200 shadow-xs font-semibold';
        badgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
      }

      return {
        value: opt,
        label: opt,
        shortLabel: opt.length > 22 ? opt.substring(0, 20) + '...' : opt,
        color,
        activeClass,
        badgeClass
      };
    });
  }
  return FIELD_CHECKLIST_STATUS_OPTIONS;
};

export const COMMON_INSTITUTIONAL_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  // Permit & Regulatory Compliance
  {
    ref: 'CA01',
    subGroup: 'Permit & Regulatory Compliance',
    dataItem: 'Permit Category',
    primarySource: 'Application/permit/register',
    validationTest: 'Confirm category is consistent across all records',
    evidenceDetail: 'Categories Compared',
    title: 'Permit Category',
    description: 'Confirm category is consistent across all records',
    statusOptions: [
      'Correct / Appropriate',
      'Incorrect / Misclassified',
      'Incomplete / Unclear',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CA02',
    subGroup: 'Permit & Regulatory Compliance',
    dataItem: 'Permit Status',
    primarySource: 'Register/status records',
    validationTest: 'Confirm Active/Expired/Suspended/Cancelled etc. against supporting event',
    evidenceDetail: 'Status Evidence',
    title: 'Permit Status',
    description: 'Confirm Active/Expired/Suspended/Cancelled etc. against supporting event',
    statusOptions: [
      'Valid / Active',
      'Expired / Invalid',
      'Pending / Under Renewal',
      'Not Available / Cannot Verify'
    ]
  },
  {
    ref: 'CA03',
    subGroup: 'Permit & Regulatory Compliance',
    dataItem: 'County Single Business Permit',
    primarySource: 'County Permit Issued',
    validationTest: 'Confirm licence exists and belongs to same operator/premises, Compare licence period to KDB permit period',
    evidenceDetail: 'Licence Evidence/Dates',
    title: 'County Single Business Permit',
    description: 'Confirm licence exists and belongs to same operator/premises, Compare licence period to KDB permit period',
    statusOptions: [
      'Available & Valid',
      'Available (Discrepancies)',
      'Expired / Invalid',
      'Not Available / Missing'
    ]
  },
  {
    ref: 'CA04',
    subGroup: 'Permit & Regulatory Compliance',
    dataItem: 'Permit Fee Assessment',
    primarySource: 'Permit/fee schedule/finance',
    validationTest: 'Confirm correct category and applicable fee were used',
    evidenceDetail: 'Assessment',
    title: 'Permit Fee Assessment',
    description: 'Confirm correct category and applicable fee were used',
    statusOptions: [
      'Correct & Reconciled',
      'Discrepancy Identified',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CA05',
    subGroup: 'Permit & Regulatory Compliance',
    dataItem: 'Levy Applicability',
    primarySource: 'Levy records/operations',
    validationTest: 'Establish whether levy applies during period',
    evidenceDetail: 'Basis',
    title: 'Levy Applicability',
    description: 'Establish whether levy applies during period',
    statusOptions: [
      'Applicable & Correctly Applied',
      'Applicable but Not Applied',
      'Not Applicable',
      'Unable to Determine'
    ]
  },

  // Transaction & Data Integrity
  {
    ref: 'CA06',
    subGroup: 'Transaction & Data Integrity',
    dataItem: 'Transaction Completeness',
    primarySource: 'Operational records',
    validationTest: 'Confirm source transactions exist for selected period. (Are the expected transactions present)',
    evidenceDetail: 'Period Tested',
    title: 'Transaction Completeness',
    description: 'Confirm source transactions exist for selected period. (Are the expected transactions present)',
    statusOptions: [
      'Complete & Reconciled',
      'Incomplete (Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CA07',
    subGroup: 'Transaction & Data Integrity',
    dataItem: 'Duplicate Entity Search',
    primarySource: 'Master register',
    validationTest: 'Search name, phone, location, operator and IDs',
    evidenceDetail: 'Duplicate Candidates',
    title: 'Duplicate Entity Search',
    description: 'Search name, phone, location, operator and IDs',
    statusOptions: [
      'No Duplicates Identified',
      'Duplicate Candidates Identified',
      'Review Required',
      'Unable to Determine',
      'Not Applicable'
    ]
  },
  {
    ref: 'CA08',
    subGroup: 'Transaction & Data Integrity',
    dataItem: 'System-To-Source Test',
    primarySource: 'System + source documents',
    validationTest: 'Select system records and locate supporting documents',
    evidenceDetail: 'Sample',
    title: 'System-To-Source Test',
    description: 'Select system records and locate supporting documents',
    statusOptions: [
      'Fully Supported',
      'Partially Supported (Exceptions)',
      'Not Supported',
      'Not Tested / Unable to Verify',
      'Not Applicable'
    ]
  },
  {
    ref: 'CA09',
    subGroup: 'Transaction & Data Integrity',
    dataItem: 'Source-To-System Test',
    primarySource: 'Source documents + system',
    validationTest: 'Select source records and trace to system',
    evidenceDetail: 'Sample',
    title: 'Source-To-System Test',
    description: 'Select source records and trace to system',
    statusOptions: [
      'Fully Traced',
      'Partially Traced (Exceptions)',
      'Not Traced',
      'Not Tested / Unable to Verify',
      'Not Applicable'
    ]
  },

  // Record Quality & Controls
  {
    ref: 'CA10',
    subGroup: 'Record Quality & Controls',
    dataItem: 'Monthly Record Coverage',
    primarySource: 'Registers/files',
    validationTest: "Identify specific missing months rather than simply saying 'missing' (Are records available for all expected reporting periods?)",
    evidenceDetail: 'Months Missing',
    title: 'Monthly Record Coverage',
    description: "Identify specific missing months rather than simply saying 'missing' (Are records available for all expected reporting periods?)",
    statusOptions: [
      'Complete – No Months Missing',
      'Partially Complete – Months Missing',
      'Incomplete / Significant Gaps',
      'Unable to Determine'
    ]
  },
  {
    ref: 'CA11',
    subGroup: 'Record Quality & Controls',
    dataItem: 'Record Usability',
    primarySource: 'Files/system',
    validationTest: 'Confirm records are readable/accessible',
    evidenceDetail: 'Usability',
    title: 'Record Usability',
    description: 'Confirm records are readable/accessible',
    statusOptions: [
      'Fully Usable',
      'Partially Usable (Issues Identified)',
      'Not Usable',
      'Not Available'
    ]
  },

  // Data Extraction & Historical Issues
  {
    ref: 'CA12',
    subGroup: 'Data Extraction & Historical Issues',
    dataItem: 'Extraction Controls',
    primarySource: 'System report',
    validationTest: 'Record report name, date, filters and period',
    evidenceDetail: 'Extraction Details',
    title: 'Extraction Controls',
    description: 'Record report name, date, filters and period',
    statusOptions: [
      'Complete & Adequate',
      'Partially Complete / Exceptions',
      'Inadequate / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CA13',
    subGroup: 'Data Extraction & Historical Issues',
    dataItem: 'Previous Exceptions',
    primarySource: 'Exception register',
    validationTest: 'Reconcile opening exceptions to resolved/carried-forward items',
    evidenceDetail: 'Exception Movement',
    title: 'Previous Exceptions',
    description: 'Reconcile opening exceptions to resolved/carried-forward items',
    statusOptions: [
      'Fully Resolved',
      'Partially Resolved / Carried Forward',
      'Unresolved',
      'No Previous Exceptions / N/A'
    ]
  }
];

export const COOLING_PLANT_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  // Cooling Plant & Regulatory Information
  {
    ref: 'CP01',
    subGroup: 'Cooling Plant & Regulatory Information',
    dataItem: 'Permit Category & Cooling Plant Identity',
    primarySource: 'Application/permit/register',
    validationTest: 'Confirm entity is classified as cooling plant, Reconcile plant name and identifier',
    evidenceDetail: 'Category evidence/ Plant ID',
    title: 'Permit Category & Cooling Plant Identity',
    description: 'Confirm entity is classified as cooling plant, Reconcile plant name and identifier',
    statusOptions: [
      'Correct & Verified',
      'Incorrect / Misclassified',
      'Incomplete / Unclear',
      'Not Available / Cannot Verify'
    ]
  },
  {
    ref: 'CP02',
    subGroup: 'Cooling Plant & Regulatory Information',
    dataItem: 'Cooling Capacity',
    primarySource: 'Application/permit/asset records',
    validationTest: 'Compare recorded cooling capacity and units',
    evidenceDetail: 'Capacity',
    title: 'Cooling Capacity',
    description: 'Compare recorded cooling capacity and units',
    statusOptions: [
      'Verified & Adequate',
      'Verified – Capacity Discrepancy',
      'Not Supported / Cannot Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP03',
    subGroup: 'Cooling Plant & Regulatory Information',
    dataItem: 'Fee-Band Capacity',
    primarySource: 'Permit/fee assessment',
    validationTest: 'Where applicable, confirm whether capacity falls below/above relevant fee threshold',
    evidenceDetail: 'Capacity/fee band',
    title: 'Fee-Band Capacity',
    description: 'Where applicable, confirm whether capacity falls below/above relevant fee threshold',
    statusOptions: [
      'Correct Fee Band',
      'Incorrect Fee Band',
      'Capacity/Fee Band Discrepancy',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },

  // Producer & Supplier Records
  {
    ref: 'CP04',
    subGroup: 'Producer & Supplier Records',
    dataItem: 'Primary Producer Register & Member Contracts',
    primarySource: 'Producer Register & Member Contracts',
    validationTest: 'Validate comprehensive register of dairy farmers/groups (Name, ID, KRA PIN, Location, Bank/M-Pesa details, Contract).',
    evidenceDetail: 'Producer ID, contract, milk volume, membership status',
    title: 'Primary Producer Register & Member Contracts',
    description: 'Validate comprehensive register of dairy farmers/groups (Name, ID, KRA PIN, Location, Bank/M-Pesa details, Contract).',
    statusOptions: [
      'Available & Complete',
      'Available – Incomplete / Discrepancies',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP05',
    subGroup: 'Producer & Supplier Records',
    dataItem: 'Supplier/Producer Records',
    primarySource: 'Supplier/intake register',
    validationTest: 'Reconcile supplier quantities to total plant intake',
    evidenceDetail: 'Supplier total',
    title: 'Supplier/Producer Records',
    description: 'Reconcile supplier quantities to total plant intake',
    statusOptions: [
      'Complete & Valid',
      'Incomplete / Discrepancies Identified',
      'Not Available / Missing',
      'Unable to Determine'
    ]
  },
  {
    ref: 'CP06',
    subGroup: 'Producer & Supplier Records',
    dataItem: 'Supplier Duplicate Records',
    primarySource: 'Supplier register',
    validationTest: 'Search duplicate suppliers and transactions',
    evidenceDetail: 'Duplicates',
    title: 'Supplier Duplicate Records',
    description: 'Search duplicate suppliers and transactions',
    statusOptions: [
      'No Duplicate Records Identified',
      'Duplicate Records Identified – Review Required',
      'Potential Duplicates Identified',
      'Unable to Determine'
    ]
  },

  // Milk Movement & Reconciliation
  {
    ref: 'CP07',
    subGroup: 'Milk Movement & Reconciliation',
    dataItem: 'Daily Milk Intake Vs Dispatch Reconciliation',
    primarySource: 'Stock/intake records',
    validationTest: 'Reconcile total raw milk intake from farmers against total bulk milk dispatched to processors/transporters.',
    evidenceDetail: 'Quantity',
    title: 'Daily Milk Intake Vs Dispatch Reconciliation',
    description: 'Reconcile total raw milk intake from farmers against total bulk milk dispatched to processors/transporters.',
    statusOptions: [
      'Reconciled – No Material Variances',
      'Reconciled – Variances Identified',
      'Not Reconciled',
      'Incomplete Records / Unable to Reconcile',
      'Not Applicable (N/A)'
    ]
  },

  // Supporting Reconciliation Components
  {
    ref: 'CP08',
    subGroup: 'Supporting Reconciliation Components',
    dataItem: 'Opening Milk Balance',
    primarySource: 'Stock/intake records',
    validationTest: 'Confirm opening balance agrees to prior closing balance',
    evidenceDetail: 'Opening balance',
    title: 'Opening Milk Balance',
    description: 'Confirm opening balance agrees to prior closing balance',
    statusOptions: [
      'Verified',
      'Discrepancy Identified',
      'Not Available / Cannot Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP09',
    subGroup: 'Supporting Reconciliation Components',
    dataItem: 'Milk Received',
    primarySource: 'Intake records',
    validationTest: 'Reconcile receipts to supplier records',
    evidenceDetail: 'Quantity',
    title: 'Milk Received',
    description: 'Reconcile receipts to supplier records',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine'
    ]
  },
  {
    ref: 'CP10',
    subGroup: 'Supporting Reconciliation Components',
    dataItem: 'Milk Dispatched',
    primarySource: 'Dispatch notes',
    validationTest: 'Match outbound quantities to receiving records where available',
    evidenceDetail: 'Dispatch',
    title: 'Milk Dispatched',
    description: 'Match outbound quantities to receiving records where available',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine'
    ]
  },
  {
    ref: 'CP11',
    subGroup: 'Supporting Reconciliation Components',
    dataItem: 'Closing Balance',
    primarySource: 'Stock records',
    validationTest: 'Test opening + receipts − dispatches ± adjustments = closing',
    evidenceDetail: 'Recalculation',
    title: 'Closing Balance',
    description: 'Test opening + receipts − dispatches ± adjustments = closing',
    statusOptions: [
      'Verified & Reconciled',
      'Discrepancy Identified',
      'Not Available / Cannot Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Sales / Dispatch & Invoice Reconciliation
  {
    ref: 'CP12',
    subGroup: 'Sales / Dispatch & Invoice Reconciliation',
    dataItem: 'Dispatch-To-Invoice Reconciliation',
    primarySource: 'Dispatch/invoices',
    validationTest: 'Match quantities and dates',
    evidenceDetail: 'Variance',
    title: 'Dispatch-To-Invoice Reconciliation',
    description: 'Match quantities and dates',
    statusOptions: [
      'Fully Reconciled',
      'Reconciled – Discrepancies Identified',
      'Not Reconciled',
      'Incomplete Records / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP13',
    subGroup: 'Sales / Dispatch & Invoice Reconciliation',
    dataItem: 'Receiving-Side Confirmation',
    primarySource: 'Receiving records where available',
    validationTest: 'Match sampled outbound transactions to recipient records',
    evidenceDetail: 'Matched items',
    title: 'Receiving-Side Confirmation',
    description: 'Match sampled outbound transactions to recipient records',
    statusOptions: [
      'Fully Confirmed',
      'Partially Confirmed – Exceptions Identified',
      'Not Confirmed',
      'Not Available / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Analytical / Exception Testing
  {
    ref: 'CP14',
    subGroup: 'Analytical / Exception Testing',
    dataItem: 'Zero Activity',
    primarySource: 'Intake records',
    validationTest: 'Determine whether zero means no activity or missing data',
    evidenceDetail: 'Evidence',
    title: 'Zero Activity',
    description: 'Determine whether zero means no activity or missing data',
    statusOptions: [
      'No Zero-Activity Records Identified',
      'Zero-Activity Records Identified – Review Required',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP15',
    subGroup: 'Analytical / Exception Testing',
    dataItem: 'Abnormal Volumes',
    primarySource: 'Daily summaries',
    validationTest: 'Identify spikes, repeated identical figures, negative values',
    evidenceDetail: 'Exceptions',
    title: 'Abnormal Volumes',
    description: 'Identify spikes, repeated identical figures, negative values',
    statusOptions: [
      'No Abnormal Volumes Identified',
      'Abnormal Volumes Identified – Review Required',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },

  // Quality & Payment Records
  {
    ref: 'CP16',
    subGroup: 'Quality & Payment Records',
    dataItem: 'Quality-Based Payment (Fat & Snf) Records',
    primarySource: 'Quality & Payment Records',
    validationTest: 'Verify milk testing logs (fat %, SNF, density, platform tests) and corresponding quality-based price adjustments',
    evidenceDetail: 'Fat %, SNF %, test date, quantity, applicable rate, farmer payout',
    title: 'Quality-Based Payment (Fat & Snf) Records',
    description: 'Verify milk testing logs (fat %, SNF, density, platform tests) and corresponding quality-based price adjustments',
    statusOptions: [
      'Complete & Consistent',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CP17',
    subGroup: 'Quality & Payment Records',
    dataItem: 'Deductions & Farmer Payout Statements',
    primarySource: 'Payout Statements & Deduction Records',
    validationTest: 'Reconcile monthly farmer payout schedules, itemized deductions (transport, feed, advances), and farm-gate net payouts.',
    evidenceDetail: 'Gross payout, deductions, net payment, payment date',
    title: 'Deductions & Farmer Payout Statements',
    description: 'Reconcile monthly farmer payout schedules, itemized deductions (transport, feed, advances), and farm-gate net payouts.',
    statusOptions: [
      'Complete & Compliant',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Measurement & Calibration Controls
  {
    ref: 'CP18',
    subGroup: 'Measurement & Calibration Controls',
    dataItem: 'Calibration Certificates For Testing & Weighing',
    primarySource: 'Calibration Certificates & Equipment Register',
    validationTest: 'Check valid calibration tags/certificates for weigh bowls, dipsticks, thermometers, and lactometers.',
    evidenceDetail: 'Equipment ID, calibration date, validity, results',
    title: 'Calibration Certificates For Testing & Weighing',
    description: 'Check valid calibration tags/certificates for weigh bowls, dipsticks, thermometers, and lactometers.',
    statusOptions: [
      'Valid & Current',
      'Valid – Exceptions Identified',
      'Expired / Out of Date',
      'Not Available / Missing',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  }
];

export const PROCESSOR_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  // Enterprise Milk Intake & Route Reconciliation
  {
    ref: 'PR01',
    subGroup: 'Enterprise Milk Intake & Route Reconciliation',
    dataItem: 'Enterprise Raw Milk Intake & Route Reconciliation',
    primarySource: 'Intake records',
    validationTest: 'Reconcile tanker weighbridge tickets, route collection manifests, and factory reception tank receipts daily',
    evidenceDetail: 'Quantity*/Day',
    title: 'Enterprise Raw Milk Intake & Route Reconciliation',
    description: 'Reconcile tanker weighbridge tickets, route collection manifests, and factory reception tank receipts daily',
    statusOptions: [
      'Complete & Reconciled – No Material Variances',
      'Reconciled – Variances Identified',
      'Not Reconciled',
      'Incomplete / Unable to Reconcile',
      'Not Applicable (N/A)'
    ]
  },

  // Supporting Checks (Intake)
  {
    ref: 'PR02',
    subGroup: 'Supporting Checks (Intake & Purchases)',
    dataItem: 'Raw Milk Received',
    primarySource: 'Intake records',
    validationTest: 'Reconcile purchases/receipts to supplier records',
    evidenceDetail: 'Quantity',
    title: 'Raw Milk Received',
    description: 'Reconcile purchases/receipts to supplier records',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR03',
    subGroup: 'Supporting Checks (Intake & Purchases)',
    dataItem: 'Supplier Invoices',
    primarySource: 'Supplier/finance records',
    validationTest: 'Match milk purchases to invoices',
    evidenceDetail: 'Invoice sample',
    title: 'Supplier Invoices',
    description: 'Match milk purchases to invoices',
    statusOptions: [
      'Complete & Supported',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR04',
    subGroup: 'Supporting Checks (Intake & Purchases)',
    dataItem: 'Supplier Payments',
    primarySource: 'Finance/supplier ledger',
    validationTest: 'Reconcile purchases to payment records',
    evidenceDetail: 'Payment status',
    title: 'Supplier Payments',
    description: 'Reconcile purchases to payment records',
    statusOptions: [
      'Complete & Reconciled',
      'Payment Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Production Yield & Shrinkage
  {
    ref: 'PR05',
    subGroup: 'Production Yield & Shrinkage',
    dataItem: 'Multi-Line Production Yield & Shrinkage Analysis',
    primarySource: 'Production records',
    validationTest: 'Validate yield variance reports across ESL, UHT, Powder, Butter, and Fermented lines. Investigating unaccounted losses > 1%.',
    evidenceDetail: 'Quantity*',
    title: 'Multi-Line Production Yield & Shrinkage Analysis',
    description: 'Validate yield variance reports across ESL, UHT, Powder, Butter, and Fermented lines. Investigating unaccounted losses > 1%.',
    statusOptions: [
      'Complete & Within Expected Parameters',
      'Variances Identified – Within Tolerance',
      'Abnormal Yield / Shrinkage Identified',
      'Incomplete / Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },

  // Supporting Checks (Production & Yield)
  {
    ref: 'PR06',
    subGroup: 'Supporting Checks (Production & Yield)',
    dataItem: 'Processing Quantity/Day',
    primarySource: 'Production records',
    validationTest: 'Compare actual daily processing with permit',
    evidenceDetail: 'Daily quantity',
    title: 'Processing Quantity/Day',
    description: 'Compare actual daily processing with permit',
    statusOptions: [
      'Consistent & Within Expected Range',
      'Variances Identified',
      'Excessive / Unusual Processing Activity',
      'Incomplete / Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR07',
    subGroup: 'Supporting Checks (Production & Yield)',
    dataItem: 'Processing Capacity',
    primarySource: 'Permit/asset records',
    validationTest: 'Reconcile recorded capacity',
    evidenceDetail: 'Capacity',
    title: 'Processing Capacity',
    description: 'Reconcile recorded capacity',
    statusOptions: [
      'Within Declared / Permitted Capacity',
      'Capacity Exceeded',
      'Capacity Discrepancy Identified',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR08',
    subGroup: 'Supporting Checks (Production & Yield)',
    dataItem: 'Production Output',
    primarySource: 'Production records',
    validationTest: 'Reconcile input to output',
    evidenceDetail: 'Yield/variance',
    title: 'Production Output',
    description: 'Reconcile input to output',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR09',
    subGroup: 'Supporting Checks (Production & Yield)',
    dataItem: 'Processing Losses',
    primarySource: 'Production records',
    validationTest: 'Confirm documented losses/adjustments',
    evidenceDetail: 'Loss records',
    title: 'Processing Losses',
    description: 'Confirm documented losses/adjustments',
    statusOptions: [
      'Within Expected / Permitted Range',
      'Elevated Losses Identified',
      'Abnormal / Unsupported Losses',
      'Incomplete / Missing Loss Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR10',
    subGroup: 'Supporting Checks (Production & Yield)',
    dataItem: 'Finished Product Stock',
    primarySource: 'Stock records',
    validationTest: 'Reconcile opening + production − sales = closing',
    evidenceDetail: 'Stock variance',
    title: 'Finished Product Stock',
    description: 'Reconcile opening + production − sales = closing',
    statusOptions: [
      'Reconciled – No Variance',
      'Reconciled – Variance Identified',
      'Not Reconciled',
      'Incomplete / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Classification & Fee Assessment
  {
    ref: 'PR11',
    subGroup: 'Classification & Fee Assessment',
    dataItem: 'Processor Classification',
    primarySource: 'Application/permit',
    validationTest: 'Confirm category',
    evidenceDetail: 'Classification evidence',
    title: 'Processor Classification',
    description: 'Confirm category',
    statusOptions: [
      'Correct & Supported',
      'Incorrect / Misclassified',
      'Classification Unclear',
      'Supporting Evidence Incomplete',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR12',
    subGroup: 'Classification & Fee Assessment',
    dataItem: 'Fee-Band Threshold',
    primarySource: 'Fee assessment',
    validationTest: 'Independently test applicable fee band. determines which fee/rate applies within the relevant framework.',
    evidenceDetail: 'Refer to KDB Regulations, 2021',
    title: 'Fee-Band Threshold',
    description: 'Independently test applicable fee band. determines which fee/rate applies within the relevant framework.',
    statusOptions: [
      'Correct Fee Band / Threshold',
      'Incorrect Fee Band / Threshold',
      'Threshold Discrepancy Identified',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Sales & Dispatch
  {
    ref: 'PR13',
    subGroup: 'Sales & Dispatch',
    dataItem: 'Sales Quantity',
    primarySource: 'Sales ledger',
    validationTest: 'Reconcile sales to production/stock',
    evidenceDetail: 'Sales variance',
    title: 'Sales Quantity',
    description: 'Reconcile sales to production/stock',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'PR14',
    subGroup: 'Sales & Dispatch',
    dataItem: 'Dispatch Quantity',
    primarySource: 'Dispatch records',
    validationTest: 'Reconcile dispatch to invoices',
    evidenceDetail: 'Quantity',
    title: 'Dispatch Quantity',
    description: 'Reconcile dispatch to invoices',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Imported Dairy & Reporting
  {
    ref: 'PR15',
    subGroup: 'Imported Dairy & Reporting',
    dataItem: 'Imported Dairy Produce',
    primarySource: 'Import/levy records',
    validationTest: 'Reconcile imported quantities/value where applicable',
    evidenceDetail: 'Import evidence',
    title: 'Imported Dairy Produce',
    description: 'Reconcile imported quantities/value where applicable',
    statusOptions: [
      'None Identified / Not Applicable',
      'Imports Identified & Properly Recorded',
      'Imports Identified – Classification / Reporting Issue',
      'Records Incomplete / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Contract Farming & Farmer Payments
  {
    ref: 'PR16',
    subGroup: 'Contract Farming & Farmer Payments',
    dataItem: 'Contract Farming & Mass Payout Reconciliation',
    primarySource: 'Farmer Register/Finance',
    validationTest: 'Audit electronic payout files for thousands of suppliers, verifying farm-gate price compliance and unauthorized fee deductions.',
    evidenceDetail: 'Payments',
    title: 'Contract Farming & Mass Payout Reconciliation',
    description: 'Audit electronic payout files for thousands of suppliers, verifying farm-gate price compliance and unauthorized fee deductions.',
    statusOptions: [
      'Complete & Reconciled – No Material Variances',
      'Reconciled – Variances Identified',
      'Payment / Contract Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  }
];

export const MILK_BAR_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'MB01',
    dataItem: 'Daily Milk Intake & Purchase Register',
    primarySource: 'Daily Register/ Purchase Records',
    validationTest: 'Verify daily volume received (liters), supplier identities, delivery time, and intake temperatures against purchase receipts.',
    evidenceDetail: 'Evidence',
    title: 'Daily Milk Intake & Purchase Register',
    description: 'Verify daily volume received (liters), supplier identities, delivery time, and intake temperatures against purchase receipts.',
    statusOptions: [
      'Available & Reconciled',
      'Available (Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MB02',
    dataItem: 'Daily Dispensing / Sales Cash Book',
    primarySource: 'Sales Records',
    validationTest: 'Reconcile daily volume sold against total cash/M-Pesa revenue logged. Verify no unrecorded spillages or shrinkage.',
    evidenceDetail: 'Evidence',
    title: 'Daily Dispensing / Sales Cash Book',
    description: 'Reconcile daily volume sold against total cash/M-Pesa revenue logged. Verify no unrecorded spillages or shrinkage.',
    statusOptions: [
      'Available & Reconciled',
      'Available (Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MB03',
    subGroup: 'Sales Analytics / Exception Tests',
    dataItem: 'Sales Analytics – Missing Periods Test',
    primarySource: 'Sales Register',
    validationTest: 'Identify exact days/months without records',
    evidenceDetail: 'Periods',
    title: 'Sales Analytics – Missing Periods',
    description: 'Identify exact days/months without records',
    statusOptions: [
      'No Periods Missing',
      'Periods Missing (Specify)',
      'Records Incomplete / Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MB04',
    subGroup: 'Sales Analytics / Exception Tests',
    dataItem: 'Sales Analytics – Zero Activity vs Missing Records',
    primarySource: 'Sales Register',
    validationTest: 'Distinguish zero activity from missing records',
    evidenceDetail: 'Evidence',
    title: 'Sales Analytics – Zero Activity vs Missing Records',
    description: 'Distinguish zero activity from missing records',
    statusOptions: [
      'No Zero-Sales Periods',
      'Zero Sales Identified (Specify)',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MB05',
    subGroup: 'Sales Analytics / Exception Tests',
    dataItem: 'Sales Analytics – Abnormal Sales & Adjustments',
    primarySource: 'Sales Register',
    validationTest: 'Identify spikes, repeated figures or negative adjustments',
    evidenceDetail: 'Exception',
    title: 'Sales Analytics – Abnormal Sales & Adjustments',
    description: 'Identify spikes, repeated figures or negative adjustments',
    statusOptions: [
      'No Abnormal Sales Identified',
      'Abnormal Sales Identified (Specify)',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MB06',
    dataItem: 'Traceability Delivery Notes & Supplier Details',
    primarySource: 'Delivery Notes & Supplier Register',
    validationTest: 'Trace delivery note → supplier → quantity → lot/batch → receipt/sale.',
    evidenceDetail: 'Supplier, delivery date, quantity, lot/batch, delivery note',
    title: 'Traceability Delivery Notes & Supplier Details',
    description: 'Trace delivery note → supplier → quantity → lot/batch → receipt/sale.',
    statusOptions: [
      'Available & Fully Traceable',
      'Available (Traceability Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  }
];

export const DISPENSER_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'DP01',
    dataItem: 'Commercial Sourcing & Pasteurization Certificates',
    primarySource: 'Sourcing & Pasteurization Records',
    validationTest: 'Validate batch-wise certificates of pasteurization from authorized processors for every batch loaded into dispenser.',
    evidenceDetail: 'Supplier, quantity, pasteurization date, certificate',
    title: 'Commercial Sourcing & Pasteurization Certificates',
    description: 'Validate batch-wise certificates of pasteurization from authorized processors for every batch loaded into dispenser.',
    statusOptions: [
      'Available & Reconciled',
      'Available (Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'DP02',
    dataItem: 'Maintenance, Cleaning & Calibration Logs',
    primarySource: 'Maintenance & Calibration Logs',
    validationTest: 'Verify calibration certificates for automated volume meters and temperature sensors',
    evidenceDetail: 'Equipment, service date, calibration, cleaning record',
    title: 'Maintenance, Cleaning & Calibration Logs',
    description: 'Verify calibration certificates for automated volume meters and temperature sensors',
    statusOptions: [
      'Available & Complete',
      'Available (Gaps / Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'DP03',
    dataItem: 'Spillage, Cleaning Loss & Waste Variance Log',
    primarySource: 'Waste & Loss Records',
    validationTest: 'Reconcile daily milk tank loading volume vs (Sales + Spillage/Rinse Losses). Discrepancy threshold > 1.5% flagged.',
    evidenceDetail: 'Date, quantity, reason, disposal/approval',
    title: 'Spillage, Cleaning Loss & Waste Variance Log',
    description: 'Reconcile daily milk tank loading volume vs (Sales + Spillage/Rinse Losses). Discrepancy threshold > 1.5% flagged.',
    statusOptions: [
      'Available & Reconciled',
      'Available (Variances / Discrepancies)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'DP04',
    dataItem: 'Meter & Product Reconciliation',
    primarySource: 'Meter Readings & Product Records',
    validationTest: 'Product type, opening meter reading, closing meter reading, Product supplied, Stock balance and Cash/receipts',
    evidenceDetail: 'Opening/closing readings, production, sales, variance',
    title: 'Meter & Product Reconciliation',
    description: 'Product type, opening meter reading, closing meter reading, Product supplied, Stock balance and Cash/receipts',
    statusOptions: [
      'Complete & Reconciled',
      'Available (Discrepancies)',
      'Incomplete / Missing',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'DP05',
    dataItem: 'Meter Exceptions & Adjustments',
    primarySource: 'Machine/sales records',
    validationTest: 'Identify and verify manual adjustments, resets and explanations, while detecting negative, duplicate, or repeated readings and distinguishing no sales from unavailable machine data.',
    evidenceDetail: 'Adjustment, Reset evidence, Exception, Evidence',
    title: 'Meter Exceptions & Adjustments',
    description: 'Identify and verify manual adjustments, resets and explanations, while detecting negative, duplicate, or repeated readings and distinguishing no sales from unavailable machine data.',
    statusOptions: [
      'No Exceptions Identified',
      'Exceptions Identified (Specify)',
      'Records Incomplete / Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'DP06',
    dataItem: 'Traceability Batch & Expiry Tagging',
    primarySource: 'Batch & Expiry Records',
    validationTest: 'Confirm clear labeling on dispenser tanks indicating batch number, pasteurization date, and mandatory expiry timeframe.',
    evidenceDetail: 'Batch number, production date, expiry date, product',
    title: 'Traceability Batch & Expiry Tagging',
    description: 'Confirm clear labeling on dispenser tanks indicating batch number, pasteurization date, and mandatory expiry timeframe.',
    statusOptions: [
      'Complete & Traceable',
      'Available (Traceability / Tagging Gaps)',
      'Not Available / Missing',
      'Not Applicable (N/A)'
    ]
  }
];

export const COTTAGE_INDUSTRY_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  // Raw Milk Intake, Production & Conversion
  {
    ref: 'CI01',
    subGroup: 'Raw Milk Intake, Production & Conversion',
    dataItem: 'Raw Milk Intake vs Production Conversion Log',
    primarySource: 'Intake Register',
    validationTest: 'Reconcile liters of raw milk input against total units produced (e.g., 10L raw milk = 1kg cheese / 10L yoghurt).',
    evidenceDetail: 'Quantity',
    title: 'Raw Milk Intake vs Production Conversion Log',
    description: 'Reconcile liters of raw milk input against total units produced (e.g., 10L raw milk = 1kg cheese / 10L yoghurt).',
    statusOptions: [
      'Complete & Reconciled',
      'Reconciled – Discrepancies Identified',
      'Not Reconciled',
      'Incomplete / Unable to Reconcile',
      'Not Applicable (N/A)'
    ]
  },

  // Supporting / Analytical tests
  {
    ref: 'CI02',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Sustained Throughput',
    primarySource: 'Monthly records',
    validationTest: 'Identify repeated threshold exceedances',
    evidenceDetail: 'Trend',
    title: 'Sustained Throughput',
    description: 'Identify repeated threshold exceedances',
    statusOptions: [
      'Consistent / Within Expected Range',
      'Variances Identified',
      'Unusual / Sustained High or Low Throughput',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI03',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Raw Milk Purchases',
    primarySource: 'Supplier records',
    validationTest: 'Reconcile purchases to production',
    evidenceDetail: 'Quantity',
    title: 'Raw Milk Purchases',
    description: 'Reconcile purchases to production',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI04',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Supplier Payments',
    primarySource: 'Finance records',
    validationTest: 'Match purchases to payments',
    evidenceDetail: 'Amount',
    title: 'Supplier Payments',
    description: 'Match purchases to payments',
    statusOptions: [
      'Complete & Reconciled',
      'Payment Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI05',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Production Output',
    primarySource: 'Production records',
    validationTest: 'Reconcile input to output',
    evidenceDetail: 'Yield',
    title: 'Production Output',
    description: 'Reconcile input to output',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI06',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Sales Quantity',
    primarySource: 'Sales records',
    validationTest: 'Reconcile production to sales',
    evidenceDetail: 'Quantity',
    title: 'Sales Quantity',
    description: 'Reconcile production to sales',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI07',
    subGroup: 'Supporting / Analytical tests',
    dataItem: 'Stock Balance',
    primarySource: 'Stock records',
    validationTest: 'Reconcile opening + production − sales = closing',
    evidenceDetail: 'Variance',
    title: 'Stock Balance',
    description: 'Reconcile opening + production − sales = closing',
    statusOptions: [
      'Reconciled – No Material Variance',
      'Reconciled – Variance Identified',
      'Not Reconciled',
      'Incomplete / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Product & Customer Classification
  {
    ref: 'CI08',
    subGroup: 'Product & Customer Classification',
    dataItem: 'Product Scope',
    primarySource: 'Permit/production',
    validationTest: 'Compare permitted products to actual products',
    evidenceDetail: 'Products',
    title: 'Product Scope',
    description: 'Compare permitted products to actual products',
    statusOptions: [
      'Correct & Complete',
      'Incorrect / Misclassified',
      'Incomplete / Unclear',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI09',
    subGroup: 'Product & Customer Classification',
    dataItem: 'Buyer Class',
    primarySource: 'Permit/sales',
    validationTest: 'Compare actual buyers/channels',
    evidenceDetail: 'Buyer',
    title: 'Buyer Class',
    description: 'Compare actual buyers/channels',
    statusOptions: [
      'Correctly Classified',
      'Classification Errors Identified',
      'Incomplete / Unclear',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },

  // Data Completeness & Anomaly Testing
  {
    ref: 'CI10',
    subGroup: 'Data Completeness & Anomaly Testing',
    dataItem: 'Missing Periods',
    primarySource: 'Records/files',
    validationTest: 'Identify exact missing months/days',
    evidenceDetail: 'Periods',
    title: 'Missing Periods',
    description: 'Identify exact missing months/days',
    statusOptions: [
      'No Periods Missing',
      'Periods Missing – Specify',
      'Records Incomplete / Significant Gaps',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI11',
    subGroup: 'Data Completeness & Anomaly Testing',
    dataItem: 'Related / Duplicate Records',
    primarySource: 'Master register',
    validationTest: 'Search same operator/location/contact',
    evidenceDetail: 'Duplicates',
    title: 'Related / Duplicate Records',
    description: 'Search same operator/location/contact',
    statusOptions: [
      'No Duplicate / Related Records Identified',
      'Duplicate Records Identified – Review Required',
      'Potential Related Records Identified',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI12',
    subGroup: 'Data Completeness & Anomaly Testing',
    dataItem: 'Split Activity',
    primarySource: 'Master/transaction records',
    validationTest: 'Check whether activity appears divided across multiple records',
    evidenceDetail: 'Related records',
    title: 'Split Activity',
    description: 'Check whether activity appears divided across multiple records',
    statusOptions: [
      'No Split Activity Identified',
      'Split Activity Identified – Review Required',
      'Potential Split Activity Identified',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'CI13',
    subGroup: 'Data Completeness & Anomaly Testing',
    dataItem: 'Classification Change',
    primarySource: 'Throughput trend',
    validationTest: 'Determine whether data indicates need for classification review',
    evidenceDetail: 'Trend/evidence',
    title: 'Classification Change',
    description: 'Determine whether data indicates need for classification review',
    statusOptions: [
      'No Unexplained Classification Changes',
      'Classification Changes Identified – Review Required',
      'Potential Unexplained Changes',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },

  // Batch Production & Ingredient Traceability
  {
    ref: 'CI14',
    subGroup: 'Batch Production & Ingredient Traceability',
    dataItem: 'Batch Production Logs & Ingredient Traceability',
    primarySource: 'Batch Production & Ingredient Records',
    validationTest: 'Verify batch manufacturing records, cultures/additives used, batch numbers, pasteurization logs, and expiry dates.',
    evidenceDetail: 'Batch/lot, ingredients, quantities, production date, line, output and lot linkage',
    title: 'Batch Production Logs & Ingredient Traceability',
    description: 'Verify batch manufacturing records, cultures/additives used, batch numbers, pasteurization logs, and expiry dates.',
    statusOptions: [
      'Complete & Fully Traceable',
      'Traceable – Exceptions Identified',
      'Incomplete / Traceability Gaps',
      'Not Available / Missing',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Finished Goods, Inventory & Sales
  {
    ref: 'CI15',
    subGroup: 'Finished Goods, Inventory & Sales',
    dataItem: 'Finished Goods Inventory & Sales Ledger',
    primarySource: 'Finished Goods Register & Sales Ledger',
    validationTest: 'Reconcile starting inventory + production - sales = closing inventory across all product lines (Yoghurt, Butter, Ghee).',
    evidenceDetail: 'Product/lot, opening stock, production, sales, dispatch, closing stock, invoices',
    title: 'Finished Goods Inventory & Sales Ledger',
    description: 'Reconcile starting inventory + production - sales = closing inventory across all product lines (Yoghurt, Butter, Ghee).',
    statusOptions: [
      'Complete & Reconciled',
      'Reconciled – Discrepancies Identified',
      'Incomplete / Missing Records',
      'Not Reconciled',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Recall & Quality Controls
  {
    ref: 'CI16',
    subGroup: 'Recall & Quality Controls',
    dataItem: 'Product Recall & Quality Non-Conformance Log',
    primarySource: 'Recall & Non-Conformance Register',
    validationTest: 'Check documented product recall procedure, customer complaint register, and records of rejected/recalled batches.',
    evidenceDetail: 'Recall cases, product/lot, issue, quantity, date, corrective action, closure status',
    title: 'Product Recall & Quality Non-Conformance Log',
    description: 'Check documented product recall procedure, customer complaint register, and records of rejected/recalled batches.',
    statusOptions: [
      'Complete & Current',
      'Exceptions / Non-Conformances Identified',
      'Incomplete / Missing Records',
      'Not Available',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  }
];

export const MINI_DAIRY_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  // Raw Milk Intake & Processing
  {
    ref: 'MD01',
    subGroup: 'Raw Milk Intake & Processing',
    dataItem: 'Raw Milk Intake vs Processing Mass Balance',
    primarySource: 'Intake/production records',
    validationTest: 'Perform mass balance reconciliation: Intake (Liters) vs Packaged Milk + Value-Add Products + Separated Cream + Process Loss.',
    evidenceDetail: 'Quantity',
    title: 'Raw Milk Intake vs Processing Mass Balance',
    description: 'Perform mass balance reconciliation: Intake (Liters) vs Packaged Milk + Value-Add Products + Separated Cream + Process Loss.',
    statusOptions: [
      'Complete & Reconciled – No Material Variances',
      'Reconciled – Variances Identified',
      'Not Reconciled',
      'Incomplete / Unable to Reconcile',
      'Not Applicable (N/A)'
    ]
  },

  // Supporting / Analytical Components
  {
    ref: 'MD02',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Daily Handling',
    primarySource: 'Intake/production records',
    validationTest: 'Reconcile daily activity',
    evidenceDetail: 'Quantity',
    title: 'Daily Handling',
    description: 'Reconcile daily activity',
    statusOptions: [
      'Consistent with Records & Expected Activity',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD03',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Classification Period',
    primarySource: 'Permit/throughput data',
    validationTest: 'Establish evidence period used for classification',
    evidenceDetail: 'Period',
    title: 'Classification Period',
    description: 'Establish evidence period used for classification',
    statusOptions: [
      'Correct & Consistent',
      'Period Classification Discrepancies Identified',
      'Incomplete / Unclear',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD04',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Processing Capacity',
    primarySource: 'Permit/asset records',
    validationTest: 'Reconcile capacity',
    evidenceDetail: 'Capacity',
    title: 'Processing Capacity',
    description: 'Reconcile capacity',
    statusOptions: [
      'Within Declared / Permitted Capacity',
      'Capacity Exceeded / Discrepancy Identified',
      'Capacity Cannot Be Verified',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD05',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Raw Milk Purchases',
    primarySource: 'Supplier records',
    validationTest: 'Reconcile purchases to intake',
    evidenceDetail: 'Quantity',
    title: 'Raw Milk Purchases',
    description: 'Reconcile purchases to intake',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD06',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Supplier Payments',
    primarySource: 'Finance records',
    validationTest: 'Match purchases to payments',
    evidenceDetail: 'Amount',
    title: 'Supplier Payments',
    description: 'Match purchases to payments',
    statusOptions: [
      'Complete & Reconciled',
      'Payment Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD07',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Production Output',
    primarySource: 'Production records',
    validationTest: 'Reconcile inputs to outputs',
    evidenceDetail: 'Quantity',
    title: 'Production Output',
    description: 'Reconcile inputs to outputs',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD08',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Production Losses',
    primarySource: 'Production records',
    validationTest: 'Reconcile documented losses/adjustments',
    evidenceDetail: 'Quantity',
    title: 'Production Losses',
    description: 'Reconcile documented losses/adjustments',
    statusOptions: [
      'Within Expected / Permitted Range',
      'Abnormal / Excessive Losses Identified',
      'Loss Records Incomplete / Unsupported',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD09',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Finished Stock',
    primarySource: 'Stock records',
    validationTest: 'Opening + production − sales = closing',
    evidenceDetail: 'Variance',
    title: 'Finished Stock',
    description: 'Opening + production − sales = closing',
    statusOptions: [
      'Reconciled – No Material Variance',
      'Reconciled – Variance Identified',
      'Not Reconciled',
      'Incomplete / Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD10',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Sales',
    primarySource: 'Sales ledger',
    validationTest: 'Reconcile sales to production/stock',
    evidenceDetail: 'Quantity',
    title: 'Sales',
    description: 'Reconcile sales to production/stock',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD11',
    subGroup: 'Supporting / Analytical Components',
    dataItem: 'Dispatch',
    primarySource: 'Dispatch records',
    validationTest: 'Reconcile dispatch to invoices/sales',
    evidenceDetail: 'Quantity',
    title: 'Dispatch',
    description: 'Reconcile dispatch to invoices/sales',
    statusOptions: [
      'Complete & Reconciled',
      'Discrepancies Identified',
      'Incomplete / Missing Records',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Process Control & Temperature Records
  {
    ref: 'MD12',
    subGroup: 'Process Control & Temperature Records',
    dataItem: 'Pasteurizer / Temperature & Flow Chart Records',
    primarySource: 'Pasteurizer Temperature & Flow Records',
    validationTest: 'Audit continuous pasteurization chart logs, thermal limit records, and diversion valve testing data',
    evidenceDetail: 'Temperature, flow rate',
    title: 'Pasteurizer / Temperature & Flow Chart Records',
    description: 'Audit continuous pasteurization chart logs, thermal limit records, and diversion valve testing data',
    statusOptions: [
      'Complete & Within Required Parameters',
      'Complete – Exceptions Identified',
      'Incomplete / Missing Records',
      'Out-of-Range Conditions Identified',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Producer / Aggregator Payments & Contracts
  {
    ref: 'MD13',
    subGroup: 'Producer / Aggregator Payments & Contracts',
    dataItem: 'Producer / Aggregator Payment & Contract Audit',
    primarySource: 'Contracts',
    validationTest: 'Sample contracts and payout files for compliance with minimum payout prices, transparent timelines, and transparent deductions.',
    evidenceDetail: 'producer/aggregator contracts, payment terms, quantities purchased, agreed prices, actual supplier payments, reconciliation between contractual terms and actual payments',
    title: 'Producer / Aggregator Payment & Contract Audit',
    description: 'Sample contracts and payout files for compliance with minimum payout prices, transparent timelines, and transparent deductions.',
    statusOptions: [
      'Complete & Compliant',
      'Discrepancies / Non-Compliance Identified',
      'Incomplete / Missing Documentation',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Traceability & Dispatch
  {
    ref: 'MD14',
    subGroup: 'Traceability & Dispatch',
    dataItem: 'Traceability Lot Coding & Dispatch Manifests',
    primarySource: 'Lot/Batch Register & Dispatch Manifests',
    validationTest: 'Verify dispatch manifests containing lot numbers, vehicle registration, driver ID, destination, and seal numbers',
    evidenceDetail: 'Lot number, product, production date, quantity, dispatch date, customer/consignee, invoice/delivery note, vehicle/seal details',
    title: 'Traceability Lot Coding & Dispatch Manifests',
    description: 'Verify dispatch manifests containing lot numbers, vehicle registration, driver ID, destination, and seal numbers',
    statusOptions: [
      'Complete & Fully Traceable',
      'Traceability Exceptions Identified',
      'Incomplete / Missing Records',
      'Lot Coding Errors Identified',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Product & Buyer Classification
  {
    ref: 'MD15',
    subGroup: 'Product & Buyer Classification',
    dataItem: 'Product Scope',
    primarySource: 'Permit/production/sales',
    validationTest: 'Compare permitted products to actual activity',
    evidenceDetail: 'Products',
    title: 'Product Scope',
    description: 'Compare permitted products to actual activity',
    statusOptions: [
      'Correct & Complete',
      'Incorrect / Misclassified',
      'Incomplete / Unclear',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD16',
    subGroup: 'Product & Buyer Classification',
    dataItem: 'Buyer Class',
    primarySource: 'Permit/sales',
    validationTest: 'Reconcile wholesale/retail status',
    evidenceDetail: 'Buyer',
    title: 'Buyer Class',
    description: 'Reconcile wholesale/retail status',
    statusOptions: [
      'Correctly Classified',
      'Classification Errors Identified',
      'Incomplete / Unclear',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD17',
    subGroup: 'Product & Buyer Classification',
    dataItem: 'Levy Remittance',
    primarySource: 'Finance/bank/Returns',
    validationTest: 'Reconcile payment (Was the calculated levy actually remitted correctly and on time?)',
    evidenceDetail: 'Payment',
    title: 'Levy Remittance',
    description: 'Reconcile payment (Was the calculated levy actually remitted correctly and on time?)',
    statusOptions: [
      'Complete & Reconciled',
      'Remittance Discrepancy Identified',
      'Incomplete / Missing Records',
      'Not Remitted / Under-Remitted',
      'Unable to Verify',
      'Not Applicable (N/A)'
    ]
  },

  // Classification & Data Integrity
  {
    ref: 'MD18',
    subGroup: 'Classification & Data Integrity',
    dataItem: 'Classification Continuity',
    primarySource: 'Permit history/throughput',
    validationTest: 'Compare category across renewals (Did the entity/product/category remain consistently classified over time, or did it change?)',
    evidenceDetail: 'History',
    title: 'Classification Continuity',
    description: 'Compare category across renewals (Did the entity/product/category remain consistently classified over time, or did it change?)',
    statusOptions: [
      'Consistent Throughout Review Period',
      'Classification Change Identified – Supported',
      'Classification Change Identified – Unsupported',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  },
  {
    ref: 'MD19',
    subGroup: 'Classification & Data Integrity',
    dataItem: 'Duplicate / Related Records',
    primarySource: 'Master register',
    validationTest: 'Search operator/location/name/contacts',
    evidenceDetail: 'Duplicates',
    title: 'Duplicate / Related Records',
    description: 'Search operator/location/name/contacts',
    statusOptions: [
      'No Duplicate / Related Records Identified',
      'Duplicate Records Identified – Review Required',
      'Potential Related Records Identified',
      'Unable to Determine',
      'Not Applicable (N/A)'
    ]
  }
];

export const FIELD_CHECKLIST_SECTIONS: FieldChecklistSection[] = [
  {
    id: 'sec-common-institutional',
    sectionNumber: 1,
    title: 'Validation & reconciliation areas',
    shortName: 'Common Areas',
    focus: 'Institutional reconciliation tests across Permit & Regulatory Compliance, Transaction & Data Integrity, Record Quality & Controls, and Data Extraction & Historical Issues.',
    categoryKeywords: ['all', 'common', 'institutional', 'general', 'universal'],
    items: COMMON_INSTITUTIONAL_CHECKLIST_ITEMS
  },
  {
    id: 'sec-cooling-plant',
    sectionNumber: 2,
    title: 'COOLING PLANT',
    shortName: 'Cooling Plant',
    focus: 'Regulatory classification & fee-band capacity, producer register & contracts, intake vs bulk dispatch mass balance, receiving-side confirmation, quality-based payments (fat/SNF), timely farmer payouts, and measurement calibration controls.',
    categoryKeywords: ['cooling plant', 'cooling', 'plant', 'collection center', 'cooperative', 'chilling', 'cp'],
    items: COOLING_PLANT_CHECKLIST_ITEMS
  },
  {
    id: 'sec-processor',
    sectionNumber: 3,
    title: 'PROCESSOR',
    shortName: 'Processor',
    focus: 'Enterprise raw milk intake & route reconciliation, multi-line production yield & shrinkage (>1% unaccounted losses), processing capacity, fee-band thresholds, sales & dispatch matching, imported dairy reporting, and mass contract farming payout audit.',
    thresholdDistinction: {
      title: 'Important Threshold Distinction',
      description: 'For data validation, keep these two tests separate:',
      points: [
        'Processor classification: processing more than 10,000 kg/day',
        'Processor fee-band test: applicable fee schedule threshold should be tested separately.'
      ]
    },
    categoryKeywords: ['processor', 'processing', 'dairy processor', 'factory', 'plant', 'pr'],
    items: PROCESSOR_CHECKLIST_ITEMS
  },
  {
    id: 'sec-milk-bar',
    sectionNumber: 4,
    title: 'MILK BAR',
    shortName: 'Milk Bar',
    focus: 'Daily intake & purchase registers, daily dispensing cash book, sales analytics & exception tests, and delivery notes supplier traceability.',
    categoryKeywords: ['milk bar', 'milkbar', 'bar', 'outlet', 'kiosk', 'retail', 'mb'],
    items: MILK_BAR_CHECKLIST_ITEMS
  },
  {
    id: 'sec-dispenser',
    sectionNumber: 5,
    title: 'MILK DISPENSERS',
    shortName: 'Dispenser',
    focus: 'Machine automated telemetry logs vs cash collections, pasteurization sourcing certificates, and spillage reconciliation.',
    categoryKeywords: ['dispenser', 'produce dispenser', 'atm', 'dp', 'ds', 'vending'],
    items: DISPENSER_CHECKLIST_ITEMS
  },
  {
    id: 'sec-cottage-industry',
    sectionNumber: 6,
    title: 'COTTAGE INDUSTRY',
    shortName: 'Cottage Industry',
    focus: 'Raw milk intake vs conversion logs, throughput & threshold testing, supplier purchases & payouts, product & buyer classification, anomaly testing, batch & ingredient traceability, finished goods ledger, and product recall controls.',
    thresholdDistinction: {
      title: 'Classification Test',
      description: 'A cottage industry is associated with handling not more than 500 kg/day.',
      points: [
        'Threshold: handling not more than 500 kg/day',
        'Identify each date above threshold and review sustained throughput trends'
      ]
    },
    categoryKeywords: ['cottage', 'cottage industry', 'ci'],
    items: COTTAGE_INDUSTRY_CHECKLIST_ITEMS
  },
  {
    id: 'sec-mini-dairy',
    sectionNumber: 7,
    title: 'MINI DAIRY',
    shortName: 'Mini Dairy',
    focus: 'Mass balance (intake vs packaged/value-add/cream/losses), processing capacity, pasteurizer continuous thermal/flow logs, producer/aggregator payout audit, lot traceability & dispatch manifests, levy remittance, and classification continuity.',
    thresholdDistinction: {
      title: 'Classification Test',
      description: 'A mini dairy is associated with handling more than 500 kg/day but not more than 10,000 kg/day.',
      points: [
        'Lower threshold: handling more than 500 kg/day',
        'Upper threshold: handling not more than 10,000 kg/day'
      ]
    },
    categoryKeywords: ['mini dairy', 'minidairy', 'mini-dairy', 'md'],
    items: MINI_DAIRY_CHECKLIST_ITEMS
  }
];

export const findSuggestedSectionId = (clientCategory?: string): string => {
  if (!clientCategory) return 'sec-common-institutional';
  const cat = clientCategory.toLowerCase().trim();
  if (cat.includes('processor') || cat.includes('process') || cat.includes('pr')) {
    return 'sec-processor';
  }
  if (cat.includes('bar') || cat.includes('milk bar') || cat.includes('mb') || cat.includes('kiosk') || cat.includes('outlet') || cat.includes('retail')) {
    return 'sec-milk-bar';
  }
  if (cat.includes('dispenser') || cat.includes('atm') || cat.includes('produce dispenser') || cat.includes('dp') || cat.includes('ds') || cat.includes('vending')) {
    return 'sec-dispenser';
  }
  if (cat.includes('cottage') || cat.includes('ci')) {
    return 'sec-cottage-industry';
  }
  if (cat.includes('mini dairy') || cat.includes('minidairy') || cat.includes('mini-dairy') || cat.includes('md') || (cat.includes('mini') && cat.includes('dairy'))) {
    return 'sec-mini-dairy';
  }
  if (cat.includes('cooling') || cat.includes('chilling') || cat.includes('plant') || cat.includes('cp')) {
    return 'sec-cooling-plant';
  }
  return 'sec-common-institutional';
};

/**
 * Checks if any status was selected or any notes were entered across any checklist items
 */
export const hasAnyChecklistValue = (
  checklist?: Record<string, { status?: FieldChecklistResultStatus | string; notes?: string }> | null
): boolean => {
  if (!checklist || typeof checklist !== 'object') return false;
  return Object.values(checklist).some(
    entry => Boolean(entry?.status && entry.status.trim() !== '') || Boolean(entry?.notes && entry.notes.trim() !== '')
  );
};

/**
 * Returns the active checklist sections in exact sequential flow:
 * 1. Section 1: Common Institutional — Part I (CA01–CA05)
 * 2. Section 2: Selected Premise Category Checklist (e.g. Cooling Plant, Processor, Milk Bar, etc.)
 * 3. Section 3: Common Institutional — Part II (CA06–CA13)
 */
export const getActiveChecklistSections = (clientCategory?: string): FieldChecklistSection[] => {
  const commonSec = FIELD_CHECKLIST_SECTIONS.find(s => s.id === 'sec-common-institutional') || FIELD_CHECKLIST_SECTIONS[0];
  const targetSecId = findSuggestedSectionId(clientCategory);
  const targetSec = targetSecId !== 'sec-common-institutional'
    ? FIELD_CHECKLIST_SECTIONS.find(s => s.id === targetSecId)
    : null;

  const categoryLabel = clientCategory && clientCategory.trim() !== ''
    ? clientCategory.trim()
    : (targetSec?.shortName || 'All Categories');

  // Split Section 1 into Part I (CA01–CA05) and Part II (CA06–CA13)
  const part1Items = commonSec.items.filter(item => ['CA01', 'CA02', 'CA03', 'CA04', 'CA05'].includes(item.ref));
  const part2Items = commonSec.items.filter(item => !['CA01', 'CA02', 'CA03', 'CA04', 'CA05'].includes(item.ref));

  const sections: FieldChecklistSection[] = [
    {
      ...commonSec,
      id: 'sec-common-institutional-p1',
      sectionNumber: 1,
      title: `Validation & reconciliation areas (${categoryLabel})`,
      shortName: 'Section 1',
      focus: '',
      items: part1Items
    }
  ];

  if (targetSec) {
    sections.push({
      ...targetSec,
      id: targetSec.id,
      sectionNumber: 2,
      title: 'Section 2',
      shortName: 'Section 2',
      focus: '',
      items: targetSec.items
    });
  }

  sections.push({
    ...commonSec,
    id: 'sec-common-institutional-p2',
    sectionNumber: targetSec ? 3 : 2,
    title: targetSec ? 'Section 3' : 'Section 2',
    shortName: targetSec ? 'Section 3' : 'Section 2',
    focus: '',
    items: part2Items
  });

  return sections;
};

/**
 * Returns all checklist items in the active flow (Section 1 Part I + Category Specific Items + Section 1 Part II)
 */
export const getActiveChecklistItems = (clientCategory?: string): FieldChecklistItem[] => {
  const sections = getActiveChecklistSections(clientCategory);
  return sections.flatMap(s => s.items);
};
