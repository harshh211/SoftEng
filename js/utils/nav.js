// Pure navigation helpers (no Firebase, no DOM) so they can be unit tested in Node.

// Links every user sees, in display order. Profile is the avatar on the right of the header.
// Round 2 pages: browse.html (Mariam), business-edit.html (Kadie), my-listings.html (Adrian).
export const BASE_LINKS = [
  { href: 'browse.html', label: 'Browse', icon: 'discover' },
  { href: 'business-edit.html', label: 'My business', icon: 'business' },
  { href: 'my-listings.html', label: 'My listings', icon: 'listings' },
];

// Extra links by role (FR-1.4: student, business owner, organization, admin).
export const ROLE_LINKS = {
  admin: [{ href: 'admin-reports.html', label: 'Reports', icon: 'reports' }],
};

/**
 * Returns the nav links for a user role. Unknown or missing roles get the
 * student links only, so a bad role value never shows owner/admin pages.
 * @param {string|undefined|null} role
 * @returns {{href:string,label:string,icon:string}[]}
 */
export function getNavLinks(role) {
  const key = typeof role === 'string' ? role.trim().toLowerCase() : '';
  const extra = Object.prototype.hasOwnProperty.call(ROLE_LINKS, key) ? ROLE_LINKS[key] : [];
  return [...BASE_LINKS, ...extra].map((link) => ({ ...link }));
}

/**
 * True when a nav link points at the page currently open.
 * "/" counts as index.html. Query strings (browse.html?type=event) are ignored.
 */
export function isActiveLink(href, pathname) {
  const page = (pathname || '/').split('/').pop() || 'index.html';
  return page === href;
}
