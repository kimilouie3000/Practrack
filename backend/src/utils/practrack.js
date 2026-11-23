
export function isValidStudentNumber(value) {
  return typeof value === "string" && /^\d{4}-\d{5}$/.test(value.trim());
}

export function validateDailyMinutes(minutes) {
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 12 * 60;
}

export function validateTimeRange(timeIn, timeOut) {
  if (typeof timeIn !== "string" || typeof timeOut !== "string") {
    return false;
  }

  const toMinutes = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return NaN;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  };

  const start = toMinutes(timeIn);
  const end = toMinutes(timeOut);

  return Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start;
}

export function validateTotalHours(
  currentMinutes,
  addingMinutes,
  requiredMinutes = 400 * 60
) {
  return Number.isInteger(currentMinutes) &&
    Number.isInteger(addingMinutes) &&
    Number.isInteger(requiredMinutes) &&
    currentMinutes >= 0 &&
    addingMinutes > 0 &&
    requiredMinutes > 0 &&
    currentMinutes + addingMinutes <= requiredMinutes;
}

export function formatHours(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error("Minutes must be a non-negative whole number.");
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${hours}h ${remaining}m`;
}
