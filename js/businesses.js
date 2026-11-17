import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

export const BUSINESS_TYPES = {
  business: "Business",
  organization: "Club / organization",
};

export const LIMITS = {
  name: 80,
  description: 2000,
  location: 200,
  contact_info: 200,
};

const EDITABLE_FIELDS = ["name", "category_id", "description", "location", "contact_info"];

function currentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please log in again.");
  return user;
}

function trimFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  return out;
}

export function validateBusiness(fields) {
  const f = trimFields(fields);
  if (!(f.type in BUSINESS_TYPES)) return "Choose whether this is a business or a club.";
  if (!f.name) return "Please enter a name.";
  if (f.name.length > LIMITS.name) return `Name must be ${LIMITS.name} characters or fewer.`;
  if (!f.category_id) return "Please choose a category.";
  if ((f.description || "").length > LIMITS.description) {
    return `Description must be ${LIMITS.description} characters or fewer.`;
  }
  if ((f.location || "").length > LIMITS.location) {
    return `Location must be ${LIMITS.location} characters or fewer.`;
  }
  if ((f.contact_info || "").length > LIMITS.contact_info) {
    return `Contact info must be ${LIMITS.contact_info} characters or fewer.`;
  }
  return null;
}

export async function listCategories() {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function createBusiness(fields) {
  const user = currentUser();
  const f = trimFields(fields);
  const error = validateBusiness(f);
  if (error) throw new Error(error);

  const ref = await addDoc(collection(db, "businesses"), {
    owner_id: user.uid,
    type: f.type,
    category_id: f.category_id,
    name: f.name,
    name_lower: f.name.toLowerCase(),
    description: f.description || "",
    location: f.location || "",
    contact_info: f.contact_info || "",
    logo_url: null,
    status: "active",
    created_at: serverTimestamp(),
  });

  try {
    await promoteRole(user.uid, f.type);
  } catch (err) {
    console.warn("Profile created, but the role update failed:", err);
  }
  return ref.id;
}

async function promoteRole(uid, type) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().role === "student") {
    await updateDoc(userRef, { role: type === "organization" ? "organization" : "owner" });
  }
}

export async function updateBusiness(current, fields) {
  const f = trimFields(fields);
  const merged = { ...current, ...f };
  const error = validateBusiness(merged);
  if (error) throw new Error(error);

  const changes = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in f && f[key] !== (current[key] ?? "")) changes[key] = f[key];
  }
  if (Object.keys(changes).length === 0) return false;
  if ("name" in changes) changes.name_lower = changes.name.toLowerCase();
  changes.updated_at = serverTimestamp();

  await updateDoc(doc(db, "businesses", current.id), changes);
  return true;
}

export async function getBusiness(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "businesses", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    if (err?.code === "permission-denied") return null;
    throw err;
  }
}

export async function getMyBusinesses() {
  const user = currentUser();
  const snap = await getDocs(query(collection(db, "businesses"), where("owner_id", "==", user.uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function getActiveListings(businessId) {
  const snap = await getDocs(
    query(
      collection(db, "listings"),
      where("status", "==", "active"),
      where("business_id", "==", businessId),
      orderBy("created_at", "desc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
