
import "dotenv/config";
import mongoose from "mongoose";

import { User } from "../src/models.js";
import { isPracTrackEmail } from "../src/securityPolicy.js";

const apply = process.argv.includes("--apply");

function makeUsername(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._+-]/g, "")
      .slice(0, 30) || "user"
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const users = await User.find(
    {},
    "_id email role"
  )
    .sort({ _id: 1 })
    .lean();

  const taken = new Set(
    users.map(user => user.email.toLowerCase())
  );

  let changes = 0;

  for (const account of users) {
    if (isPracTrackEmail(account.email)) {
      continue;
    }

    const username = makeUsername(
      account.email.split("@")[0]
    );

    let suggested = `${username}@practrack.com`;
    let counter = 2;

    while (taken.has(suggested)) {
      suggested = `${username}${counter++}@practrack.com`;
    }

    taken.add(suggested);

    if (apply) {
      const result = await User.updateOne(
        {
          _id: account._id,
          email: account.email
        },
        {
          $set: {
            email: suggested
          }
        }
      );

      if (result.modifiedCount !== 1) {
        throw new Error(
          "Concurrent account change detected. Migration stopped."
        );
      }
    }

    changes++;

    console.log(
      `${account.role} account ${String(account._id)} => ${suggested} (${apply ? "updated" : "dry run"})`
    );
  }

  console.log(
    `${changes} account(s) ${apply ? "migrated" : "would change"}.`
  );
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
