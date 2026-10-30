// Pure navigation helpers (no Firebase, no DOM) so they can be unit tested in Node.

// Links every user sees, in display order.
export const BASE_LINKS = [
  { href: 'index.html', label: 'Discover', icon: 'discover' },
  { href: 'events.html', label: 'Events', icon: 'events' },
  { href: 'favorites.html', label: 'Favorites', icon: 'favorites' },
  { href: 'messages.html', label: 'Messages', icon: 'messages' },
];

// Extra links by role (FR-1.4: student, business owner, organization, admin).
export const ROLE_LINKS = {
  owner: [{ href: 'my-listings.html', label: 'My listings', icon: 'listings' }],
  organization: [{ href: 'my-events.html', label: 'My events', icon: 'calendar' }],
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
 * "/" and "/bento/" count as index.html.
 */
export function isActiveLink(href, pathname) {
  const page = (pathname || '/').split('/').pop() || 'index.html';
  return page === href;
}
