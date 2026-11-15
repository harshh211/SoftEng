
const PROJECT = "optic-d2702"; 
const FIRESTORE = "http://127.0.0.1:8080";
const AUTH = "http://127.0.0.1:9099";
const PASSWORD = "bento123";

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to connect to ${host}. This script only talks to the local emulators.`);
  }
}

async function call(method, url, body, headers = {}) {
  assertLocal(url);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Could not reach ${url}. Are the emulators running?\n` +
        `Start them with: npx firebase emulators:start --project ${PROJECT}`
    );
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
}

const ADMIN = { Authorization: "Bearer owner" };

async function writeDoc(collectionPath, id, data) {
  const url = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${collectionPath}/${id}`;
  await call("PATCH", url, { fields: toFields(data) }, ADMIN);
}

function makeKeywords(title, categoryName = "") {
  const words = `${title} ${categoryName}`.toLowerCase().match(/[a-z0-9]+/g) || [];
  return [...new Set(words)].filter((w) => w.length > 1).slice(0, 30);
}

const categories = [
  { id: "beauty", name: "Beauty", description: "Hair, nails, makeup and skincare" },
  { id: "food", name: "Food", description: "Baked goods, meals and snacks" },
  { id: "photography", name: "Photography", description: "Photo shoots, headshots and editing" },
  { id: "art", name: "Art", description: "Prints, commissions and handmade art" },
  { id: "tutoring", name: "Tutoring", description: "Help with classes and exams" },
  { id: "tech-repair", name: "Tech Repair", description: "Phone, laptop and gadget fixes" },
  { id: "fashion", name: "Fashion", description: "Clothing, accessories and handmade goods" },
  { id: "clubs-social", name: "Clubs & Social", description: "Student clubs and social events" },
];
const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

const users = [
  { key: "alice", name: "Alice Johnson", email: "alice@student.gsu.edu", role: "owner" },
  { key: "ben", name: "Ben Carter", email: "ben@student.gsu.edu", role: "owner" },
  { key: "chloe", name: "Chloe Nguyen", email: "chloe@student.gsu.edu", role: "organization" },
  { key: "dana", name: "Dana Lee", email: "dana@student.gsu.edu", role: "student" },
  { key: "admin", name: "Admin User", email: "admin@student.gsu.edu", role: "admin" },
];

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysFromNow = (d, hour = 16) => {
  const t = new Date(now + d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t;
};

const businesses = [
  {
    key: "braids", ownerKey: "alice", type: "business", category_id: "beauty",
    name: "Braids by Alice", status: "active",
    description: "Box braids, knotless braids and hair care, done in my apartment near campus.",
    location: "Near Georgia State campus", contact_info: "alice@student.gsu.edu",
  },
  {
    key: "techfix", ownerKey: "ben", type: "business", category_id: "tech-repair",
    name: "Ben's Tech Fix", status: "active",
    description: "Fast, cheap phone and laptop repairs for students.",
    location: "Student Center East", contact_info: "ben@student.gsu.edu",
  },
  {
    key: "photoclub", ownerKey: "chloe", type: "organization", category_id: "photography",
    name: "GSU Photography Club", status: "active",
    description: "Weekly photo walks, workshops and exhibits. All skill levels welcome.",
    location: "Arts and Humanities Building", contact_info: "chloe@student.gsu.edu",
  },
  {
    key: "bites", ownerKey: "ben", type: "business", category_id: "food",
    name: "Panther Bites", status: "suspended",
    description: "Homemade snacks. (Suspended by an admin: use this to test hidden profiles.)",
    location: "Library North", contact_info: "ben@student.gsu.edu",
  },
];

const listings = [
  { biz: "braids", type: "service", title: "Box Braids", price: 120, availability: "Weekends",
    description: "Medium box braids. Hair included. Takes about 5 hours.", hoursAgo: 1 },
  { biz: "braids", type: "service", title: "Knotless Braids", price: 150, availability: "Weekdays after 3pm",
    description: "Knotless braids, mid-back length. Book a week ahead.", hoursAgo: 2 },
  { biz: "braids", type: "service", title: "Free Braid Consultation", price: 0, availability: "Weekends",
    description: "20-minute chat about styles, hair type and pricing.", hoursAgo: 3 },
  { biz: "braids", type: "product", title: "Hair Care Bundle", price: 25,
    description: "Leave-in conditioner, edge brush and satin scrunchies.", hoursAgo: 4 },
  { biz: "braids", type: "product", title: "Handmade Crochet Hat", price: 22, category_id: "fashion",
    description: "Warm crochet beanie in six colors.", hoursAgo: 5 },
  { biz: "braids", type: "product", title: "Edge Control Gel", price: 12.5, status: "hidden",
    description: "Hidden listing: only Alice can see this one.", hoursAgo: 6 },

  { biz: "techfix", type: "service", title: "Phone Screen Repair", price: 80, availability: "Weekdays 12pm-6pm",
    description: "Cracked screen? Most iPhones and Androids fixed the same day.", hoursAgo: 7 },
  { biz: "techfix", type: "service", title: "Laptop Cleanup and Tune-up", price: 45, availability: "By appointment",
    description: "Remove malware, free up storage and speed up your laptop.", hoursAgo: 8 },
  { biz: "techfix", type: "service", title: "Python Tutoring", price: 20, category_id: "tutoring",
    availability: "Evenings", description: "Help with intro CS classes. Price is per hour.", hoursAgo: 9 },
  { biz: "techfix", type: "product", title: "Phone Charger Cable", price: 10,
    description: "USB-C and Lightning cables, tested before sale.", hoursAgo: 10 },
  { biz: "techfix", type: "product", title: "Refurbished Phone", price: 150, status: "removed",
    description: "Removed by an admin: use this to test removed listings.", hoursAgo: 11 },

  { biz: "photoclub", type: "event", title: "Campus Photo Walk", price: 0,
    description: "Bring any camera or just your phone. We meet at the Student Center.",
    location: "Student Center East", event_start: daysFromNow(7, 16), event_end: daysFromNow(7, 18), hoursAgo: 12 },
  { biz: "photoclub", type: "event", title: "Portrait Workshop", price: 5,
    description: "Learn lighting and posing basics. Small group, so sign up early.",
    location: "Arts and Humanities Building", event_start: daysFromNow(14, 18), event_end: daysFromNow(14, 20), hoursAgo: 13 },
  { biz: "photoclub", type: "event", title: "Fall Photo Exhibit", price: 0,
    description: "Past event: use this to test how finished events look.",
    location: "Library North", event_start: daysFromNow(-10, 17), event_end: daysFromNow(-10, 20), hoursAgo: 14 },
  { biz: "photoclub", type: "service", title: "Headshot Sessions", price: 30, availability: "Saturdays",
    description: "Professional-style headshots for LinkedIn and resumes.", hoursAgo: 15 },
  { biz: "photoclub", type: "product", title: "Club T-Shirt", price: 18, category_id: "clubs-social",
    description: "Official GSU Photography Club tee, sizes S to XL.", hoursAgo: 16 },
];

async function createLogin(user) {
  const created = await call(
    "POST",
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
    { email: user.email, password: PASSWORD, displayName: user.name }
  );
  await call(
    "POST",
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-key`,
    { localId: created.localId, emailVerified: true },
    ADMIN
  );
  return created.localId;
}

