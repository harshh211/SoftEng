// Pure profile helpers (no Firebase, no DOM) so they can be unit tested in Node.

export const NAME_MIN = 2;
export const NAME_MAX = 50;

/**
 * Cleans up and validates a display name before it is saved.
 * Trims the ends and collapses repeated spaces.
 * @param {unknown} raw
 * @returns {{ valid: boolean, value: string, error: string|null }}
 */
export function validateDisplayName(raw) {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';

  if (!value) return { valid: false, value, error: 'Enter your name.' };
  if (value.length < NAME_MIN) {
    return { valid: false, value, error: `Name must be at least ${NAME_MIN} characters.` };
  }
  if (value.length > NAME_MAX) {
    return { valid: false, value, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }
  if (!/^[\p{L}\p{M}' .-]+$/u.test(value)) {
    return {
      valid: false,
      value,
      error: 'Name can only use letters, spaces, hyphens, apostrophes, and periods.',
    };
  }
  return { valid: true, value, error: null };
}

/** "Kadie Jenkins" -> "KJ", "adrian" -> "A", "" -> "?" */
export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
