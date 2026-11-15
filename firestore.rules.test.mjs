// Tests for firestore.rules, run against the local Firestore emulator.
//
//   npm install          (once)
//   npm run test:rules
//
// Each test describes one thing a user should or shouldn't be able to do.
// When you add rules for a new collection, add tests for it here too.

import { readFileSync } from "node:fs";
import { test, before, beforeEach, after, describe } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs,
  serverTimestamp, Timestamp,
} from "firebase/firestore";

let testEnv;

// ---------- Test users ----------
const ALICE = { uid: "alice", email: "alice@student.gsu.edu" };   // owns a business
const CLUB = { uid: "club", email: "club@student.gsu.edu" };      // owns an organization
const BOB = { uid: "bob", email: "bob@student.gsu.edu" };         // ordinary student
const ADMIN = { uid: "admin1", email: "admin@gsu.edu" };

// A Firestore client signed in as `user`. Pass overrides to fake an unverified or non-GSU account.
function as(user, tokenOverrides = {}) {
  return testEnv
    .authenticatedContext(user.uid, { email: user.email, email_verified: true, ...tokenOverrides })
    .firestore();
}

// ---------- Valid documents (tests change one field to break them) ----------
function newBusiness(overrides = {}) {
  return {
    owner_id: ALICE.uid,
    type: "business",
    category_id: "beauty",
    name: "Braids by Alice",
    name_lower: "braids by alice",
    description: "Box braids and twists near campus.",
    location: "Student Center East",
    contact_info: "@braidsbyalice",
    logo_url: null,
    status: "active",
    created_at: serverTimestamp(),
    ...overrides,
  };
}

function newListing(overrides = {}) {
  return {
    business_id: "aliceBiz",
    owner_id: ALICE.uid,
    business_type: "business",
    category_id: "beauty",
    type: "service",
    title: "Box Braids",
    title_lower: "box braids",
    keywords: ["box", "braids", "beauty"],
    description: "Medium knotless box braids, hair included.",
    price: 120,
    availability: "Weekends",
    location: "Student Center East",
    photos: [],
    status: "active",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

function newFavorite(user, listingId = "activeListing", overrides = {}) {
  return { user_id: user.uid, listing_id: listingId, created_at: serverTimestamp(), ...overrides };
}

function newReview(user, overrides = {}) {
  return {
    user_id: user.uid,
    listing_id: "activeListing",
    business_id: "aliceBiz",
    rating: 5,
    comment: "Great braids, would book again!",
    created_at: serverTimestamp(),
    ...overrides,
  };
}

// Writes a favorite or review directly, with rules turned off, so a test can start from one.
async function seed(path, id, data) {
  await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path, id), data));
}

// ---------- Setup ----------
before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bento-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

// Fresh data before every test, written with rules turned off.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (u, role) => setDoc(doc(db, "users", u.uid), {
      name: u.uid, gsu_email: u.email, role, is_verified: true,
      profile_photo_url: null, created_at: serverTimestamp(),
    });
    await user(ALICE, "owner");
    await user(CLUB, "organization");
    await user(BOB, "student");
    await user(ADMIN, "admin");

    await setDoc(doc(db, "categories", "beauty"), { name: "Beauty", description: "" });
    await setDoc(doc(db, "categories", "clubs-social"), { name: "Clubs", description: "" });

    await setDoc(doc(db, "businesses", "aliceBiz"), newBusiness());
    await setDoc(doc(db, "businesses", "suspendedBiz"), newBusiness({ status: "suspended" }));
    await setDoc(doc(db, "businesses", "clubOrg"), newBusiness({
      owner_id: CLUB.uid, type: "organization", category_id: "clubs-social",
      name: "Chess Club", name_lower: "chess club",
    }));

    await setDoc(doc(db, "listings", "activeListing"), newListing());
    await setDoc(doc(db, "listings", "hiddenListing"), newListing({ status: "hidden" }));
    await setDoc(doc(db, "listings", "removedListing"), newListing({ status: "removed" }));
  });
});

// ---------- users ----------
describe("users", () => {
  test("a user can switch themselves from student to owner", async () => {
    await assertSucceeds(updateDoc(doc(as(BOB), "users", BOB.uid), { role: "owner" }));
  });

  test("a user cannot make themselves admin", async () => {
    await assertFails(updateDoc(doc(as(BOB), "users", BOB.uid), { role: "admin" }));
  });

  test("a user cannot edit someone else's profile", async () => {
    await assertFails(updateDoc(doc(as(BOB), "users", ALICE.uid), { name: "hacked" }));
  });

  test("an admin can change anyone's role", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), "users", BOB.uid), { role: "admin" }));
  });
});

