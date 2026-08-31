import { FieldChecklistResultStatus } from '../types';

export interface FieldChecklistItem {
  ref: string;
  dataItem: string;
  primarySource: string;
  validationTest: string;
  evidenceDetail: string;
  title: string;
  description: string;
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

export const FIELD_CHECKLIST_STATUS_OPTIONS: {
  value: FieldChecklistResultStatus;
  label: string;
  shortLabel: string;
  color: 'emerald' | 'amber' | 'rose' | 'slate';
  activeClass: string;
  badgeClass: string;
}[] = [
  {
    value: 'Available & Reconciled',
    label: 'Available & Reconciled',
    shortLabel: 'Reconciled',
    color: 'emerald',
    activeClass: 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-200 shadow-xs',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    value: 'Available (Discrepancies)',
    label: 'Available (Discrepancies)',
    shortLabel: 'Discrepancies',
    color: 'amber',
    activeClass: 'bg-amber-50 text-amber-800 border-amber-500 ring-2 ring-amber-200 shadow-xs',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    value: 'Not Available / Missing',
    label: 'Not Available / Missing',
    shortLabel: 'Missing',
    color: 'rose',
    activeClass: 'bg-rose-50 text-rose-800 border-rose-500 ring-2 ring-rose-200 shadow-xs',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  {
    value: 'Not Applicable (N/A)',
    label: 'Not Applicable (N/A)',
    shortLabel: 'N/A',
    color: 'slate',
    activeClass: 'bg-slate-100 text-slate-700 border-slate-400 ring-2 ring-slate-200 shadow-xs',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300'
  }
];

export const COOLING_PLANT_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'CP01',
    dataItem: 'Permit category',
    primarySource: 'Application/permit/register',
    validationTest: 'Confirm entity is classified as cooling plant',
    evidenceDetail: 'Category evidence',
    title: 'Permit category',
    description: 'Confirm entity is classified as cooling plant'
  },
  {
    ref: 'CP02',
    dataItem: 'Cooling plant identity',
    primarySource: 'Permit/master register',
    validationTest: 'Reconcile plant name and identifier',
    evidenceDetail: 'Plant ID',
    title: 'Cooling plant identity',
    description: 'Reconcile plant name and identifier'
  },
  {
    ref: 'CP03',
    dataItem: 'Physical location',
    primarySource: 'Permit/application/field data',
    validationTest: 'Reconcile location across records',
    evidenceDetail: 'Location',
    title: 'Physical location',
    description: 'Reconcile location across records'
  },
  {
    ref: 'CP04',
    dataItem: 'Cooling capacity',
    primarySource: 'Application/permit/asset records',
    validationTest: 'Compare recorded cooling capacity and units',
    evidenceDetail: 'Capacity',
    title: 'Cooling capacity',
    description: 'Compare recorded cooling capacity and units'
  },
  {
    ref: 'CP05',
    dataItem: 'Fee-band capacity',
    primarySource: 'Permit/fee assessment',
    validationTest: 'Where applicable, confirm whether capacity falls below/above relevant fee threshold',
    evidenceDetail: 'Capacity/fee band',
    title: 'Fee-band capacity',
    description: 'Where applicable, confirm whether capacity falls below/above relevant fee threshold'
  },
  {
    ref: 'CP06',
    dataItem: 'Daily milk handled',
    primarySource: 'Intake/bulking records',
    validationTest: 'Reconcile daily milk handled to permitted quantity',
    evidenceDetail: 'Daily quantity',
    title: 'Daily milk handled',
    description: 'Reconcile daily milk handled to permitted quantity'
  },
  {
    ref: 'CP07',
    dataItem: 'Monthly milk intake',
    primarySource: 'Intake register',
    validationTest: 'Sum daily quantities and compare with monthly summary',
    evidenceDetail: 'Monthly variance',
    title: 'Monthly milk intake',
    description: 'Sum daily quantities and compare with monthly summary'
  },
  {
    ref: 'CP08',
    dataItem: 'Supplier/producer records',
    primarySource: 'Supplier/intake register',
    validationTest: 'Reconcile supplier quantities to total plant intake',
    evidenceDetail: 'Supplier total',
    title: 'Supplier/producer records',
    description: 'Reconcile supplier quantities to total plant intake'
  },
  {
    ref: 'CP09',
    dataItem: 'Opening milk balance',
    primarySource: 'Stock/intake records',
    validationTest: 'Confirm opening balance agrees to prior closing balance',
    evidenceDetail: 'Opening balance',
    title: 'Opening milk balance',
    description: 'Confirm opening balance agrees to prior closing balance'
  },
  {
    ref: 'CP10',
    dataItem: 'Milk received',
    primarySource: 'Intake records',
    validationTest: 'Reconcile receipts to supplier records',
    evidenceDetail: 'Quantity',
    title: 'Milk received',
    description: 'Reconcile receipts to supplier records'
  },
  {
    ref: 'CP11',
    dataItem: 'Milk dispatched',
    primarySource: 'Dispatch notes',
    validationTest: 'Match outbound quantities to receiving records where available',
    evidenceDetail: 'Dispatch',
    title: 'Milk dispatched',
    description: 'Match outbound quantities to receiving records where available'
  },
  {
    ref: 'CP12',
    dataItem: 'Closing balance',
    primarySource: 'Stock records',
    validationTest: 'Test opening + receipts − dispatches ± adjustments = closing',
    evidenceDetail: 'Recalculation',
    title: 'Closing balance',
    description: 'Test opening + receipts − dispatches ± adjustments = closing'
  },
  {
    ref: 'CP13',
    dataItem: 'Dispatch-to-invoice reconciliation',
    primarySource: 'Dispatch/invoices',
    validationTest: 'Match quantities and dates',
    evidenceDetail: 'Variance',
    title: 'Dispatch-to-invoice reconciliation',
    description: 'Match quantities and dates'
  },
  {
    ref: 'CP14',
    dataItem: 'Receiving-side confirmation',
    primarySource: 'Receiving records where available',
    validationTest: 'Match sampled outbound transactions to recipient records',
    evidenceDetail: 'Matched items',
    title: 'Receiving-side confirmation',
    description: 'Match sampled outbound transactions to recipient records'
  },
  {
    ref: 'CP15',
    dataItem: 'Permit quantity vs actual',
    primarySource: 'Permit/intake records',
    validationTest: 'Identify days where activity exceeds permitted quantity',
    evidenceDetail: 'Dates/quantities',
    title: 'Permit quantity vs actual',
    description: 'Identify days where activity exceeds permitted quantity'
  },
  {
    ref: 'CP16',
    dataItem: 'Permit period vs activity',
    primarySource: 'Permit/intake records',
    validationTest: 'Identify activity outside valid permit period',
    evidenceDetail: 'Dates',
    title: 'Permit period vs activity',
    description: 'Identify activity outside valid permit period'
  },
  {
    ref: 'CP17',
    dataItem: 'Supplier duplicate records',
    primarySource: 'Supplier register',
    validationTest: 'Search duplicate suppliers and transactions',
    evidenceDetail: 'Duplicates',
    title: 'Supplier duplicate records',
    description: 'Search duplicate suppliers and transactions'
  },
  {
    ref: 'CP18',
    dataItem: 'Zero activity',
    primarySource: 'Intake records',
    validationTest: 'Determine whether zero means no activity or missing data',
    evidenceDetail: 'Evidence',
    title: 'Zero activity',
    description: 'Determine whether zero means no activity or missing data'
  },
  {
    ref: 'CP19',
    dataItem: 'Abnormal volumes',
    primarySource: 'Daily summaries',
    validationTest: 'Identify spikes, repeated identical figures, negative values',
    evidenceDetail: 'Exceptions',
    title: 'Abnormal volumes',
    description: 'Identify spikes, repeated identical figures, negative values'
  },
  {
    ref: 'CP20',
    dataItem: 'Levy-relevant activity',
    primarySource: 'Levy/intake records',
    validationTest: 'Determine whether relevant activity generates levy obligation',
    evidenceDetail: 'Basis',
    title: 'Levy-relevant activity',
    description: 'Determine whether relevant activity generates levy obligation'
  },
  {
    ref: 'CP21',
    dataItem: 'Levy quantity',
    primarySource: 'Levy return/intake records',
    validationTest: 'Reconcile reported quantity to source',
    evidenceDetail: 'Variance',
    title: 'Levy quantity',
    description: 'Reconcile reported quantity to source'
  },
  {
    ref: 'CP22',
    dataItem: 'Levy payment',
    primarySource: 'Levy/finance records',
    validationTest: 'Match assessment to payment',
    evidenceDetail: 'Payment',
    title: 'Levy payment',
    description: 'Match assessment to payment'
  }
];

