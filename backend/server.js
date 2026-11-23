import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;

async function startServer() {
  if (!mongoUri) {
    console.error("MONGODB_URI is required.");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET must contain at least 32 characters.");
    process.exit(1);
  }

  try {
    const stagingDatabase = process.env.MONGODB_DATABASE?.trim();

  if (stagingDatabase && !/^[A-Za-z0-9_-]+$/.test(stagingDatabase)) {
    throw new Error("MONGODB_DATABASE contains invalid characters.");
  }

  await mongoose.connect(mongoUri, stagingDatabase ? { dbName: stagingDatabase } : {});
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  if (stagingDatabase) {
    const count = await mongoose.connection.db.collection("users").countDocuments();
    console.log(`User documents in selected database: ${count}`);
  }
    console.log("Connected to MongoDB.");

    app.listen(port, "0.0.0.0", () => {
      console.log(`PracTrack API running on port ${port}.`);
    });
  } catch (error) {
    console.error("Could not start the server:", error.message);
    process.exit(1);
  }
}

startServer();