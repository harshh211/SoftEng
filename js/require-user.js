// Waits for Firebase to say who is signed in. Resolves with the user, or null if nobody is.
// Firestore only lets verified GSU students read listings, so browse and listing pages call this
// before running any query. Swap for requireAuth() from js/auth.js once that file exists.
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { auth } from './firebase-config.js';

export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user);
    });
  });
}

/** Turns a Firebase error into a sentence a student can act on. Never shows the raw error. */
export function friendlyError(err) {
  switch (err?.code) {
    case 'permission-denied':
      return 'Only verified GSU students can see listings. Log in with your verified GSU email.';
    case 'unavailable':
      return 'Can’t reach Bento right now. Check your connection and try again.';
    case 'failed-precondition':
      return 'This search isn’t set up yet. Try fewer filters.';
    default:
      return 'Something went wrong loading listings. Refresh the page to try again.';
  }
}
