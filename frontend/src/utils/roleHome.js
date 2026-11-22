export const HOME_BY_ROLE = Object.freeze({
  admin: "/admin",
  teacher: "/teacher",
  client: "/client",
  student: "/dashboard"
});

export function roleHome(role) {
  return HOME_BY_ROLE[role] || "/login";
}