// Browse page: newest active listings, keyword search and filters (FR-4.1, FR-4.2, FR-4.3, FR-4.4).
// How the queries are split between Firestore and the browser: js/utils/browse-filters.js.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { currentUser, friendlyError } from './require-user.js';
import { loadCategories, renderListingCard, renderSkeletonCard } from './listing-card.js';
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  filtersToSearch,
  matchesFilters,
  pickServerFilter,
  priceRangeError,
  readFilters,
} from './utils/browse-filters.js';

// If a page of 20 has no matches after browser filtering, fetch the next page automatically,
// up to this many pages per search or "Load more" click.
const MAX_PAGES_PER_FETCH = 5;

const els = {
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  filters: document.getElementById('filters'),
  filtersToggle: document.getElementById('filters-toggle'),
  filtersCount: document.getElementById('filters-count'),
  category: document.getElementById('category-select'),
  min: document.getElementById('min-input'),
  max: document.getElementById('max-input'),
  priceError: document.getElementById('price-error'),
  clear: document.getElementById('clear-filters'),
  message: document.getElementById('message'),
  count: document.getElementById('results-count'),
  results: document.getElementById('results'),
  empty: document.getElementById('empty-state'),
  emptyClear: document.getElementById('empty-clear'),
  loadMore: document.getElementById('load-more'),
};

const state = {
  filters: { ...EMPTY_FILTERS },
  lastDoc: null,      // last Firestore document seen, for startAfter()
  hasMore: false,     // the last page Firestore returned was a full PAGE_SIZE
  shown: 0,           // cards on the page
  run: 0,             // increases on every new search, so late results from an old one are ignored
};

const businessNames = new Map(); // business_id -> name, or null if it can't be read

// ---------- Filters <-> form <-> URL ----------

function fillForm(filters) {
  els.searchInput.value = filters.q;
  els.category.value = filters.category;
  els.filters.querySelector(`input[name="type"][value="${filters.type}"]`).checked = true;
  els.filters.querySelector(`input[name="by"][value="${filters.by}"]`).checked = true;
  els.min.value = filters.min ?? '';
  els.max.value = filters.max ?? '';
}

function readForm() {
  const form = new FormData(els.filters);
  const params = new URLSearchParams();
  params.set('q', els.searchInput.value);
  for (const name of ['category', 'type', 'by', 'min', 'max']) params.set(name, form.get(name) || '');
  return readFilters(params.toString());
}

function showFilterCount(filters) {
  const n = ['category', 'type', 'by'].filter((k) => filters[k]).length
    + (filters.min !== null || filters.max !== null ? 1 : 0);
  els.filtersCount.textContent = n ? `(${n})` : '';
}

function applyFilters(filters) {
  state.filters = filters;
  history.replaceState(null, '', `${location.pathname}${filtersToSearch(filters)}`);
  showFilterCount(filters);

  const priceError = priceRangeError(filters);
  els.priceError.textContent = priceError || '';
  els.min.setAttribute('aria-invalid', priceError ? 'true' : 'false');
  els.max.setAttribute('aria-invalid', priceError ? 'true' : 'false');
  if (priceError) {
    state.run += 1;
    els.results.replaceChildren();
    els.count.textContent = '';
    els.loadMore.hidden = true;
    els.empty.hidden = true;
    return;
  }
  search();
}

// ---------- Firestore ----------

function buildQuery(after) {
  const parts = [where('status', '==', 'active')];
  const extra = pickServerFilter(state.filters);
  if (extra) parts.push(where(extra.field, extra.op, extra.value));
  parts.push(orderBy('created_at', 'desc'), limit(PAGE_SIZE));
  if (after) parts.push(startAfter(after));
  return query(collection(db, 'listings'), ...parts);
}

async function loadBusinessNames(listings) {
  const missing = [...new Set(listings.map((l) => l.business_id))]
    .filter((id) => id && !businessNames.has(id));
  await Promise.all(missing.map(async (id) => {
    try {
      const snap = await getDoc(doc(db, 'businesses', id));
      businessNames.set(id, snap.exists() ? snap.data().name : null);
    } catch {
      businessNames.set(id, null); // e.g. a suspended business: show the card without a name
    }
  }));
}

