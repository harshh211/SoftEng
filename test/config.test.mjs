// Quick checks that need no emulator: `npm test`.
// The full rules tests (firestore.rules.test.mjs) run with `npm run test:rules`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Firebase config points at the optic-d2702 project", () => {
  assert.match(read("js/firebase-config.js"), /projectId:\s*["']optic-d2702["']/);
});

test("rules only let verified @student.gsu.edu / @gsu.edu accounts in", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /\(student\[\.\]\)\?gsu\[\.\]edu/, "GSU email check is missing");
  assert.match(rules, /email_verified == true/, "email verification check is missing");
});

test("rules do not let users sign up as admin", () => {
  const rules = read("firestore.rules");
  // New accounts must start as a student.
  assert.match(rules, /request\.resource\.data\.role == 'student'/, "signup role check is missing");
  // The roles a user can give themselves do not include admin.
  const selfRoles = rules.match(/function selfRoles\(\)\s*\{\s*return \[([^\]]*)\]/);
  assert.ok(selfRoles, "selfRoles() is missing");
  assert.ok(!selfRoles[1].includes("admin"), "users must not be able to give themselves admin");
});

test("rules never allow everything", () => {
  const rules = read("firestore.rules");
  // Anything without a match block is locked by default, so there must be no allow-all.
  assert.doesNotMatch(rules, /if\s+true/, "found an allow-all rule");
  assert.doesNotMatch(rules, /match\s+\/\{document=\*\*\}/, "found a wildcard match block");
});