export const PROCESSOR_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'PR01',
    dataItem: 'Processor classification',
    primarySource: 'Application/permit',
    validationTest: 'Confirm category',
    evidenceDetail: 'Classification evidence',
    title: 'Processor classification',
    description: 'Confirm category'
  },
  {
    ref: 'PR02',
    dataItem: 'Processing quantity/day',
    primarySource: 'Production records',
    validationTest: 'Compare actual daily processing with permit',
    evidenceDetail: 'Daily quantity',
    title: 'Processing quantity/day',
    description: 'Compare actual daily processing with permit'
  },
  {
    ref: 'PR03',
    dataItem: '10,000 kg/day threshold',
    primarySource: 'Production records',
    validationTest: 'Identify days above/below classification threshold',
    evidenceDetail: 'Dates/quantities',
    title: '10,000 kg/day threshold',
    description: 'Identify days above/below classification threshold'
  },
  {
    ref: 'PR04',
    dataItem: 'Fee-band threshold',
    primarySource: 'Fee assessment',
    validationTest: 'Independently test applicable fee band',
    evidenceDetail: 'Fee calculation',
    title: 'Fee-band threshold',
    description: 'Independently test applicable fee band'
  },
  {
    ref: 'PR05',
    dataItem: 'Processing capacity',
    primarySource: 'Permit/asset records',
    validationTest: 'Reconcile recorded capacity',
    evidenceDetail: 'Capacity',
    title: 'Processing capacity',
    description: 'Reconcile recorded capacity'
  },
  {
    ref: 'PR06',
    dataItem: 'Nature of products',
    primarySource: 'Permit/production',
    validationTest: 'Compare permitted products to production',
    evidenceDetail: 'Product list',
    title: 'Nature of products',
    description: 'Compare permitted products to production'
  },
  {
    ref: 'PR07',
    dataItem: 'Raw milk received',
    primarySource: 'Intake records',
    validationTest: 'Reconcile purchases/receipts to supplier records',
    evidenceDetail: 'Quantity',
    title: 'Raw milk received',
    description: 'Reconcile purchases/receipts to supplier records'
  },
  {
    ref: 'PR08',
    dataItem: 'Supplier invoices',
    primarySource: 'Supplier/finance records',
    validationTest: 'Match milk purchases to invoices',
    evidenceDetail: 'Invoice sample',
    title: 'Supplier invoices',
    description: 'Match milk purchases to invoices'
  },
  {
    ref: 'PR09',
    dataItem: 'Supplier payments',
    primarySource: 'Finance/supplier ledger',
    validationTest: 'Reconcile purchases to payment records',
    evidenceDetail: 'Payment status',
    title: 'Supplier payments',
    description: 'Reconcile purchases to payment records'
  },
  {
    ref: 'PR10',
    dataItem: 'Production output',
    primarySource: 'Production records',
    validationTest: 'Reconcile input to output',
    evidenceDetail: 'Yield/variance',
    title: 'Production output',
    description: 'Reconcile input to output'
  },
  {
    ref: 'PR11',
    dataItem: 'Processing losses',
    primarySource: 'Production records',
    validationTest: 'Confirm documented losses/adjustments',
    evidenceDetail: 'Loss records',
    title: 'Processing losses',
    description: 'Confirm documented losses/adjustments'
  },
  {
    ref: 'PR12',
    dataItem: 'Finished product stock',
    primarySource: 'Stock records',
    validationTest: 'Reconcile opening + production − sales = closing',
    evidenceDetail: 'Stock variance',
    title: 'Finished product stock',
    description: 'Reconcile opening + production − sales = closing'
  },
  {
    ref: 'PR13',
    dataItem: 'Sales quantity',
    primarySource: 'Sales ledger',
    validationTest: 'Reconcile sales to production/stock',
    evidenceDetail: 'Sales variance',
    title: 'Sales quantity',
    description: 'Reconcile sales to production/stock'
  },
  {
    ref: 'PR14',
    dataItem: 'Dispatch quantity',
    primarySource: 'Dispatch records',
    validationTest: 'Reconcile dispatch to invoices',
    evidenceDetail: 'Quantity',
    title: 'Dispatch quantity',
    description: 'Reconcile dispatch to invoices'
  },
  {
    ref: 'PR15',
    dataItem: 'Buyer class',
    primarySource: 'Permit/sales records',
    validationTest: 'Compare wholesale/retail classification with actual sales',
    evidenceDetail: 'Buyer comparison',
    title: 'Buyer class',
    description: 'Compare wholesale/retail classification with actual sales'
  },
  {
    ref: 'PR16',
    dataItem: 'Permit area',
    primarySource: 'Permit/distribution records',
    validationTest: 'Compare actual distribution with permitted area where data exists',
    evidenceDetail: 'Area',
    title: 'Permit area',
    description: 'Compare actual distribution with permitted area where data exists'
  },
  {
    ref: 'PR17',
    dataItem: 'Permit period',
    primarySource: 'Permit/production',
    validationTest: 'Identify production during permit gaps',
    evidenceDetail: 'Dates',
    title: 'Permit period',
    description: 'Identify production during permit gaps'
  },
  {
    ref: 'PR18',
    dataItem: 'Levy quantity',
    primarySource: 'Levy return/processing',
    validationTest: 'Recalculate levy quantity',
    evidenceDetail: 'Recalculated quantity',
    title: 'Levy quantity',
    description: 'Recalculate levy quantity'
  },
  {
    ref: 'PR19',
    dataItem: 'Levy value basis',
    primarySource: 'Purchase/cost records',
    validationTest: 'Reconcile applicable value/cost basis',
    evidenceDetail: 'Value',
    title: 'Levy value basis',
    description: 'Reconcile applicable value/cost basis'
  },
  {
    ref: 'PR20',
    dataItem: 'Levy computation',
    primarySource: 'Levy return/finance',
    validationTest: 'Independently recalculate levy',
    evidenceDetail: 'Calculation',
    title: 'Levy computation',
    description: 'Independently recalculate levy'
  },
  {
    ref: 'PR21',
    dataItem: 'Levy remittance',
    primarySource: 'Bank/finance',
    validationTest: 'Reconcile amount and date',
    evidenceDetail: 'Payment',
    title: 'Levy remittance',
    description: 'Reconcile amount and date'
  },
  {
    ref: 'PR22',
    dataItem: 'Imported dairy produce',
    primarySource: 'Import/levy records',
    validationTest: 'Reconcile imported quantities/value where applicable',
    evidenceDetail: 'Import evidence',
    title: 'Imported dairy produce',
    description: 'Reconcile imported quantities/value where applicable'
  },
  {
    ref: 'PR23',
    dataItem: 'Month-end cut-off',
    primarySource: 'Production/levy',
    validationTest: 'Test transactions around month-end',
    evidenceDetail: 'Cut-off',
    title: 'Month-end cut-off',
    description: 'Test transactions around month-end'
  },
  {
    ref: 'PR24',
    dataItem: 'Activity exceeding permit',
    primarySource: 'Production/permit',
    validationTest: 'List exact dates and quantities above permitted level',
    evidenceDetail: 'Exceptions',
    title: 'Activity exceeding permit',
    description: 'List exact dates and quantities above permitted level'
  },
  {
    ref: 'PR25',
    dataItem: 'Duplicate processor records',
    primarySource: 'Master register',
    validationTest: 'Search name/location/operator/permit duplicates',
    evidenceDetail: 'Duplicates',
    title: 'Duplicate processor records',
    description: 'Search name/location/operator/permit duplicates'
  }
];

