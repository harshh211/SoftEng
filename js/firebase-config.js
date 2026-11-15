// Firebase setup for Bento. Safe to commit: access is controlled by firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABDg3Fv4X1kweBJNFz4rmxP0wK6lo58EQ",
  authDomain: "optic-d2702.firebaseapp.com",
  projectId: "optic-d2702",
  storageBucket: "optic-d2702.firebasestorage.app",
  messagingSenderId: "529865163749",
  appId: "1:529865163749:web:a242512d6fe8c24432650c",
  measurementId: "G-JSB3HTXYE5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Local development: when the page is opened from this computer, use the Firebase
// emulators so test accounts and data never reach the real project.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}