async function main() {
  console.log(`Seeding the local emulators (project ${PROJECT})...`);

  await call("DELETE", `${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await call("DELETE", `${AUTH}/emulator/v1/projects/${PROJECT}/accounts`);
  console.log("  wiped old emulator data");

  const uid = {};
  for (const u of users) uid[u.key] = await createLogin(u);
  console.log(`  created ${users.length} verified logins`);

  const created = new Date(now);
  for (const c of categories) {
    await writeDoc("categories", c.id, { name: c.name, description: c.description });
  }
  for (const u of users) {
    await writeDoc("users", uid[u.key], {
      name: u.name,
      gsu_email: u.email,
      role: u.role,
      is_verified: true,
      profile_photo_url: null,
      created_at: created,
    });
  }

  const bizId = {};
  for (const b of businesses) {
    const id = `${b.key}`;
    bizId[b.key] = id;
    await writeDoc("businesses", id, {
      owner_id: uid[b.ownerKey],
      type: b.type,
      category_id: b.category_id,
      name: b.name,
      name_lower: b.name.toLowerCase(),
      description: b.description,
      location: b.location,
      contact_info: b.contact_info,
      logo_url: null,
      status: b.status,
      created_at: created,
      updated_at: created,
    });
  }

  let n = 0;
  for (const l of listings) {
    const biz = businesses.find((b) => b.key === l.biz);
    const categoryId = l.category_id || biz.category_id;
    const when = new Date(now - l.hoursAgo * 60 * 60 * 1000);
    const doc = {
      business_id: bizId[biz.key],
      owner_id: uid[biz.ownerKey],
      business_type: biz.type,
      category_id: categoryId,
      type: l.type,
      title: l.title,
      title_lower: l.title.toLowerCase(),
      keywords: makeKeywords(l.title, categoryName[categoryId]),
      description: l.description,
      price: l.price,
      location: l.location || biz.location,
      photos: [],
      status: l.status || "active",
      created_at: when,
      updated_at: when,
    };
    if (l.availability) doc.availability = l.availability;
    if (l.type === "event") {
      doc.event_start = l.event_start;
      doc.event_end = l.event_end;
    }
    n += 1;
    await writeDoc("listings", `listing${String(n).padStart(2, "0")}`, doc);
  }

  console.log(
    `  wrote ${categories.length} categories, ${users.length} users, ` +
      `${businesses.length} businesses, ${listings.length} listings`
  );
  console.log(`\nDone. Sign in with any login in scripts/README.md (password: ${PASSWORD}).`);
}

main().catch((err) => {
  console.error("\nSeed failed:\n" + err.message);
  process.exit(1);
});
