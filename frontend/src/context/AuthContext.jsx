
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { apiRequest } from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("practrack_token") || ""
  );

  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("practrack_token");
    localStorage.removeItem("practrack_user");
    setToken("");
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        setInitializing(false);
        return;
      }

      try {
        const data = await apiRequest("/auth/me", {}, token);

        if (!cancelled) {
          setUser(data.user || null);

          if (data.user) {
            localStorage.setItem(
              "practrack_user",
              JSON.stringify(data.user)
            );
          }
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const authenticate = useCallback(async (mode, values) => {
    const endpoint = mode === "register"
      ? "/auth/register"
      : "/auth/login";

    const payload = mode === "register"
      ? values
      : {
          email: values.email,
          password: values.password
        };

    const data = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!data.token || !data.user) {
      throw new Error("The server returned an incomplete login response.");
    }

    localStorage.setItem("practrack_token", data.token);
    localStorage.setItem("practrack_user", JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);

    return data.user;
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    initializing,
    isAuthenticated: Boolean(token && user),
    authenticate,
    logout,
    setUser
  }), [
    token,
    user,
    initializing,
    authenticate,
    logout
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
