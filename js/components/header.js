// Shared header + navigation (NFR-1.1: consistent look and feel on every page).
// Usage on any page:
//   <div id="site-header"></div>
//   <main id="main"> ... </main>
//   <script type="module" src="js/components/header.js"></script>
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { auth, db } from '../firebase.js';
import { getNavLinks, isActiveLink } from '../utils/nav.js';
import { getInitials } from '../utils/profile.js';

const ICONS = {
  discover: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  events: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  favorites: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  messages: '<path d="M4 5h16v11H9l-5 4Z"/>',
  listings: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="16" height="7" rx="1"/>',
  calendar: '<path d="M12 4v16M4 12h16"/><rect x="4" y="4" width="16" height="16" rx="2"/>',
  reports: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
};

function icon(name) {
  return `<svg class="site-nav__icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function navMarkup(role) {
  const path = window.location.pathname;
  return getNavLinks(role).map((link) => {
    const current = isActiveLink(link.href, path) ? ' aria-current="page"' : '';
    return `<li><a class="site-nav__link" href="${link.href}"${current}>${icon(link.icon)}<span>${link.label}</span></a></li>`;
  }).join('');
}

function accountMarkup(user) {
  if (!user) return '<a class="btn btn--small" href="login.html">Log in</a>';
  const current = isActiveLink('profile.html', window.location.pathname) ? ' aria-current="page"' : '';
  return `<a class="avatar" href="profile.html" title="Profile and settings"
      aria-label="Profile and settings for ${escapeHtml(user.name)}"${current}>${escapeHtml(getInitials(user.name))}</a>`;
}

export function renderHeader(target, user = null) {
  target.innerHTML = `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="index.html" aria-label="Bento home">
          <span class="brand__box" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="brand__word">bento</span>
        </a>
        <nav class="site-nav" aria-label="Main">
          <ul>${navMarkup(user?.role)}</ul>
        </nav>
        <div class="site-header__account">${accountMarkup(user)}</div>
      </div>
    </header>`;
}

// Loads name + role from users/{uid}, falling back to the Auth profile.
async function loadUser(firebaseUser) {
  const fallback = {
    name: firebaseUser.displayName || firebaseUser.email || 'Student',
    role: 'student',
  };
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!snap.exists()) return fallback;
    const data = snap.data();
    return { name: data.name || fallback.name, role: data.role || 'student' };
  } catch (err) {
    console.warn('Header: could not load user profile', err);
    return fallback;
  }
}

export function mountHeader(target = document.getElementById('site-header')) {
  if (!target) return;
  document.body.classList.add('has-site-nav');
  renderHeader(target, null);

  let current = null;
  onAuthStateChanged(auth, async (firebaseUser) => {
    current = firebaseUser ? await loadUser(firebaseUser) : null;
    renderHeader(target, current);
  });

  // profile.js fires this after a name change so the avatar updates right away.
  window.addEventListener('bento:profile-updated', (event) => {
    if (!current) return;
    current = { ...current, ...event.detail };
    renderHeader(target, current);
  });
}

mountHeader();
