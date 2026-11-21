import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models.js";

async function createAdmin() {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD first.");
  }

  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  }

  await mongoose.connect(MONGODB_URI);

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const existing = await User.findOne({ email });

  if (existing) {
    existing.name = ADMIN_NAME.trim();
    existing.passwordHash = passwordHash;
    existing.role = "admin";
    existing.active = true;
    await existing.save();
    console.log("Administrator account updated.");
  } else {
    await User.create({
      name: ADMIN_NAME.trim(),
      email,
      passwordHash,
      role: "admin"
    });
    console.log("Administrator account created.");
  }

  await mongoose.disconnect();
}

createAdmin().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});