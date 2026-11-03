// Profile/settings page: view your account and edit your name.
// Use case: "Create own profile" / "Settings". Writes to users/{uid}.name (ERD: USER.name).
import {
  onAuthStateChanged,
  updateProfile,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { validateDisplayName, getInitials } from './utils/profile.js';

const ROLE_LABELS = {
  student: 'Student',
  owner: 'Business owner',
  organization: 'Organization admin',
  admin: 'System admin',
};

const els = {
  loading: document.getElementById('profile-loading'),
  content: document.getElementById('profile-content'),
  avatar: document.getElementById('profile-avatar'),
  name: document.querySelector('[data-field="name"]'),
  email: document.querySelector('[data-field="email"]'),
  role: document.querySelector('[data-field="role"]'),
  form: document.getElementById('profile-form'),
  nameInput: document.getElementById('name-input'),
  nameError: document.getElementById('name-error'),
  emailInput: document.getElementById('email-input'),
  saveButton: document.getElementById('save-button'),
  status: document.getElementById('save-status'),
  signOut: document.getElementById('sign-out-button'),
};

let currentUser = null;
let savedName = '';

function showIdentity({ name, email, role }) {
  els.avatar.textContent = getInitials(name);
  els.name.textContent = name;
  els.email.textContent = email;
  els.role.textContent = ROLE_LABELS[role] || ROLE_LABELS.student;
}

function setStatus(message, type) {
  els.status.textContent = message;
  els.status.className = `status${type ? ` status--${type}` : ''}`;
}

function setNameError(message) {
  els.nameError.textContent = message || '';
  els.nameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

async function loadProfile(user) {
  let data = {};
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    console.error('Could not load profile', err);
    setStatus('Couldn’t load your saved profile. Check your connection and refresh.', 'error');
  }

  const profile = {
    name: data.name || user.displayName || '',
    email: data.gsu_email || user.email || '',
    role: data.role || 'student',
  };

  savedName = profile.name;
  els.nameInput.value = profile.name;
  els.emailInput.value = profile.email;
  showIdentity({ ...profile, name: profile.name || 'Add your name' });

  els.loading.hidden = true;
  els.content.hidden = false;
}

els.nameInput.addEventListener('input', () => {
  setNameError('');
  setStatus('');
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const result = validateDisplayName(els.nameInput.value);
  if (!result.valid) {
    setNameError(result.error);
    els.nameInput.focus();
    return;
  }
  if (result.value === savedName) {
    setStatus('No changes to save.', null);
    return;
  }

  els.saveButton.disabled = true;
  setStatus('Saving…', null);

  try {
    await setDoc(
      doc(db, 'users', currentUser.uid),
      { name: result.value, updated_at: serverTimestamp() },
      { merge: true },
    );
    await updateProfile(currentUser, { displayName: result.value });

    savedName = result.value;
    els.nameInput.value = result.value;
    els.name.textContent = result.value;
    els.avatar.textContent = getInitials(result.value);
    setStatus('Changes saved.', 'success');
    window.dispatchEvent(new CustomEvent('bento:profile-updated', { detail: { name: result.value } }));
  } catch (err) {
    console.error('Could not save profile', err);
    setStatus('Your name wasn’t saved. Check your connection and try again.', 'error');
  } finally {
    els.saveButton.disabled = false;
  }
});

els.signOut.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Sign out failed', err);
    setStatus('Sign out didn’t work. Try again.', 'error');
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Profile is only for signed-in users.
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  loadProfile(user);
});
