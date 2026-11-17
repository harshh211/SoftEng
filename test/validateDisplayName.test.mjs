// Test 1: validateDisplayName() — used by the profile page before saving a name.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDisplayName } from '../js/utils/profile.js';

test('validateDisplayName accepts valid names and rejects invalid ones', () => {
  // Valid: trims and collapses extra spaces
  assert.deepEqual(validateDisplayName('  Mariam   Kerzazi '), {
    valid: true, value: 'Mariam Kerzazi', error: null,
  });
  // Valid: apostrophes, hyphens and accented letters
  assert.equal(validateDisplayName("Zoë O'Neil-Smith").valid, true);

  // Invalid: empty or only spaces
  assert.equal(validateDisplayName('   ').error, 'Enter your name.');
  // Invalid: too short
  assert.equal(validateDisplayName('A').valid, false);
  // Invalid: too long (51 characters)
  assert.equal(validateDisplayName('a'.repeat(51)).valid, false);
  // Invalid: numbers / symbols / HTML
  assert.equal(validateDisplayName('<script>').valid, false);
  // Invalid: not a string
  assert.equal(validateDisplayName(null).valid, false);
});
