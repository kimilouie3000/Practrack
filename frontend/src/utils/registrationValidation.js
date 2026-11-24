// Keep these requirements aligned with backend/src/securityPolicy.js.
export const REGISTRATION_PASSWORD_MIN = 12;
export const REGISTRATION_PASSWORD_MAX = 128;

const internalEmail = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@practrack\.com$/;

export function registrationError({ name, studentNo, email, password }) {
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Enter your complete name.";
  }

  if (!/^\d{4}-\d{5}$/.test(String(studentNo || "").trim())) {
    return "Student number must follow YYYY-NNNNN.";
  }

  if (!internalEmail.test(String(email || "").trim().toLowerCase())) {
    return "Use a username@practrack.com login address.";
  }

  if (typeof password !== "string" ||
      password.length < REGISTRATION_PASSWORD_MIN ||
      password.length > REGISTRATION_PASSWORD_MAX ||
      /[\r\n]/.test(password)) {
    return "Password must be 12–128 characters with no line breaks.";
  }

  return null;
}
