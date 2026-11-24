
import jwt from "jsonwebtoken";
import { User } from "../models.js";
import { isAccountSessionValid } from "../securityPolicy.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-passwordHash");

    if (!isAccountSessionValid(user, payload)) {
      return res.status(401).json({
        message: "Your account is unavailable."
      });
    }

    req.user = user;
    // Newly provisioned accounts must replace the temporary password first.
    const passwordSetupRoute = ["/api/auth/me", "/api/auth/change-password"];
    if (user.mustChangePassword && !passwordSetupRoute.includes(req.originalUrl.split("?")[0])) {
      return res.status(403).json({ code: "PASSWORD_CHANGE_REQUIRED", message: "Change your temporary password before continuing." });
    }
    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session."
    });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to do that."
      });
    }

    return next();
  };
}
