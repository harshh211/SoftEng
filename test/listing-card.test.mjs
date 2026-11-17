// Listing card and listing detail page: formatting, what shows for each kind of listing,
// and that user-written text is never put on the page as HTML.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cardText,
  formatEventRange,
  formatPrice,
  renderListingCard,
  setCategories,
} from '../js/listing-card.js';
import { detailView } from '../js/utils/listing-detail.js';

const TZ = 'America/New_York';
setCategories([{ id: 'beauty', name: 'Beauty' }, { id: 'photography', name: 'Photography' }]);

// Nov 20 2026, 6pm–8pm in Atlanta.
const start = new Date('2026-11-20T23:00:00Z');
const end = new Date('2026-11-21T01:00:00Z');

test('prices: free, whole dollars and cents', () => {
  assert.equal(formatPrice(0), 'Free');
  assert.equal(formatPrice(120), '$120');
  assert.equal(formatPrice(12.5), '$12.50');
  assert.equal(formatPrice(1500), '$1,500');
  assert.equal(formatPrice('120'), ''); // the data model stores numbers, never strings
});

test('event times show the day and a time range', () => {
  assert.equal(formatEventRange(start, end, TZ), 'Fri, Nov 20 · 6:00 PM – 8:00 PM');
  assert.equal(formatEventRange({ seconds: start.getTime() / 1000 }, null, TZ), 'Fri, Nov 20 · 6:00 PM');
});

test('the card shows the right words for a service, a hidden product and an event', () => {
  const service = cardText(
    { type: 'service', category_id: 'beauty', title: 'Box Braids', price: 120, availability: 'Weekends', status: 'active' },
    { businessName: 'Braids by Alice' },
  );
  assert.deepEqual(
    [service.type, service.category, service.title, service.business, service.price, service.detail, service.status],
    ['Service', 'Beauty', 'Box Braids', 'Braids by Alice', '$120', 'Weekends', ''],
  );

  const hidden = { type: 'product', category_id: 'beauty', title: 'Edge Control Gel', price: 12.5, status: 'hidden' };
  assert.equal(cardText(hidden).status, '');                        // browse never labels it
  assert.equal(cardText(hidden, { showStatus: true }).status, 'Hidden'); // "My listings" does

  const event = cardText({ type: 'event', category_id: 'photography', title: 'Photo Walk', price: 0,
    event_start: start, availability: 'ignored for events', status: 'active' });
  assert.equal(event.price, 'Free');
  assert.match(event.detail, /Nov 20 · \d{1,2}:00 [AP]M/);
});

// A tiny stand-in for the browser's document. Setting innerHTML throws, so the test fails
// if the card ever puts text on the page as HTML.
function fakeDocument() {
  const make = (tag) => {
    const node = {
      tagName: tag.toUpperCase(), children: [], className: '', textContent: '',
      dataset: {}, style: {}, attributes: {},
      classList: { add: (...c) => { node.className = [node.className, ...c].join(' ').trim(); } },
      setAttribute(k, v) { this.attributes[k] = v; },
      append(...kids) { this.children.push(...kids); },
      set innerHTML(_) { throw new Error('innerHTML used'); },
    };
    return node;
  };
  return { createElement: make };
}
const allText = (node) => [node.textContent, ...node.children.map(allText)].join(' ');

test('user-written text goes on the card as text, never HTML', () => {
  globalThis.document = fakeDocument();
  const card = renderListingCard({
    id: 'abc 1', type: 'product', category_id: 'beauty', title: '<b>hi</b>', price: 5, status: 'active',
  }, { businessName: '<script>alert(1)</script>' });

  assert.equal(card.tagName, 'ARTICLE');
  const link = card.children[0];
  assert.equal(link.href, 'listing.html?id=abc%201'); // the whole card is one link
  assert.match(allText(card), /<b>hi<\/b>/);           // the tags show up as text
  assert.match(allText(card), /<script>alert\(1\)<\/script>/);
  delete globalThis.document;
});

test('browse, listing and card scripts never set innerHTML', () => {
  for (const file of ['js/listing-card.js', 'js/browse.js', 'js/listing.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML/, `${file} uses innerHTML`);
  }
});

test('detail page: event times, owner Edit link and hidden note', () => {
  const listing = { id: 'L1', owner_id: 'chloe', business_id: 'B1', type: 'event', title: 'Photo Walk',
    category_id: 'photography', price: 0, location: 'Student Center East',
    event_start: start, event_end: end, status: 'hidden', description: 'Bring a camera.\nAny camera.' };

  const owner = detailView(listing, 'chloe', TZ);
  assert.deepEqual(owner.facts, [['When', 'Fri, Nov 20 · 6:00 PM – 8:00 PM'], ['Where', 'Student Center East']]);
  assert.equal(owner.editHref, 'listing-edit.html?id=L1');
  assert.equal(owner.ownerNote, 'Only you can see this. It’s hidden.');
  assert.equal(owner.businessHref, 'business.html?id=B1');
  assert.equal(owner.description, 'Bring a camera.\nAny camera.');

  const other = detailView({ ...listing, status: 'active' }, 'dana', TZ);
  assert.equal(other.editHref, '');
  assert.equal(other.ownerNote, '');

  const removed = detailView({ ...listing, status: 'removed' }, 'chloe', TZ);
  assert.equal(removed.editHref, ''); // the rules block every edit to a removed listing
  assert.match(removed.ownerNote, /admin removed/);

  const service = detailView({ ...listing, type: 'service', availability: 'Saturdays', status: 'active' }, 'dana', TZ);
  assert.deepEqual(service.facts[0], ['Availability', 'Saturdays']);
});
