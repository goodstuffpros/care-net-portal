/**
 * Shared DB instance — single better-sqlite3 connection used across
 * storage.ts, badgeEngine.ts, and routes.ts.
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

// Use DB_PATH env var if set, otherwise default to local data.db
const DB_PATH = process.env.DB_PATH || "data.db";
export const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);