/** Fetches pages until it finds matches, runs out of listings, or hits MAX_PAGES_PER_FETCH. */
async function fetchMatches() {
  const found = [];
  for (let page = 0; page < MAX_PAGES_PER_FETCH; page += 1) {
    const snap = await getDocs(buildQuery(state.lastDoc));
    if (snap.docs.length) state.lastDoc = snap.docs[snap.docs.length - 1];
    state.hasMore = snap.docs.length === PAGE_SIZE;

    for (const d of snap.docs) {
      const listing = { id: d.id, ...d.data() };
      if (matchesFilters(listing, state.filters)) found.push(listing);
    }
    if (found.length || !state.hasMore) break;
  }
  return found;
}

// ---------- Rendering ----------

function showSkeletons() {
  els.results.replaceChildren(...Array.from({ length: 6 }, renderSkeletonCard));
  els.results.setAttribute('aria-busy', 'true');
}

function showCount() {
  if (!state.shown) {
    els.count.textContent = '';
    return;
  }
  const noun = state.shown === 1 ? 'listing' : 'listings';
  els.count.textContent = `${state.shown}${state.hasMore ? '+' : ''} ${noun}`;
}

async function search({ more = false } = {}) {
  const run = ++state.run;
  els.message.textContent = '';
  els.empty.hidden = true;
  els.loadMore.hidden = true;

  if (!more) {
    state.lastDoc = null;
    state.hasMore = false;
    state.shown = 0;
    showSkeletons();
  } else {
    els.loadMore.disabled = true;
  }

  try {
    const listings = await fetchMatches();
    await loadBusinessNames(listings);
    if (run !== state.run) return; // a newer search started while this one was loading

    const cards = listings.map((listing) => renderListingCard(listing, {
      businessName: businessNames.get(listing.business_id) || '',
    }));
    if (more) els.results.append(...cards);
    else els.results.replaceChildren(...cards);
    state.shown += cards.length;

    if (more && cards[0]) cards[0].querySelector('a').focus(); // keyboard users land on the new cards
    els.empty.hidden = state.shown > 0;
    els.loadMore.hidden = !state.hasMore;
    showCount();
  } catch (err) {
    if (run !== state.run) return;
    console.error('Browse query failed', err);
    if (!more) els.results.replaceChildren();
    els.message.textContent = friendlyError(err);
    els.loadMore.hidden = !state.hasMore;
  } finally {
    if (run === state.run) {
      els.results.removeAttribute('aria-busy');
      els.loadMore.disabled = false;
    }
  }
}

// ---------- Events ----------

function clearFilters() {
  fillForm(EMPTY_FILTERS);
  applyFilters({ ...EMPTY_FILTERS });
  els.searchInput.focus();
}

els.searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters(readForm());
});

// Clearing the search box with its "x" button runs the search again.
els.searchInput.addEventListener('search', () => {
  if (!els.searchInput.value) applyFilters(readForm());
});

els.filters.addEventListener('change', () => applyFilters(readForm()));
els.filters.addEventListener('submit', (event) => event.preventDefault()); // Enter in a price box
els.clear.addEventListener('click', clearFilters);
els.emptyClear.addEventListener('click', clearFilters);
els.loadMore.addEventListener('click', () => search({ more: true }));

els.filtersToggle.addEventListener('click', () => {
  const open = els.filters.classList.toggle('is-open');
  els.filtersToggle.setAttribute('aria-expanded', String(open));
});

// ---------- Start ----------

async function start() {
  state.filters = readFilters(location.search);
  fillForm(state.filters);
  showFilterCount(state.filters);
  showSkeletons();

  const user = await currentUser();
  if (!user) {
    els.results.replaceChildren();
    els.results.removeAttribute('aria-busy');
    els.message.textContent = 'Log in with your GSU email to browse listings.';
    return;
  }

  try {
    const categories = await loadCategories();
    for (const c of categories) els.category.append(new Option(c.name, c.id));
    els.category.value = state.filters.category; // now that the option exists
  } catch (err) {
    console.warn('Could not load categories', err); // browsing still works without the dropdown
  }

  applyFilters(state.filters);
}

start();
