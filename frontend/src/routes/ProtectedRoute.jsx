
import {
  Navigate,
  Outlet,
  useLocation
} from "react-router-dom";

import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({
  allowedRoles
}) {
  const {
    user,
    initializing,
    isAuthenticated
  } = useAuth();

  const location = useLocation();

  if (initializing) {
    return (
      <div className="screen-loader">
        <div className="loader-spinner" />
        <p>Restoring your session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user?.role)
  ) {
    return (
      <Navigate
        to={
          user?.role === "admin"
            ? "/admin"
            : "/dashboard"
        }
        replace
      />
    );
  }

  return <Outlet />;
}
