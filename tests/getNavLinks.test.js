// Test 2: getNavLinks() — decides which links the shared nav shows for each role.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNavLinks } from '../js/utils/nav.js';

const hrefs = (role) => getNavLinks(role).map((link) => link.href);
const STUDENT = ['index.html', 'events.html', 'favorites.html', 'messages.html'];

test('getNavLinks returns the right links for each role', () => {
  // Students (and anyone signed out) get the base links only
  assert.deepEqual(hrefs('student'), STUDENT);
  assert.deepEqual(hrefs(undefined), STUDENT);

  // Each special role gets exactly one extra link
  assert.deepEqual(hrefs('owner'), [...STUDENT, 'my-listings.html']);
  assert.deepEqual(hrefs('organization'), [...STUDENT, 'my-events.html']);
  assert.deepEqual(hrefs('admin'), [...STUDENT, 'admin-reports.html']);

  // Unknown roles never see admin pages
  assert.equal(hrefs('superuser').includes('admin-reports.html'), false);
  assert.equal(hrefs('toString').length, STUDENT.length);
});
