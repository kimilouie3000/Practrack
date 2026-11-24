export const PRACTICUM_TIME_ZONE = "Asia/Manila";

// Match the attendance date recorded by the server.
export function practicumDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PRACTICUM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = key => parts.find(item => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
