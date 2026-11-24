// New accounts use internal PracTrack login identifiers; no external email delivery.
export const ACCOUNT_DOMAIN = "practrack.com";
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function normalizedEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isPracTrackEmail(value) {
  const email = normalizedEmail(value);
  return /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@practrack\.com$/.test(email);
}

export function isStrongPassword(value) {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH &&
    value.length <= MAX_PASSWORD_LENGTH && !/[\r\n]/.test(value);
}

function positiveNumber(raw, fallback) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function requiredHours() {
  return positiveNumber(process.env.REQUIRED_HOURS, 400);
}
export function requiredMinutes() {
  return requiredHours() * 60;
}
export function maxCreditedHours() {
  return positiveNumber(process.env.MAX_CREDITED_HOURS_PER_RECORD, 5000);
}

export const AUTH_LIMIT = 5;
export const AUTH_LOCK_MS = 15 * 60 * 1000;

// One student's target overrides the system default. No arbitrary upper cap.
// JavaScript/MongoDB must still represent the total as a safe whole minute.
export function studentRequiredMinutes(student) {
  const value = student?.requiredMinutesOverride;
  return Number.isSafeInteger(value) && value > 0
    ? value
    : requiredMinutes();
}

export function parseRequiredHours(value) {
  // Empty input restores the system-wide default.
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return null;
  const hours = Number(value);
  const minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isSafeInteger(minutes) || minutes < 1) {
    return undefined;
  }
  // Accept inputs precise to whole minutes; no artificial maximum hours.
  if (Math.abs(minutes / 60 - hours) > 0.000001) return undefined;
  return minutes;
}

/**
 * An account's token version must match the current password version.
 * Tokens minted before a password reset must no longer authenticate.
 */
export function isAccountSessionValid(user, payload) {
  return Boolean(
    user &&
    user.active === true &&
    !user.archivedAt &&
    payload &&
    Number.isSafeInteger(payload.ver) &&
    payload.ver >= 0 &&
    payload.ver === Number(user.passwordVersion || 0)
  );
}

/** Return an actionable registration message without throwing on invalid JSON. */
export function registrationValidationMessage({ name, email, password, studentNo } = {}) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return "Full name must be between 2 and 100 characters.";
  }
  if (typeof email !== "string" || !isPracTrackEmail(email)) {
    return "Use a username@practrack.com login address.";
  }
  if (!isStrongPassword(password)) {
    return "Password must be 12–128 characters.";
  }
  if (typeof studentNo !== "string" || !/^\d{4}-\d{5}$/.test(studentNo.trim())) {
    return "Use the student number format YYYY-NNNNN.";
  }
  return null;
}
