// The listing card used everywhere a listing appears: browse, a business's profile page,
// "My listings", and later favorites. Spec: docs/ui/listing-card.md (round 2 task brief).
//
//   import { renderListingCard, loadCategories } from "./js/listing-card.js";
//   await loadCategories();                        // once per page, so category names show
//   const card = renderListingCard(listing, { businessName: "Braids by Alice" });
//   document.querySelector("#results").append(card);
//
// renderListingCard() never reads Firestore. Everything the card shows comes from `listing`
// (shaped { id, ...firestoreData }) and the options. User-written text is always set with
// textContent, never innerHTML, so a title like "<b>hi</b>" shows up as text.

const TYPE_LABELS = { product: 'Product', service: 'Service', event: 'Event' };
const STATUS_LABELS = { hidden: 'Hidden', removed: 'Removed' };

// ---------- Categories ----------

const categories = new Map(); // id -> name
let categoriesLoading = null;

/** Lets a page (or a test) supply the category list directly: [{ id, name }]. */
export function setCategories(list) {
  categories.clear();
  for (const c of list || []) categories.set(c.id, c.name);
}

/**
 * Loads the `categories` collection once per page and returns [{ id, name }] sorted by name.
 * Firebase is imported here, not at the top of the file, so tests can import this module in Node.
 */
export function loadCategories() {
  if (!categoriesLoading) {
    categoriesLoading = (async () => {
      const [{ collection, getDocs }, { db }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js'),
        import('./firebase-config.js'),
      ]);
      const snap = await getDocs(collection(db, 'categories'));
      const list = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name || d.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCategories(list);
      return list;
    })().catch((err) => {
      categoriesLoading = null; // let the next call try again
      throw err;
    });
  }
  return categoriesLoading;
}

/** "beauty" -> "Beauty". Falls back to a tidied-up id if the list hasn't loaded. */
export function categoryName(id) {
  if (!id) return '';
  if (categories.has(id)) return categories.get(id);
  const words = String(id).replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---------- Formatting ----------

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/** 0 -> "Free", 120 -> "$120", 12.5 -> "$12.50". Anything that isn't a number -> "". */
export function formatPrice(price) {
  const n = typeof price === 'number' ? price : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return 'Free';
  return Number.isInteger(n) ? wholeDollars.format(n) : dollars.format(n);
}

/** Accepts a Firestore Timestamp, a Date, a { seconds } object or a date string. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayText(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone,
  }).format(date);
}

function timeText(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone,
  }).format(date);
}

/** "Fri, Nov 20 · 6:00 PM". `timeZone` is only passed by tests; pages use the viewer's own. */
export function formatEventDate(value, timeZone) {
  const date = toDate(value);
  if (!date) return '';
  return `${dayText(date, timeZone)} · ${timeText(date, timeZone)}`;
}

/**
 * "Fri, Nov 20 · 6:00 PM – 8:00 PM" on one day,
 * "Fri, Nov 20 · 10:00 PM – Sat, Nov 21 · 1:00 AM" across two. No end time -> just the start.
 */
export function formatEventRange(start, end, timeZone) {
  const from = toDate(start);
  if (!from) return '';
  const to = toDate(end);
  const first = formatEventDate(from, timeZone);
  if (!to || to <= from) return first;
  const sameDay = dayText(from, timeZone) === dayText(to, timeZone)
    && Math.abs(to - from) < 24 * 60 * 60 * 1000;
  return `${first} – ${sameDay ? timeText(to, timeZone) : formatEventDate(to, timeZone)}`;
}

export function typeLabel(type) {
  return TYPE_LABELS[type] || '';
}

/** The words a card shows, as plain strings. Used by renderListingCard() and the tests. */
export function cardText(listing, options = {}) {
  const isEvent = listing.type === 'event';
  const status = STATUS_LABELS[listing.status];
  return {
    type: typeLabel(listing.type),
    category: categoryName(listing.category_id),
    title: listing.title || 'Untitled listing',
    business: options.businessName || '',
    price: formatPrice(listing.price),
    detail: isEvent ? formatEventDate(listing.event_start) : (listing.availability || ''),
    status: options.showStatus && status ? status : '',
    photo: Array.isArray(listing.photos) && typeof listing.photos[0] === 'string' ? listing.photos[0] : '',
  };
}

// ---------- The card ----------

// Small helper: makes an element with a class and (optional) text, never using innerHTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Placeholder colors: each seeded category has its own, and any new category gets one picked
// from its id, so it always shows the same color.
const SWATCHES = ['nori', 'tamago', 'ginger', 'sky', 'plum'];
const CATEGORY_SWATCHES = {
  beauty: 'ginger', food: 'tamago', photography: 'plum', art: 'sky',
  tutoring: 'nori', 'tech-repair': 'sky', fashion: 'ginger', 'clubs-social': 'tamago',
};
export function swatchFor(categoryId) {
  if (CATEGORY_SWATCHES[categoryId]) return CATEGORY_SWATCHES[categoryId];
  let hash = 0;
  for (const ch of String(categoryId || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SWATCHES[hash % SWATCHES.length];
}

/**
 * Builds one listing card.
 * @param {object} listing  { id, ...firestoreData }
 * @param {{ businessName?: string, showStatus?: boolean, href?: string }} [options]
 * @returns {HTMLElement} an <article>
 */
export function renderListingCard(listing, options = {}) {
  const text = cardText(listing, options);
  const href = options.href || `listing.html?id=${encodeURIComponent(listing.id || '')}`;

  const card = el('article', 'listing-card');
  if (text.status) card.classList.add('listing-card--muted');
  card.dataset.listingId = listing.id || '';

  const link = el('a', 'listing-card__link');
  link.href = href;

  // Photo (fixed 4:3 box so the grid doesn't jump) or a colored placeholder.
  const media = el('div', 'listing-card__media');
  if (text.photo) {
    const img = el('img');
    img.src = text.photo;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    media.append(img);
  } else {
    media.classList.add('listing-card__media--placeholder', `swatch-${swatchFor(listing.category_id)}`);
    media.append(el('span', 'listing-card__placeholder-text', text.category || text.type));
  }
  if (text.status) media.append(el('span', `status-badge status-badge--${listing.status}`, text.status));
  link.append(media);

  const body = el('div', 'listing-card__body');

  const meta = el('p', 'listing-card__meta');
  if (text.type) meta.append(el('span', `type-badge type-badge--${listing.type}`, text.type));
  if (text.category) meta.append(el('span', 'listing-card__category', text.category));
  body.append(meta);

  body.append(el('h3', 'listing-card__title', text.title));
  if (text.business) body.append(el('p', 'listing-card__business', text.business));

  const foot = el('p', 'listing-card__foot');
  foot.append(el('span', 'listing-card__price', text.price));
  if (text.detail) foot.append(el('span', 'listing-card__detail', text.detail));
  body.append(foot);

  link.append(body);
  card.append(link);
  return card;
}

/** A gray placeholder card shown while results load. */
export function renderSkeletonCard() {
  const card = el('div', 'listing-card listing-card--skeleton');
  card.setAttribute('aria-hidden', 'true');
  card.append(el('div', 'listing-card__media'));
  const body = el('div', 'listing-card__body');
  for (const width of ['40%', '85%', '60%']) {
    const bar = el('span', 'skeleton-bar');
    bar.style.width = width;
    body.append(bar);
  }
  card.append(body);
  return card;
}
