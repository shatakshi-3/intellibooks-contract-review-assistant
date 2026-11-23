/**
 * Database client configuration for Neon PostgreSQL.
 *
 * Uses the Neon serverless HTTP driver for connection pooling
 * compatible with Vercel's serverless functions.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@ep-placeholder.neon.tech/neondb?sslmode=require";

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export type Database = typeof db;

