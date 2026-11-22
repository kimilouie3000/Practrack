import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models.js";

const apply = process.argv.includes("--apply");
async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await User.collection.countDocuments({ role: "coordinator" });
  console.log(`Coordinator accounts found: ${count}`);
  if (!apply) {
    console.log("DRY RUN. Review the count and back up your database before running with --apply.");
  } else {
    const result = await User.collection.updateMany(
      { role: "coordinator" }, { $set: { role: "teacher" } }
    );
    console.log(`Migrated ${result.modifiedCount} accounts to teacher.`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { await mongoose.disconnect(); });