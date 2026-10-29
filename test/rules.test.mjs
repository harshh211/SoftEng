import { readFileSync } from "node:fs";
import { test, before, after, beforeEach } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-bento",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// A signed-in student with a verified GSU email
const gsuUser = (uid) =>
  env.authenticatedContext(uid, {
    email: `${uid}@student.gsu.edu`,
    email_verified: true,
  }).firestore();

// Puts a profile in the fake database, skipping the rules
const seedUser = (uid, data) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}`), data);
  });

test("verified GSU student can create their own profile as a student", async () => {
  const db = gsuUser("alice");
  await assertSucceeds(
    setDoc(doc(db, "users/alice"), { name: "Alice", role: "student" })
  );
});

test("non-GSU email cannot create a profile", async () => {
  const db = env
    .authenticatedContext("bob", { email: "bob@gmail.com", email_verified: true })
    .firestore();
  await assertFails(
    setDoc(doc(db, "users/bob"), { name: "Bob", role: "student" })
  );
});

test("user cannot create a profile with the admin role", async () => {
  const db = gsuUser("mallory");
  await assertFails(
    setDoc(doc(db, "users/mallory"), { name: "Mallory", role: "admin" })
  );
});

test("user cannot change their own role after signing up", async () => {
  await seedUser("carol", { name: "Carol", role: "student" });
  const db = gsuUser("carol");
  await assertFails(
    setDoc(doc(db, "users/carol"), { name: "Carol", role: "admin" })
  );
});

test("user cannot read someone else's profile", async () => {
  await seedUser("dave", { name: "Dave", role: "student" });
  const db = gsuUser("erin");
  await assertFails(getDoc(doc(db, "users/dave")));
});
