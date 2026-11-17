// Test 2: getNavLinks() — decides which links the shared nav shows for each role.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNavLinks } from '../js/utils/nav.js';

const hrefs = (role) => getNavLinks(role).map((link) => link.href);
const EVERYONE = ['browse.html', 'business-edit.html', 'my-listings.html'];

test('getNavLinks returns the right links for each role', () => {
  // Students, owners, organizations and signed-out users all see the same links
  for (const role of ['student', 'owner', 'organization', undefined]) {
    assert.deepEqual(hrefs(role), EVERYONE);
  }

  // Admins get one extra link
  assert.deepEqual(hrefs('admin'), [...EVERYONE, 'admin-reports.html']);

  // Unknown roles never see admin pages
  assert.equal(hrefs('superuser').includes('admin-reports.html'), false);
  assert.equal(hrefs('toString').length, EVERYONE.length);
});