// ---------- businesses ----------
describe("businesses", () => {
  test("a verified student can create their own business", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), "businesses", "bobBiz"),
      newBusiness({ owner_id: BOB.uid, name: "Bob's Photos", name_lower: "bob's photos" })));
  });

  test("an organization profile can be created too", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), "businesses", "bobClub"),
      newBusiness({ owner_id: BOB.uid, type: "organization", name: "Film Club", name_lower: "film club" })));
  });

  test("cannot create a business owned by someone else", async () => {
    await assertFails(setDoc(doc(as(BOB), "businesses", "fake"), newBusiness({ owner_id: ALICE.uid })));
  });

  test("an unverified email cannot create a business", async () => {
    await assertFails(setDoc(doc(as(BOB, { email_verified: false }), "businesses", "bobBiz"),
      newBusiness({ owner_id: BOB.uid })));
  });

  test("a non-GSU email cannot create a business", async () => {
    const outsider = { uid: "eve", email: "eve@gmail.com" };
    await assertFails(setDoc(doc(as(outsider), "businesses", "eveBiz"),
      newBusiness({ owner_id: outsider.uid })));
  });

  test("cannot create a business that starts out suspended or with a bad type", async () => {
    await assertFails(setDoc(doc(as(BOB), "businesses", "b1"), newBusiness({ owner_id: BOB.uid, status: "suspended" })));
    await assertFails(setDoc(doc(as(BOB), "businesses", "b2"), newBusiness({ owner_id: BOB.uid, type: "store" })));
  });

  test("cannot use a category that doesn't exist", async () => {
    await assertFails(setDoc(doc(as(BOB), "businesses", "b1"),
      newBusiness({ owner_id: BOB.uid, category_id: "no-such-category" })));
  });

  test("cannot add fields that aren't in the data model", async () => {
    await assertFails(setDoc(doc(as(BOB), "businesses", "b1"),
      newBusiness({ owner_id: BOB.uid, verified_badge: true })));
  });

  test("any verified student can view an active business", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "businesses", "aliceBiz")));
  });

  test("a suspended business is visible to its owner and admins only", async () => {
    await assertFails(getDoc(doc(as(BOB), "businesses", "suspendedBiz")));
    await assertSucceeds(getDoc(doc(as(ALICE), "businesses", "suspendedBiz")));
    await assertSucceeds(getDoc(doc(as(ADMIN), "businesses", "suspendedBiz")));
  });

  test("the owner can edit their profile", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "businesses", "aliceBiz"),
      { description: "Now doing locs too!", updated_at: serverTimestamp() }));
  });

  test("someone else cannot edit the profile", async () => {
    await assertFails(updateDoc(doc(as(BOB), "businesses", "aliceBiz"), { description: "hacked" }));
  });

  test("the owner cannot change status or hand the business to someone else", async () => {
    await assertFails(updateDoc(doc(as(ALICE), "businesses", "suspendedBiz"), { status: "active" }));
    await assertFails(updateDoc(doc(as(ALICE), "businesses", "aliceBiz"), { owner_id: BOB.uid }));
  });

  test("an admin can suspend a business but not rewrite it", async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), "businesses", "aliceBiz"), { status: "suspended" }));
    await assertFails(updateDoc(doc(as(ADMIN), "businesses", "aliceBiz"), { name: "Renamed" }));
  });

  test("owner or admin can delete; others cannot", async () => {
    await assertFails(deleteDoc(doc(as(BOB), "businesses", "aliceBiz")));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "businesses", "aliceBiz")));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "businesses", "clubOrg")));
  });
});

