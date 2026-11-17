// Listing detail page: listing.html?id=LISTING_ID (FR-3.2, FR-3.3, FR-7.2, NFR-4.2).
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { currentUser, friendlyError } from './require-user.js';
import { loadCategories, swatchFor } from './listing-card.js';
import { detailView } from './utils/listing-detail.js';

const UNAVAILABLE = 'This listing isn’t available. It may have been hidden or removed.';

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('detail-loading'),
  message: $('message'),
  detail: $('detail'),
  back: $('back-link'),
  media: $('detail-media'),
  ownerNote: $('owner-note'),
  meta: $('detail-meta'),
  title: $('detail-title'),
  business: $('detail-business'),
  businessLink: $('detail-business-link'),
  price: $('detail-price'),
  edit: $('edit-link'),
  facts: $('detail-facts'),
  about: $('about-section'),
  description: $('detail-description'),
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fail(text) {
  els.loading.hidden = true;
  els.detail.hidden = true;
  els.message.textContent = text;
}

// Coming from browse, "Back" returns to the same search and filters.
function setBackLink() {
  try {
    const from = new URL(document.referrer);
    if (from.origin === location.origin && from.pathname.endsWith('/browse.html')) {
      els.back.href = `browse.html${from.search}`;
    }
  } catch {
    // no referrer: keep the plain browse.html link
  }
}

function showMedia(listing, view) {
  const photo = Array.isArray(listing.photos) ? listing.photos[0] : '';
  if (typeof photo === 'string' && photo) {
    const img = el('img');
    img.src = photo;
    img.alt = '';
    els.media.append(img);
  } else {
    els.media.classList.add('detail__media--placeholder', `swatch-${swatchFor(listing.category_id)}`);
    els.media.append(el('span', 'listing-card__placeholder-text', view.category || view.type));
  }
}

function showListing(listing, view) {
  document.title = `${view.title} · Bento`;
  showMedia(listing, view);

  if (view.ownerNote) {
    els.ownerNote.textContent = view.ownerNote;
    els.ownerNote.hidden = false;
  }

  if (view.type) els.meta.append(el('span', `type-badge type-badge--${listing.type}`, view.type));
  if (view.category) els.meta.append(el('span', 'listing-card__category', view.category));

  els.title.textContent = view.title;
  els.price.textContent = view.price;

  if (view.editHref) {
    els.edit.href = view.editHref;
    els.edit.hidden = false;
  }

  for (const [label, value] of view.facts) {
    els.facts.append(el('dt', '', label), el('dd', '', value));
  }
  els.facts.hidden = view.facts.length === 0;

  if (view.description) {
    els.description.textContent = view.description; // CSS white-space: pre-line keeps line breaks
    els.about.hidden = false;
  }

  els.loading.hidden = true;
  els.detail.hidden = false;
}

async function showBusiness(listing, view) {
  if (!view.businessHref) return;
  try {
    const snap = await getDoc(doc(db, 'businesses', listing.business_id));
    if (!snap.exists()) return;
    els.businessLink.textContent = snap.data().name || 'View profile';
    els.businessLink.href = view.businessHref;
    els.business.hidden = false;
  } catch {
    // Suspended or otherwise unreadable business: show the listing without the name or link.
  }
}

async function start() {
  setBackLink();
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return fail(UNAVAILABLE);

  const user = await currentUser();
  if (!user) return fail('Log in with your GSU email to see this listing.');

  let listing;
  try {
    const snap = await getDoc(doc(db, 'listings', id));
    if (!snap.exists()) return fail(UNAVAILABLE);
    listing = { id: snap.id, ...snap.data() };
  } catch (err) {
    // The rules deny reading a hidden or removed listing that isn't yours.
    if (err?.code === 'permission-denied') return fail(UNAVAILABLE);
    console.error('Could not load listing', err);
    return fail(friendlyError(err));
  }

  await loadCategories().catch(() => {}); // the category id is shown tidied up if this fails
  const view = detailView(listing, user.uid);
  showListing(listing, view);
  showBusiness(listing, view);
}

start();
