"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { ReadingResponse } from "./types";

const DB_NAME = "tanach-yomi";
const DB_VERSION = 1;
const STORE = "readings";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function getCachedReading(date: string): Promise<ReadingResponse | undefined> {
  const db = await getDb();
  return db.get(STORE, date);
}

export async function setCachedReading(reading: ReadingResponse): Promise<void> {
  const db = await getDb();
  await db.put(STORE, reading, reading.date);
}