// ---------- listings ----------
describe("listings", () => {
  test("the owner of an active business can create a listing", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "listings", "new1"), newListing()));
  });

  test("cannot create a listing on someone else's business", async () => {
    await assertFails(setDoc(doc(as(BOB), "listings", "new1"), newListing({ owner_id: BOB.uid })));
    await assertFails(setDoc(doc(as(BOB), "listings", "new2"), newListing()));
  });

  test("cannot create a listing on a suspended business", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "new1"), newListing({ business_id: "suspendedBiz" })));
  });

  test("business_type must match the business", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "new1"), newListing({ business_type: "organization" })));
  });

  test("price must be a number from 0 up", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "n1"), newListing({ price: -5 })));
    await assertFails(setDoc(doc(as(ALICE), "listings", "n2"), newListing({ price: "120" })));
    await assertSucceeds(setDoc(doc(as(ALICE), "listings", "n3"), newListing({ price: 0 })));
  });

  test("title_lower must match title", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "n1"), newListing({ title_lower: "something else" })));
  });

  test("no more than 10 photos", async () => {
    const photos = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`);
    await assertFails(setDoc(doc(as(ALICE), "listings", "n1"), newListing({ photos })));
  });

  test("cannot create a listing that is already removed", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "n1"), newListing({ status: "removed" })));
  });

  test("organizations can post events with a start time", async () => {
    const start = Timestamp.fromDate(new Date("2026-11-20T18:00:00-05:00"));
    const end = Timestamp.fromDate(new Date("2026-11-20T20:00:00-05:00"));
    const event = newListing({
      business_id: "clubOrg", owner_id: CLUB.uid, business_type: "organization",
      category_id: "clubs-social", type: "event", title: "Chess Night", title_lower: "chess night",
      price: 0, event_start: start, event_end: end,
    });
    await assertSucceeds(setDoc(doc(as(CLUB), "listings", "event1"), event));
    await assertFails(setDoc(doc(as(CLUB), "listings", "event2"), { ...event, event_start: null }));
    await assertFails(setDoc(doc(as(CLUB), "listings", "event3"), { ...event, event_end: Timestamp.fromDate(new Date("2026-11-19")) }));
  });

  test("a business (not an organization) cannot post events", async () => {
    await assertFails(setDoc(doc(as(ALICE), "listings", "n1"), newListing({
      type: "event", event_start: Timestamp.fromDate(new Date("2026-11-20")),
    })));
  });

  test("active listings are visible; hidden ones only to the owner", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "listings", "activeListing")));
    await assertFails(getDoc(doc(as(BOB), "listings", "hiddenListing")));
    await assertSucceeds(getDoc(doc(as(ALICE), "listings", "hiddenListing")));
    await assertSucceeds(getDoc(doc(as(ADMIN), "listings", "hiddenListing")));
  });

  test("browse queries must filter to active listings", async () => {
    const listings = collection(as(BOB), "listings");
    await assertSucceeds(getDocs(query(listings, where("status", "==", "active"))));
    await assertFails(getDocs(listings));
  });

  test("an owner can list all of their own listings", async () => {
    const mine = query(collection(as(ALICE), "listings"), where("owner_id", "==", ALICE.uid));
    await assertSucceeds(getDocs(mine));
  });

  test("the owner can edit and hide their listing", async () => {
    const ref = doc(as(ALICE), "listings", "activeListing");
    await assertSucceeds(updateDoc(ref, { price: 110, updated_at: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "hidden", updated_at: serverTimestamp() }));
  });

  test("edits must set updated_at to the server time", async () => {
    await assertFails(updateDoc(doc(as(ALICE), "listings", "activeListing"), { price: 110 }));
  });

  test("someone else cannot edit the listing", async () => {
    await assertFails(updateDoc(doc(as(BOB), "listings", "activeListing"),
      { price: 1, updated_at: serverTimestamp() }));
  });

  test("the owner cannot mark a listing removed, or edit one an admin removed", async () => {
    await assertFails(updateDoc(doc(as(ALICE), "listings", "activeListing"),
      { status: "removed", updated_at: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ALICE), "listings", "removedListing"),
      { status: "active", updated_at: serverTimestamp() }));
  });

  test("the owner cannot move a listing to another business", async () => {
    await assertFails(updateDoc(doc(as(ALICE), "listings", "activeListing"),
      { business_id: "suspendedBiz", updated_at: serverTimestamp() }));
  });

  test("an admin can remove a listing but not edit its content", async () => {
    const ref = doc(as(ADMIN), "listings", "activeListing");
    await assertFails(updateDoc(ref, { title: "x", title_lower: "x", updated_at: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "removed", updated_at: serverTimestamp() }));
  });

  test("owner or admin can delete; others cannot", async () => {
    await assertFails(deleteDoc(doc(as(BOB), "listings", "activeListing")));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "listings", "activeListing")));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "listings", "hiddenListing")));
  });
});

// ---------- favorites ----------
describe("favorites", () => {
  test("a verified student can save a listing", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), "favorites", "bob_activeListing"), newFavorite(BOB)));
  });

  test("the document ID must be user_id + _ + listing_id", async () => {
    await assertFails(setDoc(doc(as(BOB), "favorites", "anything"), newFavorite(BOB)));
    await assertFails(setDoc(doc(as(BOB), "favorites", "bob_hiddenListing"), newFavorite(BOB)));
  });

  test("cannot save a favorite for someone else", async () => {
    await assertFails(setDoc(doc(as(BOB), "favorites", "alice_activeListing"), newFavorite(ALICE)));
  });

  test("cannot save a listing that doesn't exist", async () => {
    await assertFails(setDoc(doc(as(BOB), "favorites", "bob_nope"), newFavorite(BOB, "nope")));
  });

  test("only user_id, listing_id and created_at are allowed", async () => {
    await assertFails(setDoc(doc(as(BOB), "favorites", "bob_activeListing"),
      newFavorite(BOB, "activeListing", { note: "mine" })));
  });

  test("created_at must be the server time", async () => {
    await assertFails(setDoc(doc(as(BOB), "favorites", "bob_activeListing"),
      newFavorite(BOB, "activeListing", { created_at: Timestamp.fromDate(new Date("2020-01-01")) })));
  });

  test("unverified and non-GSU accounts cannot save favorites", async () => {
    await assertFails(setDoc(doc(as(BOB, { email_verified: false }), "favorites", "bob_activeListing"), newFavorite(BOB)));
    const outsider = { uid: "eve", email: "eve@gmail.com" };
    await assertFails(setDoc(doc(as(outsider), "favorites", "eve_activeListing"), newFavorite(outsider)));
  });

  test("you can only read your own favorites", async () => {
    await seed("favorites", "bob_activeListing", newFavorite(BOB));
    await assertSucceeds(getDoc(doc(as(BOB), "favorites", "bob_activeListing")));
    await assertFails(getDoc(doc(as(ALICE), "favorites", "bob_activeListing")));
    await assertFails(getDoc(doc(as(ADMIN), "favorites", "bob_activeListing")));
  });

  test("a user can list their own favorites with a user_id query", async () => {
    await seed("favorites", "bob_activeListing", newFavorite(BOB));
    await assertSucceeds(getDocs(query(collection(as(BOB), "favorites"), where("user_id", "==", BOB.uid))));
    await assertFails(getDocs(query(collection(as(BOB), "favorites"), where("user_id", "==", ALICE.uid))));
  });

  test("favorites cannot be edited", async () => {
    await seed("favorites", "bob_activeListing", newFavorite(BOB));
    await assertFails(updateDoc(doc(as(BOB), "favorites", "bob_activeListing"), { created_at: serverTimestamp() }));
  });

  test("only the owner of the favorite can remove it", async () => {
    await seed("favorites", "bob_activeListing", newFavorite(BOB));
    await assertFails(deleteDoc(doc(as(ALICE), "favorites", "bob_activeListing")));
    await assertSucceeds(deleteDoc(doc(as(BOB), "favorites", "bob_activeListing")));
  });
});

// ---------- reviews ----------
describe("reviews", () => {
  test("a verified student can review an active listing", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), "reviews", "bob_activeListing"), newReview(BOB)));
  });

  test("a rating alone is enough (the comment is optional)", async () => {
    const { comment, ...ratingOnly } = newReview(BOB);
    await assertSucceeds(setDoc(doc(as(BOB), "reviews", "bob_activeListing"), ratingOnly));
  });

  test("the document ID must be user_id + _ + listing_id", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "anything"), newReview(BOB)));
  });

  test("one review per person per listing", async () => {
    const ref = doc(as(BOB), "reviews", "bob_activeListing");
    await assertSucceeds(setDoc(ref, newReview(BOB)));
    await assertFails(setDoc(ref, newReview(BOB, { rating: 1 })));
  });

  test("rating must be a whole number from 1 to 5", async () => {
    const ref = doc(as(BOB), "reviews", "bob_activeListing");
    for (const rating of [0, 6, 3.5, -1, "5"]) {
      await assertFails(setDoc(ref, newReview(BOB, { rating })));
    }
    for (const rating of [1, 3, 5]) {
      await assertSucceeds(setDoc(ref, newReview(BOB, { rating })));
      await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "reviews", "bob_activeListing")));
    }
  });

  test("a comment can be up to 2000 characters, not more", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_activeListing"),
      newReview(BOB, { comment: "x".repeat(2001) })));
    await assertSucceeds(setDoc(doc(as(BOB), "reviews", "bob_activeListing"),
      newReview(BOB, { comment: "x".repeat(2000) })));
  });

  test("you cannot review your own listing", async () => {
    await assertFails(setDoc(doc(as(ALICE), "reviews", "alice_activeListing"), newReview(ALICE)));
  });

  test("you can only review active listings", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_hiddenListing"),
      newReview(BOB, { listing_id: "hiddenListing" })));
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_removedListing"),
      newReview(BOB, { listing_id: "removedListing" })));
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_nope"),
      newReview(BOB, { listing_id: "nope" })));
  });

  test("business_id must be the listing's business", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_activeListing"),
      newReview(BOB, { business_id: "clubOrg" })));
  });

  test("cannot write a review as someone else", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "club_activeListing"), newReview(CLUB)));
  });

  test("cannot add fields that aren't in the data model, or backdate created_at", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_activeListing"), newReview(BOB, { verified: true })));
    await assertFails(setDoc(doc(as(BOB), "reviews", "bob_activeListing"),
      newReview(BOB, { created_at: Timestamp.fromDate(new Date("2020-01-01")) })));
  });

  test("unverified and non-GSU accounts cannot review", async () => {
    await assertFails(setDoc(doc(as(BOB, { email_verified: false }), "reviews", "bob_activeListing"), newReview(BOB)));
    const outsider = { uid: "eve", email: "eve@gmail.com" };
    await assertFails(setDoc(doc(as(outsider), "reviews", "eve_activeListing"), newReview(outsider)));
  });

  test("any verified student can read reviews; others cannot", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    await assertSucceeds(getDoc(doc(as(CLUB), "reviews", "bob_activeListing")));
    await assertSucceeds(getDoc(doc(as(ALICE), "reviews", "bob_activeListing")));
    await assertFails(getDoc(doc(as(CLUB, { email_verified: false }), "reviews", "bob_activeListing")));
  });

  test("a listing's reviews can be queried", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    await assertSucceeds(getDocs(query(collection(as(CLUB), "reviews"), where("listing_id", "==", "activeListing"))));
  });

  test("the author can edit rating and comment (with updated_at)", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    const ref = doc(as(BOB), "reviews", "bob_activeListing");
    await assertSucceeds(updateDoc(ref, { rating: 3, comment: "Changed my mind.", updated_at: serverTimestamp() }));
  });

  test("an edit must set updated_at to the server time and keep a valid rating", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    const ref = doc(as(BOB), "reviews", "bob_activeListing");
    await assertFails(updateDoc(ref, { rating: 3 }));
    await assertFails(updateDoc(ref, { rating: 9, updated_at: serverTimestamp() }));
  });

  test("an edit cannot change who wrote it, which listing it is for, or when it was made", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    const ref = doc(as(BOB), "reviews", "bob_activeListing");
    await assertFails(updateDoc(ref, { user_id: ALICE.uid, updated_at: serverTimestamp() }));
    await assertFails(updateDoc(ref, { listing_id: "hiddenListing", updated_at: serverTimestamp() }));
    await assertFails(updateDoc(ref, { business_id: "clubOrg", updated_at: serverTimestamp() }));
    await assertFails(updateDoc(ref, { created_at: serverTimestamp(), updated_at: serverTimestamp() }));
  });

  test("someone else cannot edit the review, not even an admin", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    await assertFails(updateDoc(doc(as(ALICE), "reviews", "bob_activeListing"), { rating: 1, updated_at: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ADMIN), "reviews", "bob_activeListing"), { rating: 1, updated_at: serverTimestamp() }));
  });

  test("the author or an admin can delete a review; others cannot", async () => {
    await seed("reviews", "bob_activeListing", newReview(BOB));
    await assertFails(deleteDoc(doc(as(ALICE), "reviews", "bob_activeListing")));
    await assertSucceeds(deleteDoc(doc(as(BOB), "reviews", "bob_activeListing")));
    await seed("reviews", "bob_activeListing", newReview(BOB));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), "reviews", "bob_activeListing")));
  });
});

// ---------- everything else ----------
describe("collections without rules yet", () => {
  test("are locked", async () => {
    await assertFails(setDoc(doc(as(BOB), "reports", "r1"), { reason: "spam" }));
    await assertFails(getDoc(doc(as(BOB), "rsvps", "r1")));
  });
});