export const MILK_BAR_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'MB01',
    dataItem: 'Permit category',
    primarySource: 'Permit/register',
    validationTest: 'Confirm milk bar classification',
    evidenceDetail: 'Category',
    title: 'Permit category',
    description: 'Confirm milk bar classification'
  },
  {
    ref: 'MB02',
    dataItem: 'Business identity',
    primarySource: 'Permit/application',
    validationTest: 'Reconcile business/operator details',
    evidenceDetail: 'Identity',
    title: 'Business identity',
    description: 'Reconcile business/operator details'
  },
  {
    ref: 'MB03',
    dataItem: 'Physical location',
    primarySource: 'Permit/county licence',
    validationTest: 'Reconcile premises location',
    evidenceDetail: 'Location',
    title: 'Physical location',
    description: 'Reconcile premises location'
  },
  {
    ref: 'MB04',
    dataItem: 'County licence',
    primarySource: 'County/KDB records',
    validationTest: 'Match county licence to milk bar',
    evidenceDetail: 'Licence',
    title: 'County licence',
    description: 'Match county licence to milk bar'
  },
  {
    ref: 'MB05',
    dataItem: 'Permit period',
    primarySource: 'Permit/register',
    validationTest: 'Confirm valid period',
    evidenceDetail: 'Dates',
    title: 'Permit period',
    description: 'Confirm valid period'
  },
  {
    ref: 'MB06',
    dataItem: 'Dairy products permitted',
    primarySource: 'Permit/application',
    validationTest: 'Compare permitted products to sales records',
    evidenceDetail: 'Products',
    title: 'Dairy products permitted',
    description: 'Compare permitted products to sales records'
  },
  {
    ref: 'MB07',
    dataItem: 'Milk purchases',
    primarySource: 'Supplier receipts',
    validationTest: 'Reconcile purchases to sales/stock',
    evidenceDetail: 'Purchases',
    title: 'Milk purchases',
    description: 'Reconcile purchases to sales/stock'
  },
  {
    ref: 'MB08',
    dataItem: 'Sales quantity',
    primarySource: 'Sales records',
    validationTest: 'Reconcile sales quantity',
    evidenceDetail: 'Sales',
    title: 'Sales quantity',
    description: 'Reconcile sales quantity'
  },
  {
    ref: 'MB09',
    dataItem: 'Opening stock',
    primarySource: 'Stock records',
    validationTest: 'Compare opening stock to previous closing stock',
    evidenceDetail: 'Stock',
    title: 'Opening stock',
    description: 'Compare opening stock to previous closing stock'
  },
  {
    ref: 'MB10',
    dataItem: 'Closing stock',
    primarySource: 'Stock records',
    validationTest: 'Reconcile closing balance',
    evidenceDetail: 'Balance',
    title: 'Closing stock',
    description: 'Reconcile closing balance'
  },
  {
    ref: 'MB11',
    dataItem: 'Purchase-to-sales reconciliation',
    primarySource: 'Purchases/sales',
    validationTest: 'Opening + purchases − sales ± adjustments = closing',
    evidenceDetail: 'Variance',
    title: 'Purchase-to-sales reconciliation',
    description: 'Opening + purchases − sales ± adjustments = closing'
  },
  {
    ref: 'MB12',
    dataItem: 'Sales receipts',
    primarySource: 'POS/cashbook',
    validationTest: 'Match sales to receipts/cash',
    evidenceDetail: 'Amount',
    title: 'Sales receipts',
    description: 'Match sales to receipts/cash'
  },
  {
    ref: 'MB13',
    dataItem: 'Wholesale/retail activity',
    primarySource: 'Permit/sales',
    validationTest: 'Compare actual transactions with permitted activity',
    evidenceDetail: 'Buyer class',
    title: 'Wholesale/retail activity',
    description: 'Compare actual transactions with permitted activity'
  },
  {
    ref: 'MB14',
    dataItem: 'Activity outside permit',
    primarySource: 'Permit/sales',
    validationTest: 'Identify sales before issue/after expiry',
    evidenceDetail: 'Dates',
    title: 'Activity outside permit',
    description: 'Identify sales before issue/after expiry'
  },
  {
    ref: 'MB15',
    dataItem: 'Permit quantity/day',
    primarySource: 'Permit/sales',
    validationTest: 'Compare daily activity to permitted quantity',
    evidenceDetail: 'Dates/quantity',
    title: 'Permit quantity/day',
    description: 'Compare daily activity to permitted quantity'
  },
  {
    ref: 'MB16',
    dataItem: 'Levy relevance',
    primarySource: 'Purchase/sales/levy',
    validationTest: 'Establish whether levy-bearing products are handled',
    evidenceDetail: 'Basis',
    title: 'Levy relevance',
    description: 'Establish whether levy-bearing products are handled'
  },
  {
    ref: 'MB17',
    dataItem: 'Levy reconciliation',
    primarySource: 'Levy records',
    validationTest: 'Reconcile relevant levy quantity/value',
    evidenceDetail: 'Levy',
    title: 'Levy reconciliation',
    description: 'Reconcile relevant levy quantity/value'
  },
  {
    ref: 'MB18',
    dataItem: 'Duplicate outlet records',
    primarySource: 'Master register',
    validationTest: 'Search name/location/contact/operator',
    evidenceDetail: 'Duplicate candidates',
    title: 'Duplicate outlet records',
    description: 'Search name/location/contact/operator'
  },
  {
    ref: 'MB19',
    dataItem: 'Missing sales periods',
    primarySource: 'Sales records',
    validationTest: 'Identify exact days/months without records',
    evidenceDetail: 'Periods',
    title: 'Missing sales periods',
    description: 'Identify exact days/months without records'
  },
  {
    ref: 'MB20',
    dataItem: 'Zero sales',
    primarySource: 'Sales records',
    validationTest: 'Distinguish zero activity from missing records',
    evidenceDetail: 'Evidence',
    title: 'Zero sales',
    description: 'Distinguish zero activity from missing records'
  },
  {
    ref: 'MB21',
    dataItem: 'Abnormal sales',
    primarySource: 'Sales summaries',
    validationTest: 'Identify spikes, repeated figures or negative adjustments',
    evidenceDetail: 'Exception',
    title: 'Abnormal sales',
    description: 'Identify spikes, repeated figures or negative adjustments'
  }
];

