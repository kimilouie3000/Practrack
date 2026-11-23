
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

export async function apiRequest(path, options = {}, token = "") {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || "Something went wrong."
    );

    error.status = response.status;
    error.code = data.code;

    if (
      response.status === 401 &&
      token &&
      path !== "/auth/login"
    ) {
      window.dispatchEvent(
        new Event("practrack:session-expired")
      );
    }

    throw error;
  }

  return data;
}

export { API_URL };
