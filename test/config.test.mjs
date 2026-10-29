import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const rules = readFileSync("firestore.rules", "utf8");
const config = readFileSync("js/firebase-config.js", "utf8");

test("Firebase config points at the optic-d2702 project", () => {
  assert.match(config, /projectId:\s*"optic-d2702"/);
});

test("rules only let verified @student.gsu.edu accounts in", () => {
  assert.match(rules, /email_verified == true/);
  assert.match(rules, /student\[\.\]gsu\[\.\]edu/);
});

test("rules do not let users sign up as admin", () => {
  const signupRoles = rules.match(/role in \[(.*?)\]/);
  assert.ok(signupRoles, "signup role check is missing");
  assert.ok(!signupRoles[1].includes("admin"));
});

test("rules deny everything that is not explicitly allowed", () => {
  assert.match(
    rules,
    /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/
  );
});