export const DISPENSER_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'DP01',
    dataItem: 'Permit category',
    primarySource: 'Permit/register',
    validationTest: 'Confirm dispenser classification',
    evidenceDetail: 'Category',
    title: 'Permit category',
    description: 'Confirm dispenser classification'
  },
  {
    ref: 'DP02',
    dataItem: 'Dispenser ID',
    primarySource: 'Asset/permit register',
    validationTest: 'Reconcile machine/asset ID',
    evidenceDetail: 'ID',
    title: 'Dispenser ID',
    description: 'Reconcile machine/asset ID'
  },
  {
    ref: 'DP03',
    dataItem: 'Serial number',
    primarySource: 'Asset record',
    validationTest: 'Compare serial number across records',
    evidenceDetail: 'Serial',
    title: 'Serial number',
    description: 'Compare serial number across records'
  },
  {
    ref: 'DP04',
    dataItem: 'Operator',
    primarySource: 'Permit/asset register',
    validationTest: 'Reconcile operator',
    evidenceDetail: 'Operator',
    title: 'Operator',
    description: 'Reconcile operator'
  },
  {
    ref: 'DP05',
    dataItem: 'Location',
    primarySource: 'Permit/asset register',
    validationTest: 'Confirm dispenser location',
    evidenceDetail: 'Location',
    title: 'Location',
    description: 'Confirm dispenser location'
  },
  {
    ref: 'DP06',
    dataItem: 'Product type',
    primarySource: 'Permit/stock records',
    validationTest: 'Compare permitted product to dispensed product',
    evidenceDetail: 'Product',
    title: 'Product type',
    description: 'Compare permitted product to dispensed product'
  },
  {
    ref: 'DP07',
    dataItem: 'Opening meter reading',
    primarySource: 'Machine log',
    validationTest: 'Capture and validate opening reading',
    evidenceDetail: 'Reading',
    title: 'Opening meter reading',
    description: 'Capture and validate opening reading'
  },
  {
    ref: 'DP08',
    dataItem: 'Closing meter reading',
    primarySource: 'Machine log',
    validationTest: 'Validate closing reading',
    evidenceDetail: 'Reading',
    title: 'Closing meter reading',
    description: 'Validate closing reading'
  },
  {
    ref: 'DP09',
    dataItem: 'Quantity dispensed',
    primarySource: 'Machine/sales record',
    validationTest: 'Recalculate from meter readings',
    evidenceDetail: 'Quantity',
    title: 'Quantity dispensed',
    description: 'Recalculate from meter readings'
  },
  {
    ref: 'DP10',
    dataItem: 'Product supplied',
    primarySource: 'Purchase/stock records',
    validationTest: 'Reconcile product supplied to dispenser',
    evidenceDetail: 'Quantity',
    title: 'Product supplied',
    description: 'Reconcile product supplied to dispenser'
  },
  {
    ref: 'DP11',
    dataItem: 'Stock balance',
    primarySource: 'Stock/dispenser records',
    validationTest: 'Opening stock + supply − dispensed = closing',
    evidenceDetail: 'Variance',
    title: 'Stock balance',
    description: 'Opening stock + supply − dispensed = closing'
  },
  {
    ref: 'DP12',
    dataItem: 'Cash/receipts',
    primarySource: 'POS/cash records',
    validationTest: 'Reconcile dispensed quantity to sales receipts',
    evidenceDetail: 'Amount',
    title: 'Cash/receipts',
    description: 'Reconcile dispensed quantity to sales receipts'
  },
  {
    ref: 'DP13',
    dataItem: 'Manual adjustments',
    primarySource: 'Machine/sales records',
    validationTest: 'Identify and verify manual adjustments',
    evidenceDetail: 'Adjustment',
    title: 'Manual adjustments',
    description: 'Identify and verify manual adjustments'
  },
  {
    ref: 'DP14',
    dataItem: 'Meter resets',
    primarySource: 'Machine logs',
    validationTest: 'Verify resets and explanations',
    evidenceDetail: 'Reset evidence',
    title: 'Meter resets',
    description: 'Verify resets and explanations'
  },
  {
    ref: 'DP15',
    dataItem: 'Permit period vs activity',
    primarySource: 'Permit/machine records',
    validationTest: 'Identify machine activity outside permit',
    evidenceDetail: 'Dates',
    title: 'Permit period vs activity',
    description: 'Identify machine activity outside permit'
  },
  {
    ref: 'DP16',
    dataItem: 'Multiple machines',
    primarySource: 'Asset/master register',
    validationTest: 'Reconcile permitted machines to assets',
    evidenceDetail: 'Machine count',
    title: 'Multiple machines',
    description: 'Reconcile permitted machines to assets'
  },
  {
    ref: 'DP17',
    dataItem: 'Relocated machines',
    primarySource: 'Asset/location records',
    validationTest: 'Identify location changes without corresponding updates',
    evidenceDetail: 'Location history',
    title: 'Relocated machines',
    description: 'Identify location changes without corresponding updates'
  },
  {
    ref: 'DP18',
    dataItem: 'Levy-bearing product',
    primarySource: 'Supplier/levy records',
    validationTest: 'Trace sampled product to source',
    evidenceDetail: 'Supplier',
    title: 'Levy-bearing product',
    description: 'Trace sampled product to source'
  },
  {
    ref: 'DP19',
    dataItem: 'Abnormal readings',
    primarySource: 'Machine records',
    validationTest: 'Identify negative, duplicate or repeated readings',
    evidenceDetail: 'Exception',
    title: 'Abnormal readings',
    description: 'Identify negative, duplicate or repeated readings'
  },
  {
    ref: 'DP20',
    dataItem: 'Zero readings',
    primarySource: 'Machine records',
    validationTest: 'Distinguish no sales from unavailable machine data',
    evidenceDetail: 'Evidence',
    title: 'Zero readings',
    description: 'Distinguish no sales from unavailable machine data'
  }
];

