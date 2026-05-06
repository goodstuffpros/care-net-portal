/**
 * Shared DB instance — single better-sqlite3 connection used across
 * storage.ts, badgeEngine.ts, and routes.ts.
 */
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

export const sqlite = new Database("data.db");
export const db = drizzle(sqlite);
