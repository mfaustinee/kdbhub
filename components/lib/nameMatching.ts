/**
 * Name Matching and String Normalization Utilities
 * Provides flexible, case-insensitive, and whitespace-resilient matching
 * for client names, premises, and search queries across imports and UI views.
 */

/**
 * Name Matching and String Normalization Utilities
 * Provides flexible, case-insensitive, and whitespace-resilient matching
 * for client names, premises, and search queries across imports and UI views.
 */

// Common business entity suffixes to normalize across comparisons
const NOISE_WORDS = new Set([
  'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation',
  'co', 'company', 'coop', 'cooperative', 'co-op', 'fcs', 'society',
  'enterprise', 'enterprises', 'plc', 'holdings', 'group', 'dairy',
  'dairies', 'branch', 'main', 'depot', 'center', 'centre', 'station'
]);

/**
 * Normalizes a string by collapsing multiple spaces, tabs, and non-breaking spaces into a single space and trimming.
 */
export const collapseWhitespace = (str: any): string => {
  if (!str) return '';
  return String(str)
    .replace(/[\s\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ')
    .trim();
};

/**
 * Normalizes a string to purely lowercase alphanumeric characters (removes spaces, punctuation, symbols).
 */
export const normalizeAlphanumeric = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Strips noise words and suffixes, returning a normalized core stem string.
 */
export const extractCoreTokens = (str: any): string[] => {
  if (!str) return [];
  const col = collapseWhitespace(str).toLowerCase();
  return col
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0 && !NOISE_WORDS.has(t));
};

/**
 * Normalizes a permit number by removing prefixes like KDB/LC and non-alphanumeric characters.
 */
export const cleanPermitNumber = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/kdb|lc/g, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Checks if two names/strings match flexibly:
 * - Case-insensitive
 * - Tolerates huge, small, or varied spacing (multiple spaces, tabs, etc.)
 * - Tolerates punctuation and non-alphanumerics (e.g., Co-operative vs Cooperative, Ltd. vs Ltd)
 * - Tolerates minor token order variations if all significant words match
 * - Tolerates presence/absence of business suffixes (e.g. Ltd, Co-op, Dairy, etc.)
 */
export const areNamesMatching = (nameA: any, nameB: any): boolean => {
  if (!nameA || !nameB) return false;
  const aRaw = String(nameA).trim().toLowerCase();
  const bRaw = String(nameB).trim().toLowerCase();
  if (aRaw === bRaw) return true;

  // 1. Collapsed whitespace comparison (any spacing gap)
  const aCol = aRaw.replace(/[\s\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ');
  const bCol = bRaw.replace(/[\s\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ');
  if (aCol === bCol) return true;

  // 2. Pure alphanumeric comparison (strips all spaces, hyphens, periods, symbols)
  const aAlpha = aRaw.replace(/[^a-z0-9]/g, '');
  const bAlpha = bRaw.replace(/[^a-z0-9]/g, '');
  if (aAlpha && bAlpha && aAlpha === bAlpha) return true;

  // 3. Token set match (handles word order variations and spacing)
  const aTokens = aCol.split(' ').filter(t => t.length > 0);
  const bTokens = bCol.split(' ').filter(t => t.length > 0);
  if (aTokens.length > 0 && bTokens.length > 0) {
    const aSorted = [...aTokens].sort().join(' ');
    const bSorted = [...bTokens].sort().join(' ');
    if (aSorted === bSorted) return true;
  }

  // 4. Core stem match ignoring suffixes (e.g. "Brookside Dairy Ltd" vs "Brookside Dairy")
  const aCore = extractCoreTokens(aRaw);
  const bCore = extractCoreTokens(bRaw);
  if (aCore.length > 0 && bCore.length > 0) {
    const aCoreSorted = [...aCore].sort().join(' ');
    const bCoreSorted = [...bCore].sort().join(' ');
    if (aCoreSorted === bCoreSorted) return true;

    // Sub-token containment: if all tokens of shorter name are in longer name
    if (aCore.length >= 2 && bCore.length >= 2) {
      const aSet = new Set(aCore);
      const bSet = new Set(bCore);
      const allAInB = aCore.every(t => bSet.has(t));
      const allBInA = bCore.every(t => aSet.has(t));
      if (allAInB || allBInA) return true;
    }
  }

  // 5. Alphanumeric substring containment if length is substantial (> 6 chars)
  if (aAlpha.length >= 6 && bAlpha.length >= 6) {
    if (aAlpha.includes(bAlpha) || bAlpha.includes(aAlpha)) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a search query matches target text flexibly:
 * - Case-insensitive
 * - Tolerates huge/small spacing in query and target
 * - Matches collapsed whitespace or alphanumeric substring
 */
export const searchMatches = (target: any, query: any): boolean => {
  if (!query) return true;
  if (!target) return false;

  const tStr = String(target).toLowerCase();
  const qStr = String(query).toLowerCase().trim();
  if (!qStr) return true;

  if (tStr.includes(qStr)) return true;

  const tCol = tStr.replace(/[\s\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ');
  const qCol = qStr.replace(/[\s\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, ' ');
  if (tCol.includes(qCol)) return true;

  const tAlpha = tStr.replace(/[^a-z0-9]/g, '');
  const qAlpha = qStr.replace(/[^a-z0-9]/g, '');
  if (qAlpha && tAlpha.includes(qAlpha)) return true;

  return false;
};