export const COTTAGE_INDUSTRY_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'CI01',
    dataItem: 'Permit category',
    primarySource: 'Permit/application',
    validationTest: 'Confirm cottage industry classification',
    evidenceDetail: 'Category',
    title: 'Permit category',
    description: 'Confirm cottage industry classification'
  },
  {
    ref: 'CI02',
    dataItem: 'Daily handling quantity',
    primarySource: 'Production/intake records',
    validationTest: 'Compare actual quantity to 500 kg threshold',
    evidenceDetail: 'Quantity',
    title: 'Daily handling quantity',
    description: 'Compare actual quantity to 500 kg threshold'
  },
  {
    ref: 'CI03',
    dataItem: 'Days above 500 kg',
    primarySource: 'Daily records',
    validationTest: 'Identify each date above threshold',
    evidenceDetail: 'Dates/quantity',
    title: 'Days above 500 kg',
    description: 'Identify each date above threshold'
  },
  {
    ref: 'CI04',
    dataItem: 'Sustained throughput',
    primarySource: 'Monthly records',
    validationTest: 'Identify repeated threshold exceedances',
    evidenceDetail: 'Trend',
    title: 'Sustained throughput',
    description: 'Identify repeated threshold exceedances'
  },
  {
    ref: 'CI05',
    dataItem: 'Permit quantity/day',
    primarySource: 'Permit/application',
    validationTest: 'Compare permitted quantity to actual activity',
    evidenceDetail: 'Quantity',
    title: 'Permit quantity/day',
    description: 'Compare permitted quantity to actual activity'
  },
  {
    ref: 'CI06',
    dataItem: 'Raw milk purchases',
    primarySource: 'Supplier records',
    validationTest: 'Reconcile purchases to production',
    evidenceDetail: 'Quantity',
    title: 'Raw milk purchases',
    description: 'Reconcile purchases to production'
  },
  {
    ref: 'CI07',
    dataItem: 'Supplier payments',
    primarySource: 'Finance records',
    validationTest: 'Match purchases to payments',
    evidenceDetail: 'Amount',
    title: 'Supplier payments',
    description: 'Match purchases to payments'
  },
  {
    ref: 'CI08',
    dataItem: 'Production output',
    primarySource: 'Production records',
    validationTest: 'Reconcile input to output',
    evidenceDetail: 'Yield',
    title: 'Production output',
    description: 'Reconcile input to output'
  },
  {
    ref: 'CI09',
    dataItem: 'Sales quantity',
    primarySource: 'Sales records',
    validationTest: 'Reconcile production to sales',
    evidenceDetail: 'Quantity',
    title: 'Sales quantity',
    description: 'Reconcile production to sales'
  },
  {
    ref: 'CI10',
    dataItem: 'Stock balance',
    primarySource: 'Stock records',
    validationTest: 'Reconcile opening + production − sales = closing',
    evidenceDetail: 'Variance',
    title: 'Stock balance',
    description: 'Reconcile opening + production − sales = closing'
  },
  {
    ref: 'CI11',
    dataItem: 'Product scope',
    primarySource: 'Permit/production',
    validationTest: 'Compare permitted products to actual products',
    evidenceDetail: 'Products',
    title: 'Product scope',
    description: 'Compare permitted products to actual products'
  },
  {
    ref: 'CI12',
    dataItem: 'Buyer class',
    primarySource: 'Permit/sales',
    validationTest: 'Compare actual buyers/channels',
    evidenceDetail: 'Buyer',
    title: 'Buyer class',
    description: 'Compare actual buyers/channels'
  },
  {
    ref: 'CI13',
    dataItem: 'County licence',
    primarySource: 'County/KDB',
    validationTest: 'Reconcile county licence',
    evidenceDetail: 'Licence',
    title: 'County licence',
    description: 'Reconcile county licence'
  },
  {
    ref: 'CI14',
    dataItem: 'Permit period vs activity',
    primarySource: 'Permit/production',
    validationTest: 'Identify activity outside valid period',
    evidenceDetail: 'Dates',
    title: 'Permit period vs activity',
    description: 'Identify activity outside valid period'
  },
  {
    ref: 'CI15',
    dataItem: 'Levy applicability',
    primarySource: 'Levy/source records',
    validationTest: 'Establish whether levy applies',
    evidenceDetail: 'Basis',
    title: 'Levy applicability',
    description: 'Establish whether levy applies'
  },
  {
    ref: 'CI16',
    dataItem: 'Levy quantity/value',
    primarySource: 'Levy/source records',
    validationTest: 'Reconcile levy basis to source',
    evidenceDetail: 'Levy',
    title: 'Levy quantity/value',
    description: 'Reconcile levy basis to source'
  },
  {
    ref: 'CI17',
    dataItem: 'Missing periods',
    primarySource: 'Records/files',
    validationTest: 'Identify exact missing months/days',
    evidenceDetail: 'Periods',
    title: 'Missing periods',
    description: 'Identify exact missing months/days'
  },
  {
    ref: 'CI18',
    dataItem: 'Related/duplicate records',
    primarySource: 'Master register',
    validationTest: 'Search same operator/location/contact',
    evidenceDetail: 'Duplicates',
    title: 'Related/duplicate records',
    description: 'Search same operator/location/contact'
  },
  {
    ref: 'CI19',
    dataItem: 'Split activity',
    primarySource: 'Master/transaction records',
    validationTest: 'Check whether activity appears divided across multiple records',
    evidenceDetail: 'Related records',
    title: 'Split activity',
    description: 'Check whether activity appears divided across multiple records'
  },
  {
    ref: 'CI20',
    dataItem: 'Classification change',
    primarySource: 'Throughput trend',
    validationTest: 'Determine whether data indicates need for classification review',
    evidenceDetail: 'Trend/evidence',
    title: 'Classification change',
    description: 'Determine whether data indicates need for classification review'
  }
];

