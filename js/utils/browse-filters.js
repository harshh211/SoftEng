// Browse filters as pure functions (no Firebase, no DOM) so they can be unit tested in Node.
//
// Firestore needs an index for every combination of filters, so:
//   Firestore runs   status == "active"  +  at most ONE other filter (pickServerFilter)
//   the browser runs every other chosen filter and the price range    (matchesFilters)

export const PAGE_SIZE = 20;
export const TYPES = ['product', 'service', 'event'];
export const BUSINESS_TYPES = ['business', 'organization'];

export const EMPTY_FILTERS = Object.freeze({
  q: '', category: '', type: '', by: '', min: null, max: null,
});

/**
 * Splits search text into words the same way makeKeywords() builds `keywords`
 * (data-model.md): lowercase letters and digits, 2+ characters, no repeats.
 * "Box  BRAIDS!" -> ["box", "braids"]
 */
export function searchWords(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return [...new Set(words)].filter((w) => w.length > 1);
}

function toPrice(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Reads filters from a URL query string: "?q=braids&category=beauty&max=50". */
export function readFilters(search) {
  const p = new URLSearchParams(search || '');
  const type = p.get('type') || '';
  const by = p.get('by') || '';
  return {
    q: (p.get('q') || '').trim().slice(0, 100),
    category: (p.get('category') || '').trim(),
    type: TYPES.includes(type) ? type : '',
    by: BUSINESS_TYPES.includes(by) ? by : '',
    min: toPrice(p.get('min')),
    max: toPrice(p.get('max')),
  };
}

/** The opposite of readFilters(): "?q=braids&max=50", or "" when nothing is chosen. */
export function filtersToSearch(filters) {
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.category) p.set('category', filters.category);
  if (filters.type) p.set('type', filters.type);
  if (filters.by) p.set('by', filters.by);
  if (filters.min !== null && filters.min !== undefined) p.set('min', String(filters.min));
  if (filters.max !== null && filters.max !== undefined) p.set('max', String(filters.max));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function hasActiveFilters(filters) {
  return filtersToSearch(filters) !== '';
}

/** A price range where min is more than max can't match anything, so the page asks to fix it. */
export function priceRangeError(filters) {
  if (filters.min !== null && filters.max !== null && filters.min > filters.max) {
    return 'Min price is higher than max price.';
  }
  return null;
}

/**
 * The one filter Firestore runs alongside status == "active", in priority order.
 * Returns { field, op, value } for where(), or null for the plain newest-first feed.
 */
export function pickServerFilter(filters) {
  const words = searchWords(filters.q);
  if (words.length) return { field: 'keywords', op: 'array-contains', value: words[0] };
  if (filters.category) return { field: 'category_id', op: '==', value: filters.category };
  if (filters.type) return { field: 'type', op: '==', value: filters.type };
  if (filters.by) return { field: 'business_type', op: '==', value: filters.by };
  return null;
}

/**
 * True when a listing passes every chosen filter. Runs in the browser on each page of results.
 * Also re-checks status, so a hidden or removed listing never shows in browse.
 */
export function matchesFilters(listing, filters) {
  if (!listing || listing.status !== 'active') return false;

  const words = searchWords(filters.q);
  if (words.length) {
    const keywords = Array.isArray(listing.keywords) ? listing.keywords : [];
    if (!words.every((w) => keywords.includes(w))) return false;
  }
  if (filters.category && listing.category_id !== filters.category) return false;
  if (filters.type && listing.type !== filters.type) return false;
  if (filters.by && listing.business_type !== filters.by) return false;

  const price = typeof listing.price === 'number' ? listing.price : Number.NaN;
  if (filters.min !== null && !(price >= filters.min)) return false;
  if (filters.max !== null && !(price <= filters.max)) return false;
  return true;
}
