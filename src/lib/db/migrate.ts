/**
 * Database migration runner.
 *
 * Runs all pending Drizzle migrations against the target database.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Connecting to database for migrations...");
  const sql = neon(url);
  const db = drizzle(sql);

  console.log("Running migrations from ./drizzle...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully!");
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