export const MINI_DAIRY_CHECKLIST_ITEMS: FieldChecklistItem[] = [
  {
    ref: 'MD01',
    dataItem: 'Permit category',
    primarySource: 'Permit/application',
    validationTest: 'Confirm mini dairy classification',
    evidenceDetail: 'Category',
    title: 'Permit category',
    description: 'Confirm mini dairy classification'
  },
  {
    ref: 'MD02',
    dataItem: 'Daily handling',
    primarySource: 'Intake/production records',
    validationTest: 'Reconcile daily activity',
    evidenceDetail: 'Quantity',
    title: 'Daily handling',
    description: 'Reconcile daily activity'
  },
  {
    ref: 'MD03',
    dataItem: '500 kg threshold',
    primarySource: 'Daily records',
    validationTest: 'Identify activity at/below threshold',
    evidenceDetail: 'Dates',
    title: '500 kg threshold',
    description: 'Identify activity at/below threshold'
  },
  {
    ref: 'MD04',
    dataItem: '10,000 kg threshold',
    primarySource: 'Daily records',
    validationTest: 'Identify activity above threshold',
    evidenceDetail: 'Dates',
    title: '10,000 kg threshold',
    description: 'Identify activity above threshold'
  },
  {
    ref: 'MD05',
    dataItem: 'Classification period',
    primarySource: 'Permit/throughput data',
    validationTest: 'Establish evidence period used for classification',
    evidenceDetail: 'Period',
    title: 'Classification period',
    description: 'Establish evidence period used for classification'
  },
  {
    ref: 'MD06',
    dataItem: 'Processing capacity',
    primarySource: 'Permit/asset records',
    validationTest: 'Reconcile capacity',
    evidenceDetail: 'Capacity',
    title: 'Processing capacity',
    description: 'Reconcile capacity'
  },
  {
    ref: 'MD07',
    dataItem: 'Permitted quantity/day',
    primarySource: 'Permit/application',
    validationTest: 'Compare actual activity to permitted quantity',
    evidenceDetail: 'Quantity',
    title: 'Permitted quantity/day',
    description: 'Compare actual activity to permitted quantity'
  },
  {
    ref: 'MD08',
    dataItem: 'Raw milk purchases',
    primarySource: 'Supplier records',
    validationTest: 'Reconcile purchases to intake',
    evidenceDetail: 'Quantity',
    title: 'Raw milk purchases',
    description: 'Reconcile purchases to intake'
  },
  {
    ref: 'MD09',
    dataItem: 'Supplier payments',
    primarySource: 'Finance records',
    validationTest: 'Match purchases to payments',
    evidenceDetail: 'Amount',
    title: 'Supplier payments',
    description: 'Match purchases to payments'
  },
  {
    ref: 'MD10',
    dataItem: 'Production output',
    primarySource: 'Production records',
    validationTest: 'Reconcile inputs to outputs',
    evidenceDetail: 'Quantity',
    title: 'Production output',
    description: 'Reconcile inputs to outputs'
  },
  {
    ref: 'MD11',
    dataItem: 'Production losses',
    primarySource: 'Production records',
    validationTest: 'Reconcile documented losses/adjustments',
    evidenceDetail: 'Quantity',
    title: 'Production losses',
    description: 'Reconcile documented losses/adjustments'
  },
  {
    ref: 'MD12',
    dataItem: 'Finished stock',
    primarySource: 'Stock records',
    validationTest: 'Opening + production − sales = closing',
    evidenceDetail: 'Variance',
    title: 'Finished stock',
    description: 'Opening + production − sales = closing'
  },
  {
    ref: 'MD13',
    dataItem: 'Sales',
    primarySource: 'Sales ledger',
    validationTest: 'Reconcile sales to production/stock',
    evidenceDetail: 'Quantity',
    title: 'Sales',
    description: 'Reconcile sales to production/stock'
  },
  {
    ref: 'MD14',
    dataItem: 'Dispatch',
    primarySource: 'Dispatch records',
    validationTest: 'Reconcile dispatch to invoices/sales',
    evidenceDetail: 'Quantity',
    title: 'Dispatch',
    description: 'Reconcile dispatch to invoices/sales'
  },
  {
    ref: 'MD15',
    dataItem: 'Product scope',
    primarySource: 'Permit/production/sales',
    validationTest: 'Compare permitted products to actual activity',
    evidenceDetail: 'Products',
    title: 'Product scope',
    description: 'Compare permitted products to actual activity'
  },
  {
    ref: 'MD16',
    dataItem: 'Buyer class',
    primarySource: 'Permit/sales',
    validationTest: 'Reconcile wholesale/retail status',
    evidenceDetail: 'Buyer',
    title: 'Buyer class',
    description: 'Reconcile wholesale/retail status'
  },
  {
    ref: 'MD17',
    dataItem: 'Permitted area',
    primarySource: 'Permit/distribution records',
    validationTest: 'Compare actual activity to area where data exists',
    evidenceDetail: 'Area',
    title: 'Permitted area',
    description: 'Compare actual activity to area where data exists'
  },
  {
    ref: 'MD18',
    dataItem: 'Levy quantity',
    primarySource: 'Levy/source records',
    validationTest: 'Recalculate levy quantity',
    evidenceDetail: 'Quantity',
    title: 'Levy quantity',
    description: 'Recalculate levy quantity'
  },
  {
    ref: 'MD19',
    dataItem: 'Levy value basis',
    primarySource: 'Levy/source records',
    validationTest: 'Reconcile applicable value basis',
    evidenceDetail: 'Value',
    title: 'Levy value basis',
    description: 'Reconcile applicable value basis'
  },
  {
    ref: 'MD20',
    dataItem: 'Levy calculation',
    primarySource: 'Levy return/finance',
    validationTest: 'Independently recalculate',
    evidenceDetail: 'Amount',
    title: 'Levy calculation',
    description: 'Independently recalculate'
  },
  {
    ref: 'MD21',
    dataItem: 'Levy remittance',
    primarySource: 'Finance/bank',
    validationTest: 'Reconcile payment',
    evidenceDetail: 'Payment',
    title: 'Levy remittance',
    description: 'Reconcile payment'
  },
  {
    ref: 'MD22',
    dataItem: 'Month-end cut-off',
    primarySource: 'Production/levy',
    validationTest: 'Test transactions around month-end',
    evidenceDetail: 'Cut-off',
    title: 'Month-end cut-off',
    description: 'Test transactions around month-end'
  },
  {
    ref: 'MD23',
    dataItem: 'Permit-period activity',
    primarySource: 'Permit/production',
    validationTest: 'Identify activity during permit gaps',
    evidenceDetail: 'Dates',
    title: 'Permit-period activity',
    description: 'Identify activity during permit gaps'
  },
  {
    ref: 'MD24',
    dataItem: 'Classification continuity',
    primarySource: 'Permit history/throughput',
    validationTest: 'Compare category across renewals',
    evidenceDetail: 'History',
    title: 'Classification continuity',
    description: 'Compare category across renewals'
  },
  {
    ref: 'MD25',
    dataItem: 'Duplicate/related records',
    primarySource: 'Master register',
    validationTest: 'Search operator/location/name/contacts',
    evidenceDetail: 'Duplicates',
    title: 'Duplicate/related records',
    description: 'Search operator/location/name/contacts'
  }
];

