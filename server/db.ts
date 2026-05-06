/**
 * Shared DB instance — single better-sqlite3 connection used across
 * storage.ts, badgeEngine.ts, and routes.ts.
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

// Use /data/data.db on Railway (persistent volume) or local data.db in dev
const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";
export const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);
