// Browse filters: how a search is split between Firestore and the browser.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTERS,
  filtersToSearch,
  matchesFilters,
  pickServerFilter,
  priceRangeError,
  readFilters,
  searchWords,
} from '../js/utils/browse-filters.js';

// A few listings shaped like the seed data (scripts/seed.mjs).
const L = {
  boxBraids: { title: 'Box Braids', status: 'active', type: 'service', category_id: 'beauty',
    business_type: 'business', price: 120, keywords: ['box', 'braids', 'beauty'] },
  freeConsult: { title: 'Free Braid Consultation', status: 'active', type: 'service', category_id: 'beauty',
    business_type: 'business', price: 0, keywords: ['free', 'braid', 'consultation', 'beauty'] },
  charger: { title: 'Phone Charger Cable', status: 'active', type: 'product', category_id: 'tech-repair',
    business_type: 'business', price: 10, keywords: ['phone', 'charger', 'cable', 'tech', 'repair'] },
  photoWalk: { title: 'Campus Photo Walk', status: 'active', type: 'event', category_id: 'photography',
    business_type: 'organization', price: 0, keywords: ['campus', 'photo', 'walk', 'photography'] },
  hiddenGel: { title: 'Edge Control Gel', status: 'hidden', type: 'product', category_id: 'beauty',
    business_type: 'business', price: 12.5, keywords: ['edge', 'control', 'gel', 'beauty'] },
  removedPhone: { title: 'Refurbished Phone', status: 'removed', type: 'product', category_id: 'tech-repair',
    business_type: 'business', price: 150, keywords: ['refurbished', 'phone', 'tech', 'repair'] },
};
const ALL = Object.entries(L);
const titlesFor = (filters) => ALL.filter(([, l]) => matchesFilters(l, filters)).map(([k]) => k);
const f = (changes) => ({ ...EMPTY_FILTERS, ...changes });

test('search words are split the same way makeKeywords builds them', () => {
  assert.deepEqual(searchWords('  Box  BRAIDS! box '), ['box', 'braids']);
  assert.deepEqual(searchWords('a photo'), ['photo']); // 1-letter words are dropped
  assert.deepEqual(searchWords(''), []);
});

test('each filter works on its own', () => {
  assert.deepEqual(titlesFor(f({ q: 'box braids' })), ['boxBraids']);           // every word must match
  assert.deepEqual(titlesFor(f({ q: 'box lunch' })), []);
  assert.deepEqual(titlesFor(f({ category: 'beauty' })), ['boxBraids', 'freeConsult']);
  assert.deepEqual(titlesFor(f({ type: 'event' })), ['photoWalk']);
  assert.deepEqual(titlesFor(f({ by: 'organization' })), ['photoWalk']);
  assert.deepEqual(titlesFor(f({ max: 0 })), ['freeConsult', 'photoWalk']);    // free only
  assert.deepEqual(titlesFor(f({ min: 50 })), ['boxBraids']);
});

test('filters work together', () => {
  assert.deepEqual(titlesFor(f({ category: 'beauty', max: 50 })), ['freeConsult']);
  assert.deepEqual(titlesFor(f({ q: 'phone', type: 'product', max: 20 })), ['charger']);
  assert.deepEqual(titlesFor(f({ type: 'event', by: 'business' })), []); // empty state
});

test('hidden and removed listings never match, whatever the filters', () => {
  assert.deepEqual(titlesFor(EMPTY_FILTERS), ['boxBraids', 'freeConsult', 'charger', 'photoWalk']);
  assert.equal(matchesFilters(L.hiddenGel, f({ q: 'gel' })), false);
  assert.equal(matchesFilters(L.removedPhone, f({ q: 'refurbished' })), false);
});

test('Firestore gets status plus at most one filter, in priority order', () => {
  const all = f({ q: 'Box Braids', category: 'beauty', type: 'service', by: 'business' });
  assert.deepEqual(pickServerFilter(all), { field: 'keywords', op: 'array-contains', value: 'box' });
  assert.deepEqual(pickServerFilter(f({ category: 'beauty', type: 'service' })),
    { field: 'category_id', op: '==', value: 'beauty' });
  assert.deepEqual(pickServerFilter(f({ type: 'event', by: 'organization' })),
    { field: 'type', op: '==', value: 'event' });
  assert.deepEqual(pickServerFilter(f({ by: 'organization' })),
    { field: 'business_type', op: '==', value: 'organization' });
  assert.equal(pickServerFilter(f({ max: 50 })), null); // price is filtered in the browser
});

test('filters survive a round trip through the URL, and bad values are ignored', () => {
  const filters = f({ q: 'braids', category: 'beauty', type: 'service', by: 'business', min: 0, max: 50 });
  assert.deepEqual(readFilters(filtersToSearch(filters)), filters);
  assert.equal(filtersToSearch(EMPTY_FILTERS), '');
  assert.deepEqual(readFilters('?type=weapon&by=nobody&min=-5&max=abc'), EMPTY_FILTERS);
});

test('a min price above the max price is reported', () => {
  assert.equal(priceRangeError(f({ min: 50, max: 10 })), 'Min price is higher than max price.');
  assert.equal(priceRangeError(f({ min: 10, max: 10 })), null);
});