export const FIELD_CHECKLIST_SECTIONS: FieldChecklistSection[] = [
  {
    id: 'sec-cooling-plant',
    sectionNumber: 1,
    title: 'COOLING PLANT',
    shortName: 'Cooling Plant',
    focus: 'Reconciliation tests for cooling plant entity identity, cooling & fee capacity, intake, balances, dispatch matching, permit validity, exceptions, and levy audit.',
    categoryKeywords: ['cooling plant', 'cooling', 'plant', 'collection center', 'cooperative', 'chilling', 'cp'],
    items: COOLING_PLANT_CHECKLIST_ITEMS
  },
  {
    id: 'sec-processor',
    sectionNumber: 2,
    title: 'PROCESSOR',
    shortName: 'Processor',
    focus: 'Reconciliation tests for processing quantity, 10,000 kg/day & fee thresholds, raw milk intake & supplier ledgers, mass balances, sales & dispatch, permit limits, levy computation & payment, and duplicate auditing.',
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
    sectionNumber: 3,
    title: 'MILK BAR',
    shortName: 'Milk Bar',
    focus: 'Reconciliation tests for milk bar classification, licensing, stock & purchase-to-sales mass balance, retail transactions, permit quantity, levy, and missing/abnormal sales.',
    categoryKeywords: ['milk bar', 'milkbar', 'bar', 'outlet', 'kiosk', 'retail', 'mb'],
    items: MILK_BAR_CHECKLIST_ITEMS
  },
  {
    id: 'sec-dispenser',
    sectionNumber: 4,
    title: 'DAIRY PRODUCE DISPENSER',
    shortName: 'Dispenser',
    focus: 'Reconciliation tests for dispenser classification, machine & serial IDs, operator, location, meter logs, dispensed quantity, supply-to-stock balance, cash receipts, resets, multiple/relocated machines, levy source, and meter exceptions.',
    categoryKeywords: ['dispenser', 'produce dispenser', 'atm', 'dp', 'ds', 'vending'],
    items: DISPENSER_CHECKLIST_ITEMS
  },
  {
    id: 'sec-cottage-industry',
    sectionNumber: 5,
    title: 'COTTAGE INDUSTRY',
    shortName: 'Cottage Industry',
    focus: 'Reconciliation tests for cottage industry 500 kg/day threshold, daily handling, purchases, payments, production output yield, sales, stock balance, product scope, levy, missing periods, split activity, and classification review.',
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
    sectionNumber: 6,
    title: 'MINI DAIRY',
    shortName: 'Mini Dairy',
    focus: 'Reconciliation tests for mini dairy 500 kg to 10,000 kg/day throughput thresholds, processing capacity, intake, losses, finished stock balance, dispatch, buyer class, levy recalculation, cut-off, and classification continuity.',
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
  if (!clientCategory) return 'sec-cooling-plant';
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
  return 'sec-cooling-plant';
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
