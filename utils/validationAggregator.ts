import { DataValidation } from '../types';

export interface TimelineBreakdown {
  monthly: Record<string, number>;   // Format: "YYYY-MM" -> count
  quarterly: Record<string, number>; // Format: "YYYY-Q1" -> count
  halfYear: Record<string, number>;  // Format: "YYYY-H1" -> count
  annual: Record<string, number>;    // Format: "YYYY" -> count
}

/**
 * Utility to parse arbitrary date strings into timeline breakdown periods
 */
export function parseDateString(dateStr: string) {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  if (!clean) return null;

  // Handle DD/MM/YYYY
  let date: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    date = new Date(clean);
  }

  if (isNaN(date.getTime())) return null; // Catch invalid formatting configurations

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JS months are zero-indexed

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const quarter = `${year}-Q${Math.ceil(month / 3)}`;
  const half = `${year}-H${month <= 6 ? '1' : '2'}`;
  const yearStr = `${year}`;

  return { year, monthStr, quarter, half, yearStr };
}

/**
 * Helper to dynamically scan header row array maps
 */
export function getColumnIndexes(headers: string[], targetNames: string[]): Record<string, number> {
  const indexes: Record<string, number> = {};
  if (!headers || !Array.isArray(headers)) return indexes;
  headers.forEach((h, idx) => {
    if (typeof h === 'string') {
      const cleanHeader = h.toLowerCase().trim();
      if (targetNames.includes(cleanHeader)) {
        indexes[cleanHeader] = idx;
      }
    }
  });
  return indexes;
}

/**
 * Tab 1 & 2 Strategy: Aggregates unique validations based on unique Month + Date lines
 */
export function extractTab1And2Dates(rows: any[][] | undefined | null, targetFields: string[]): string[] {
  if (!rows || rows.length <= 1) return [];
  
  const headers = rows[0];
  const idx = getColumnIndexes(headers, targetFields);
  const seenCombinations = new Set<string>();
  const validDates: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const monthVal = row[idx['month']] ? String(row[idx['month']]).trim() : '';
    const dateVal = row[idx['validation date']] ? String(row[idx['validation date']]).trim() : '';

    if (monthVal && dateVal) {
      const comboKey = `${monthVal}_${dateVal}`;
      if (!seenCombinations.has(comboKey)) {
        seenCombinations.add(comboKey);
        validDates.push(dateVal); // Log the validation event date reference
      }
    }
  }
  return validDates;
}

/**
 * Tab 3 Strategy: Resolves Local Sales vs Total Intake rules per client session group
 */
export function extractCoolingPlantDates(rows: any[][] | undefined | null): string[] {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0];
  const idx = getColumnIndexes(headers, ['name', 'month', 'type', 'validation date']);
  
  // Group row types by: ClientName_Month_ValidationDate -> { types: [], dateValue: "" }
  const clientGroups: Record<string, { types: string[], date: string }> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = row[idx['name']] ? String(row[idx['name']]).trim().toUpperCase() : '';
    const month = row[idx['month']] ? String(row[idx['month']]).trim() : '';
    const date = row[idx['validation date']] ? String(row[idx['validation date']]).trim() : '';
    const type = row[idx['type']] ? String(row[idx['type']]).trim().toUpperCase() : '';

    if (name && month && date && type) {
      const groupKey = `${name}_${month}_${date}`;
      if (!clientGroups[groupKey]) {
        clientGroups[groupKey] = { types: [], date: date };
      }
      clientGroups[groupKey].types.push(type);
    }
  }

  const validDates: string[] = [];

  // Evaluate strict validation mapping logic rules per client chunk
  for (const key in clientGroups) {
    const group = clientGroups[key];
    const hasLocalSales = group.types.includes("LOCAL SALES");
    const hasTotalIntake = group.types.includes("TOTAL INTAKE");

    if (hasLocalSales) {
      // Prioritize Local Sales if it stands alone or matches alongside Total Intake
      validDates.push(group.date);
    } else if (hasTotalIntake) {
      // Fallback to Total Intake only if no Local Sales exists for the period
      validDates.push(group.date);
    }
  }

  return validDates;
}

/**
 * High-level helper to process Google Sheets data or raw database validations into timeline counts
 */
export function processValidationsToTimeline(
  tab1Values?: any[][],
  tab2Values?: any[][],
  tab3Values?: any[][],
  dataValidations?: DataValidation[]
): TimelineBreakdown {
  const timeline: TimelineBreakdown = {
    monthly: {},
    quarterly: {},
    halfYear: {},
    annual: {}
  };

  const recordValidation = (dateStr: string) => {
    const parsed = parseDateString(dateStr);
    if (!parsed) return;

    const { monthStr, quarter, half, yearStr } = parsed;

    timeline.monthly[monthStr] = (timeline.monthly[monthStr] || 0) + 1;
    timeline.quarterly[quarter] = (timeline.quarterly[quarter] || 0) + 1;
    timeline.halfYear[half] = (timeline.halfYear[half] || 0) + 1;
    timeline.annual[yearStr] = (timeline.annual[yearStr] || 0) + 1;
  };

  if (tab1Values && tab1Values.length > 1) {
    extractTab1And2Dates(tab1Values, ['month', 'validation date']).forEach(recordValidation);
  }
  if (tab2Values && tab2Values.length > 1) {
    extractTab1And2Dates(tab2Values, ['month', 'validation date']).forEach(recordValidation);
  }
  if (tab3Values && tab3Values.length > 1) {
    extractCoolingPlantDates(tab3Values).forEach(recordValidation);
  }

  // Also process DB DataValidation records if provided
  if (dataValidations && dataValidations.length > 0) {
    const MONTH_MAP: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    };

    dataValidations.forEach(v => {
      if (v.status !== 'Approved') return;
      
      const vDate = v.validatedAt || (v as any).date || (v as any).created_at;
      if (vDate) {
        recordValidation(vDate);
      } else if (v.year && v.period) {
        const monthNum = MONTH_MAP[v.period.toLowerCase()] || 1;
        const monthStr = `${v.year}-${String(monthNum).padStart(2, '0')}`;
        const quarter = `${v.year}-Q${Math.ceil(monthNum / 3)}`;
        const half = `${v.year}-H${monthNum <= 6 ? '1' : '2'}`;
        const yearStr = `${v.year}`;

        timeline.monthly[monthStr] = (timeline.monthly[monthStr] || 0) + 1;
        timeline.quarterly[quarter] = (timeline.quarterly[quarter] || 0) + 1;
        timeline.halfYear[half] = (timeline.halfYear[half] || 0) + 1;
        timeline.annual[yearStr] = (timeline.annual[yearStr] || 0) + 1;
      }
    });
  }

  return timeline;
}
