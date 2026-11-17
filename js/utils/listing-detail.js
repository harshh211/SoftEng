// What the listing detail page shows, as plain data (no Firebase, no DOM) so it can be tested in Node.
import { categoryName, formatEventRange, formatPrice, typeLabel } from '../listing-card.js';

/**
 * @param {object} listing  { id, ...firestoreData }
 * @param {string|null} viewerUid  the signed-in user's uid
 * @param {string} [timeZone]  only passed by tests
 */
export function detailView(listing, viewerUid, timeZone) {
  const isOwner = Boolean(viewerUid) && listing.owner_id === viewerUid;
  const isEvent = listing.type === 'event';

  const facts = [];
  if (isEvent) {
    const when = formatEventRange(listing.event_start, listing.event_end, timeZone);
    if (when) facts.push(['When', when]);
  } else if (listing.availability) {
    facts.push(['Availability', listing.availability]);
  }
  if (listing.location) facts.push(['Where', listing.location]);

  let ownerNote = '';
  if (isOwner && listing.status === 'hidden') ownerNote = 'Only you can see this. It’s hidden.';
  if (isOwner && listing.status === 'removed') {
    ownerNote = 'An admin removed this listing. Only you can see it.';
  }

  return {
    title: listing.title || 'Untitled listing',
    type: typeLabel(listing.type),
    category: categoryName(listing.category_id),
    price: formatPrice(listing.price),
    description: listing.description || '',
    facts,
    ownerNote,
    // Admins can't edit a removed listing either, so the Edit link only shows when it would work.
    editHref: isOwner && listing.status !== 'removed'
      ? `listing-edit.html?id=${encodeURIComponent(listing.id)}`
      : '',
    businessHref: listing.business_id
      ? `business.html?id=${encodeURIComponent(listing.business_id)}`
      : '',
  };
}

