// lowdb (JSON-file) database access. The DB lives at /data/db.json.
// We keep a single Low instance per Node process and re-read from disk on each
// access so that data written by the seed script (or another request) is always
// reflected. This is fine for a single-process local app.

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import fs from "node:fs";
import type { DbData } from "./types";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

export const defaultData: DbData = {
  users: [],
  booths: [],
  cases: [],
  matchCandidates: [],
  auditLog: [],
  sessions: [],
  cctvTracks: [],
};

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Cache the Low instance on globalThis so Next.js hot-reload doesn't create a
// fresh adapter (and file handle) on every module re-evaluation.
const globalForDb = globalThis as unknown as { _kumbhDb?: Low<DbData> };

function getInstance(): Low<DbData> {
  if (!globalForDb._kumbhDb) {
    ensureDir();
    const adapter = new JSONFile<DbData>(DB_FILE);
    globalForDb._kumbhDb = new Low<DbData>(adapter, defaultData);
  }
  return globalForDb._kumbhDb;
}

/**
 * Returns the lowdb instance after reading the latest data from disk.
 * Always `await getDb()` at the start of a request handler, mutate
 * `db.data`, then `await db.write()`.
 */
export async function getDb(): Promise<Low<DbData>> {
  const db = getInstance();
  await db.read();
  if (!db.data) {
    db.data = structuredClone(defaultData);
  }
  // Defensive: ensure all collections exist even if the file is partial.
  db.data.users ||= [];
  db.data.booths ||= [];
  db.data.cases ||= [];
  db.data.matchCandidates ||= [];
  db.data.auditLog ||= [];
  db.data.sessions ||= [];
  db.data.cctvTracks ||= [];
  return db;
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}
