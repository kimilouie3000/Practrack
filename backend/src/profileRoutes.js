
import { Router } from "express";
import { authenticate } from "./middleware/auth.js";
import { auditChange } from "./adjustmentService.js";
import { studentRequiredMinutes } from "./securityPolicy.js";

const router = Router();

router.use(authenticate);

function present(user) {
  const profile = user.profile || {};

  return {
    name: user.name,
    email: user.email,
    studentNo: user.studentNo || "",
    role: user.role,
    company: user.company || "",
    ...(user.role === "student" ? { requiredMinutes: studentRequiredMinutes(user) } : {}),
    phone: profile.phone || "",
    school: profile.school || "",
    course: profile.course || "",
    yearLevel: profile.yearLevel || "",
    section: profile.section || "",
    address: profile.address || "",
    bio: profile.bio || "",
    completed: user.role !== "student" || Boolean(
      user.name?.trim() &&
      profile.school?.trim() &&
      profile.course?.trim() &&
      profile.yearLevel?.trim()
    )
  };
}

router.get("/", (req, res) => {
  res.json({
    profile: present(req.user)
  });
});

router.patch("/", async (req, res) => {
  const fields = {
    name: 100,
    company: 120,
    phone: 30,
    school: 140,
    course: 140,
    yearLevel: 30,
    section: 80,
    address: 200,
    bio: 400
  };

  const clean = {};

  for (const [key, max] of Object.entries(fields)) {
    if (req.body?.[key] === undefined) continue;

    if (typeof req.body[key] !== "string") {
      return res.status(400).json({
        message: `Invalid ${key}.`
      });
    }

    const value = req.body[key].trim();

    if (value.length > max) {
      return res.status(400).json({
        message: `${key} is too long.`
      });
    }

    clean[key] = value;
  }

  if (
    Object.hasOwn(clean, "name") &&
    clean.name.length < 2
  ) {
    return res.status(400).json({
      message: "Name needs at least 2 characters."
    });
  }

  if (
    clean.phone &&
    !/^[+0-9 ()-]{7,30}$/.test(clean.phone)
  ) {
    return res.status(400).json({
      message: "Enter a valid contact number."
    });
  }

  const user = req.user;
  const identityBefore = { name: user.name, company: user.company };

  if (user.role !== "admin" && (clean.name !== undefined || clean.company !== undefined)) {
    return res.status(403).json({ message: "Only an administrator can change a person's name or company." });
  }

  if (clean.name !== undefined) {
    user.name = clean.name;
  }

  if (clean.company !== undefined) {
    user.company = clean.company;
  }

  const profileFields = [
    "phone",
    "school",
    "course",
    "yearLevel",
    "section",
    "address",
    "bio"
  ];

  for (const key of profileFields) {
    if (clean[key] !== undefined) {
      user.set(`profile.${key}`, clean[key]);
    }
  }

  if (user.role === "student") {
    const profile = present(user);

    if (!profile.completed) {
      return res.status(400).json({
        message: "Complete your name, school, course, and year level."
      });
    }
  }

  await user.save();
  if (user.role === "admin" &&
      (identityBefore.name !== user.name || identityBefore.company !== user.company)) {
    await auditChange(user._id, "Admin profile identity changed", user.name,
      identityBefore, { name: user.name, company: user.company }, { targetId: user._id });
  }

  return res.json({
    profile: present(user)
  });
});

export default router;
