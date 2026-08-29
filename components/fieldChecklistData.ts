import { FieldChecklistResultStatus } from '../types';

export interface FieldChecklistItem {
  ref: string;
  title: string;
  description: string;
}

export interface FieldChecklistSection {
  id: string;
  sectionNumber: number;
  title: string;
  shortName: string;
  focus: string;
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

export const FIELD_CHECKLIST_SECTIONS: FieldChecklistSection[] = [
  {
    id: 'sec-milk-bars',
    sectionNumber: 1,
    title: 'SECTION 1: MILK BARS',
    shortName: 'Milk Bars',
    focus: 'Small-scale retail compliance, daily intake/sales reconciliation, local supplier records, and basic pricing logs.',
    categoryKeywords: ['milk bar', 'bar', 'retail', 'shop'],
    items: [
      {
        ref: '1.1',
        title: '1.1 Daily Milk Intake & Purchase Register',
        description: 'Verify daily volume received (liters), supplier identities, delivery time, and intake temperatures against purchase receipts.'
      },
      {
        ref: '1.2',
        title: '1.2 Daily Dispensing / Sales Cash Book',
        description: 'Reconcile daily volume sold against total cash/M-Pesa revenue logged. Verify no unrecorded spillages or shrinkage.'
      },
      {
        ref: '1.3',
        title: '1.3 Minimum Payout & Supplier Price Compliance',
        description: 'Verify purchase contract / price logs ensure statutory farm-gate minimum price compliance (KDB Pricing Regs 2021).'
      },
      {
        ref: '1.4',
        title: '1.4 Traceability Delivery Notes & Supplier PINs',
        description: 'Confirm existence of delivery notes capturing supplier name, KRA PIN, national ID, sub-county origin, and batch IDs.'
      },
      {
        ref: '1.5',
        title: '1.5 KDB Permit & Local County License Filings',
        description: 'Reconcile current KDB regulatory permit status.'
      }
    ]
  },
  {
    id: 'sec-milk-dispensers',
    sectionNumber: 2,
    title: 'SECTION 2: MILK DISPENSERS',
    shortName: 'Dispensers (ATM)',
    focus: 'Machine automated telemetry logs vs cash collections, pasteurization sourcing certificates, and spillage reconciliation.',
    categoryKeywords: ['dispenser', 'atm', 'milk dispenser', 'vending'],
    items: [
      {
        ref: '2.1',
        title: '2.1 Automated Dispenser Meter / Telemetry Logs',
        description: 'Reconcile total liters dispensed per digital meter reading against physical cash and mobile money collections.'
      },
      {
        ref: '2.2',
        title: '2.2 Commercial Sourcing & Pasteurization Certificates',
        description: 'Validate batch-wise certificates of pasteurization from authorized processors for every batch loaded into dispenser.'
      },
      {
        ref: '2.3',
        title: '2.3 Maintenance, Cleaning & Calibration Logs',
        description: 'Verify calibration certificates for automated volume meters and temperature sensors (KDB Regs Schedule B).'
      },
      {
        ref: '2.4',
        title: '2.4 Spillage, Cleaning Loss & Waste Variance Log',
        description: 'Reconcile daily milk tank loading volume vs (Sales + Spillage/Rinse Losses). Discrepancy threshold > 1.5% flagged.'
      },
      {
        ref: '2.5',
        title: '2.5 Traceability Batch & Expiry Tagging',
        description: 'Confirm clear labeling on dispenser tanks indicating batch number, pasteurization date, and mandatory expiry timeframe.'
      }
    ]
  },
  {
    id: 'sec-cooling-plants',
    sectionNumber: 3,
    title: 'SECTION 3: COOLING PLANTS / COLLECTION CENTERS',
    shortName: 'Cooling Plants',
    focus: 'Bulk raw milk aggregation, primary producer registers, quality-based payment testing logs, and Cess / Levy calculation.',
    categoryKeywords: ['cooling plant', 'cp>', 'cp<', 'collection center', 'cooperative', 'chilling', 'cp'],
    items: [
      {
        ref: '3.1',
        title: '3.1 Primary Producer Register & Member Contracts',
        description: 'Validate comprehensive register of dairy farmers/groups (Name, ID, KRA PIN, Location, Bank/M-Pesa details, Contract).'
      },
      {
        ref: '3.2',
        title: '3.2 Daily Milk Intake vs Dispatch Reconciliation',
        description: 'Reconcile total raw milk intake from farmers against total bulk milk dispatched to processors/transporters.'
      },
      {
        ref: '3.3',
        title: '3.3 Quality-Based Payment (Fat & SNF) Records',
        description: 'Verify milk testing logs (fat %, SNF, density, platform tests) and corresponding quality-based price adjustments.'
      },
      {
        ref: '3.4',
        title: '3.4 Statutory Deductions & Farmer Payout Statements',
        description: 'Reconcile monthly farmer payout schedules, itemized deductions (transport, feed, advances), and farm-gate net payouts.'
      },
      {
        ref: '3.5',
        title: '3.5 Calibration Certificates for Testing & Weighing',
        description: 'Check valid calibration tags/certificates for weigh bowls, dipsticks, thermometers, and lactometers.'
      }
    ]
  },
  {
    id: 'sec-cottage-industries',
    sectionNumber: 4,
    title: 'SECTION 4: COTTAGE INDUSTRIES',
    shortName: 'Cottage Industries',
    focus: 'Batch yield reconciliation, raw milk transformation ratios, ingredient tracking, and monthly KDB returns.',
    categoryKeywords: ['cottage industry', 'cottage'],
    items: [
      {
        ref: '4.1',
        title: '4.1 Raw Milk Intake vs Production Conversion Log',
        description: 'Reconcile liters of raw milk input against total units produced (e.g., 10L raw milk = 1kg cheese / 10L yoghurt).'
      },
      {
        ref: '4.2',
        title: '4.2 Batch Production Logs & Ingredient Traceability',
        description: 'Verify batch manufacturing records, cultures/additives used, batch numbers, pasteurization logs, and expiry dates.'
      },
      {
        ref: '4.3',
        title: '4.3 Finished Goods Inventory & Sales Ledger',
        description: 'Reconcile starting inventory + production - sales = closing inventory across all product lines (Yoghurt, Butter, Ghee).'
      },
      {
        ref: '4.4',
        title: '4.4 Product Recall & Quality Non-Conformance Log',
        description: 'Check documented product recall procedure, customer complaint register, and records of rejected/recalled batches.'
      }
    ]
  },
  {
    id: 'sec-mini-dairies',
    sectionNumber: 5,
    title: 'SECTION 5: MINI DAIRIES',
    shortName: 'Mini Dairies',
    focus: 'Automated processing losses, multi-product line yields, raw vs pasteurized milk balances, and detailed KDB monthly filings.',
    categoryKeywords: ['mini dairy', 'mini-dairy', 'mini'],
    items: [
      {
        ref: '5.1',
        title: '5.1 Raw Milk Intake vs Processing Mass Balance',
        description: 'Perform mass balance reconciliation: Intake (Liters) vs Packaged Milk + Value-Add Products + Separated Cream + Process Loss.'
      },
      {
        ref: '5.2',
        title: '5.2 Pasteurizer / Temperature & Flow Chart Records',
        description: 'Audit continuous pasteurization chart logs, thermal limit records, and diversion valve testing data.'
      },
      {
        ref: '5.3',
        title: '5.3 Producer / Aggregator Payment & Contract Audit',
        description: 'Sample contracts and payout files for compliance with minimum payout prices, statutory timelines, and transparent deductions.'
      },
      {
        ref: '5.4',
        title: '5.4 Traceability Lot Coding & Dispatch Manifests',
        description: 'Verify dispatch manifests containing lot numbers, vehicle registration, driver ID, destination, and seal numbers.'
      }
    ]
  },
  {
    id: 'sec-processors',
    sectionNumber: 6,
    title: 'SECTION 6: FULL-SCALE PROCESSORS',
    shortName: 'Processors',
    focus: 'High-volume multi-plant data verification, nationwide distribution manifests, import/export permits, and KDB levy reconciliation.',
    categoryKeywords: ['processor', 'full-scale', 'dairy processor'],
    items: [
      {
        ref: '6.1',
        title: '6.1 Enterprise Raw Milk Intake & Route Reconciliation',
        description: 'Reconcile tanker weighbridge tickets, route collection manifests, and factory reception tank receipts daily.'
      },
      {
        ref: '6.2',
        title: '6.2 Multi-Line Production Yield & Shrinkage Analysis',
        description: 'Validate yield variance reports across ESL, UHT, Powder, Butter, and Fermented lines. Investigating unaccounted losses > 1%.'
      },
      {
        ref: '6.3',
        title: '6.3 KDB Regulatory Cess & Statutory Levy Audit',
        description: 'Reconcile total monthly processing volume against KDB Cess returns, banking slips, and audit clearance certificates.'
      },
      {
        ref: '6.4',
        title: '6.4 Contract Farming & Mass Payout Reconciliation',
        description: 'Audit electronic payout files for thousands of suppliers, verifying farm-gate price compliance and unauthorized fee deductions.'
      }
    ]
  }
];

export const findSuggestedSectionId = (clientCategory?: string): string => {
  if (!clientCategory) return 'sec-milk-bars';
  const cat = clientCategory.toLowerCase().trim();
  for (const section of FIELD_CHECKLIST_SECTIONS) {
    if (section.categoryKeywords.some(keyword => cat.includes(keyword))) {
      return section.id;
    }
  }
  return 'sec-milk-bars';
};
